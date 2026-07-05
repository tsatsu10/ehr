import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInterval } from '@core/useInterval';
import { useDeskViewport } from '@core/useDeskViewport';
import { SegmentedControl } from '@components/SegmentedControl';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import {
  advanceFlowBoardStatus,
  fetchFlowBoard,
  fetchFlowBoardPrefs,
  pollFlowBoard,
  saveFlowBoardPrefs,
  updateFlowBoardRoom,
} from './schedulingApi';
import { FlowBoardLaneColumn } from './FlowBoardLaneColumn';
import {
  isFlowBoardUnchanged,
  loadFlowBoardLanePrefs,
  moveCardBetweenLanes,
  moveLaneInOrder,
  reorderLanes,
  saveFlowBoardLanePrefs,
  sortLanesByOrder,
  tickFlowBoardWaitTimes,
} from './schedulingFlowBoardUtils';
import type { SchedulingFilters, SchedulingLabels } from './schedulingTypes';
import { resolveSchedulingLabels } from './schedulingLabels';

interface FlowBoardLensProps {
  ajaxUrl: string;
  csrfToken: string;
  filters: SchedulingFilters;
  refreshToken: number;
  frontDeskUrl: string;
  moduleUrl: string;
  authUserId: number;
  mode2Hint?: string;
  labels?: Partial<SchedulingLabels>;
}

export function FlowBoardLens({
  ajaxUrl,
  csrfToken,
  filters,
  refreshToken,
  frontDeskUrl,
  moduleUrl,
  authUserId,
  mode2Hint,
  labels: labelOverrides,
}: FlowBoardLensProps) {
  const labels = resolveSchedulingLabels(labelOverrides);
  const viewport = useDeskViewport();
  const mobileAccordion = viewport === 'mobile';
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchFlowBoard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyEid, setBusyEid] = useState<number | null>(null);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [dragLane, setDragLane] = useState<string | null>(null);
  const [collapsedLanes, setCollapsedLanes] = useState<string[]>(
    () => loadFlowBoardLanePrefs(authUserId).collapsed,
  );
  const [laneOrder, setLaneOrder] = useState<string[]>(
    () => loadFlowBoardLanePrefs(authUserId).order,
  );
  const [liveMessage, setLiveMessage] = useState('');
  const revisionRef = useRef('');

  useEffect(() => {
    if (authUserId <= 0) {
      return;
    }
    void fetchFlowBoardPrefs(ajaxUrl, csrfToken)
      .then((prefs) => {
        setCollapsedLanes(prefs.collapsed);
        setLaneOrder(prefs.order);
        saveFlowBoardLanePrefs(authUserId, prefs);
      })
      .catch(() => {
        // Keep localStorage defaults when server prefs are unavailable.
      });
  }, [ajaxUrl, authUserId, csrfToken]);

  const persistLanePrefs = useCallback((collapsed: string[], order: string[]) => {
    saveFlowBoardLanePrefs(authUserId, { collapsed, order });
    void saveFlowBoardPrefs(ajaxUrl, csrfToken, collapsed, order).catch(() => {
      // Local prefs still apply if server save fails.
    });
  }, [ajaxUrl, authUserId, csrfToken]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await fetchFlowBoard(ajaxUrl, csrfToken, filters);
      revisionRef.current = payload.revision;
      setData({
        ...payload,
        lanes: tickFlowBoardWaitTimes(payload.lanes),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorLoadFlowBoard);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, filters, labels.errorLoadFlowBoard]);

  const poll = useCallback(async () => {
    if (!revisionRef.current) {
      return;
    }
    try {
      const payload = await pollFlowBoard(ajaxUrl, csrfToken, filters, revisionRef.current);
      if (isFlowBoardUnchanged(payload)) {
        return;
      }
      revisionRef.current = payload.revision;
      setData({
        ...payload,
        lanes: tickFlowBoardWaitTimes(payload.lanes),
      });
    } catch {
      // Keep last good board on background poll failure.
    }
  }, [ajaxUrl, csrfToken, filters]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshToken]);

  useInterval(() => {
    if (document.visibilityState === 'visible') {
      void poll();
    }
  }, data?.poll_interval_ms ?? 20000);

  useInterval(() => {
    setData((current) => {
      if (!current) {
        return current;
      }
      return { ...current, lanes: tickFlowBoardWaitTimes(current.lanes) };
    });
  }, 60_000);

  const toggleLaneCollapse = useCallback((status: string) => {
    setCollapsedLanes((current) => {
      const next = current.includes(status)
        ? current.filter((lane) => lane !== status)
        : [...current, status];
      persistLanePrefs(next, laneOrder);
      return next;
    });
  }, [laneOrder, persistLanePrefs]);

  const updateLaneOrder = useCallback((nextOrder: string[]) => {
    setLaneOrder(nextOrder);
    persistLanePrefs(collapsedLanes, nextOrder);
  }, [collapsedLanes, persistLanePrefs]);

  const applyBoardPayload = useCallback((payload: Awaited<ReturnType<typeof fetchFlowBoard>>) => {
    revisionRef.current = payload.revision;
    setData({
      ...payload,
      lanes: tickFlowBoardWaitTimes(payload.lanes),
    });
    setLiveMessage(`${labels.flowBoardUpdatedAt} ${new Date().toLocaleTimeString()}`);
  }, [labels.flowBoardUpdatedAt]);

  const handleStatusChange = useCallback(async (pcEid: number, status: string, optimistic = false) => {
    if (optimistic && data) {
      setData({
        ...data,
        lanes: moveCardBetweenLanes(data.lanes, pcEid, status),
      });
    }
    setBusyEid(pcEid);
    setError(null);
    try {
      const payload = await advanceFlowBoardStatus(ajaxUrl, csrfToken, filters, pcEid, status);
      applyBoardPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorStatusUpdate);
      if (optimistic) {
        void load();
      }
    } finally {
      setBusyEid(null);
      setDragLane(null);
    }
  }, [ajaxUrl, csrfToken, filters, data, applyBoardPayload, load, labels.errorStatusUpdate]);

  const handleRoomChange = useCallback(async (pcEid: number, room: string) => {
    setBusyEid(pcEid);
    setError(null);
    try {
      const payload = await updateFlowBoardRoom(ajaxUrl, csrfToken, filters, pcEid, room);
      applyBoardPayload(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorRoomUpdate);
    } finally {
      setBusyEid(null);
    }
  }, [ajaxUrl, csrfToken, filters, applyBoardPayload, labels.errorRoomUpdate]);

  const lanes = useMemo(
    () => sortLanesByOrder(data?.lanes ?? [], laneOrder),
    [data?.lanes, laneOrder],
  );
  const laneStatuses = useMemo(() => (data?.lanes ?? []).map((lane) => lane.status), [data?.lanes]);
  const flatCards = lanes.flatMap((lane) => lane.cards);

  const handleLaneDrop = useCallback((targetStatus: string, pcEid: number) => {
    const card = flatCards.find((row) => row.pc_eid === pcEid);
    if (!card || card.status === targetStatus || card.is_recurring || !data?.can_advance) {
      setDragLane(null);
      return;
    }
    void handleStatusChange(pcEid, targetStatus, true);
  }, [flatCards, data?.can_advance, handleStatusChange]);

  if (loading && !data) {
    return <p className="text-[var(--oe-nc-text-muted)] mb-0">{labels.loadingFlowBoard}</p>;
  }

  if (error && !data) {
    return <div className={deskCalloutClass('error', 'mb-0')}>{error}</div>;
  }

  return (
    <div className="nc-flowboard">
      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>
      <div className="flex flex-wrap items-center justify-between mb-3">
        <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2 md:mb-0">
          {mode2Hint ?? labels.flowBoardMode2Hint}
        </p>
        <SegmentedControl
          className="mb-2"
          segments={[
            { id: 'board', label: labels.flowBoardBoard },
            { id: 'list', label: labels.flowBoardList },
          ]}
          value={view}
          onChange={(id) => setView(id as 'board' | 'list')}
          ariaLabel="Flow Board layout"
        />
      </div>

      {error && <div className={deskCalloutClass('warn', 'py-2')}>{error}</div>}

      {view === 'board' ? (
        <div className={`nc-flowboard-board${mobileAccordion ? ' nc-flowboard-board--mobile' : ''}`}>
          {lanes.map((lane) => (
            <FlowBoardLaneColumn
              key={lane.status}
              lane={lane}
              canAdvance={!!data?.can_advance}
              busyEid={busyEid}
              frontDeskUrl={frontDeskUrl}
              dragOver={dragLane === lane.status}
              collapsed={collapsedLanes.includes(lane.status)}
              mobileAccordion={mobileAccordion}
              onToggleCollapse={() => toggleLaneCollapse(lane.status)}
              onAdvance={handleStatusChange}
              onCheckIn={handleStatusChange}
              onRoomChange={handleRoomChange}
              onDragStart={() => { /* lane highlight driven by onDragEnter */ }}
              onDragEnter={setDragLane}
              onDragLeave={() => setDragLane(null)}
              onDrop={handleLaneDrop}
              onMoveLane={(status, delta) => {
                updateLaneOrder(moveLaneInOrder(laneOrder, status, delta, laneStatuses));
              }}
              onReorderLane={(fromStatus, toStatus) => {
                updateLaneOrder(reorderLanes(laneOrder, fromStatus, toStatus, laneStatuses));
              }}
              labels={labels}
              moduleUrl={moduleUrl}
              filters={filters}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ striped: true, className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{labels.listColTime}</TableHead>
                <TableHead scope="col">{labels.listColPatient}</TableHead>
                <TableHead scope="col">{labels.listColStatus}</TableHead>
                <TableHead scope="col">{labels.listColWait}</TableHead>
                <TableHead scope="col">{labels.listColActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatCards.map((card) => (
                <TableRow key={card.pc_eid}>
                  <TableCell>{card.appt_time_label ?? '—'}</TableCell>
                  <TableCell>{card.patient_name}</TableCell>
                  <TableCell>{card.status_label}</TableCell>
                  <TableCell>{card.minutes_in_status > 0 ? `${card.minutes_in_status}m` : '—'}</TableCell>
                  <TableCell>
                    {card.next_status && data?.can_advance && !card.is_recurring && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyEid === card.pc_eid}
                        onClick={() => { void handleStatusChange(card.pc_eid, card.next_status as string); }}
                      >
                        {labels.flowBoardNext}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
