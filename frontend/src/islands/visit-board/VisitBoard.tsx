/**
 * VisitBoard — Phase 1 React island replacing jQuery nc-board-columns rendering.
 *
 * Fetches ?action=visit.board every pollMs ms (default 30s), skipping ticks
 * while the tab is hidden. Renders the multi-column Kanban with inline
 * search + urgent filter. Card clicks open the React visit-detail modal.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { oeFetch } from '@core/oeFetch';
import { useInterval } from '@core/useInterval';
import { useQueueVisibilityRefresh } from '@core/useQueueVisibilityRefresh';
import { usePageHeadingToolbar } from '@core/usePageHeadingToolbar';
import { useDeskViewport } from '@core/useDeskViewport';
import type { BoardData, ColumnKey, VisitCard, VisitBoardProps, VisitDetailData } from '@core/types';
import { VisitBoardColumn } from './VisitBoardColumn';
import { SegmentedControl } from '@components/SegmentedControl';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { VisitDetailModal } from './VisitDetailModal';
import { VisitDetailDrawer } from './VisitDetailDrawer';
import { CancelledTodaySection } from './CancelledTodaySection';
import { LeftUnpaidTodaySection } from './LeftUnpaidTodaySection';
import { COLUMN_ORDER, COLUMN_LABELS, computeNowServing } from './visitBoardUtils';
import { useVisitBoardKiosk } from './useVisitBoardKiosk';
import { VisitBoardKioskToolbar } from './VisitBoardKioskToolbar';
import {
  VisitBoardControlsPanel,
  VisitBoardLayout,
  VisitBoardMobileAccordion,
  VisitBoardSearchField,
  VisitBoardSkeleton,
} from './visitBoardUi';
import { visitBoardLanesClass, visitBoardRootClass } from '@components/visitBoardStyles';

export { COLUMN_ORDER, COLUMN_LABELS } from './visitBoardUtils';

function matchesSearch(card: VisitCard, searchText: string): boolean {
  if (!searchText) return true;
  const hay = [card.display_name, card.pubpid, card.queue_number, card.chief_complaint]
    .join(' ')
    .toLowerCase();
  return hay.includes(searchText);
}

function visibleColumnKeys(data: BoardData): ColumnKey[] {
  const cfg = data.config;
  return COLUMN_ORDER.filter((key) => {
    if (key === 'triage' && !cfg.enable_triage) return false;
    if (key === 'lab' && !cfg.enable_lab_role && !(data.columns.lab?.length)) return false;
    if (key === 'pharmacy' && !cfg.enable_pharmacy_role && !(data.columns.pharmacy?.length)) return false;
    return true;
  });
}

export function VisitBoard({
  ajaxUrl,
  csrfToken,
  facilityId,
  pollMs = 30_000,
  profile = 'default',
  privacyMode: privacyModeProp,
  canCancel = false,
  deskUrls = {},
  kioskChrome = false,
  clinicName = '',
}: VisitBoardProps) {
  const isWall = profile === 'wall';
  const isKiosk = isWall && kioskChrome;
  const viewport = useDeskViewport();
  const isMobile = viewport === 'mobile';
  const [privacyOverride, setPrivacyOverride] = useState<boolean | null>(null);
  const privacyMode = privacyOverride ?? privacyModeProp ?? isWall;
  const { isFullscreen, toggleFullscreen } = useVisitBoardKiosk(isKiosk);

  const [data, setData] = useState<BoardData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [detailVisitId, setDetailVisitId] = useState<number | null>(null);
  const [drawerData, setDrawerData] = useState<VisitDetailData | null>(null);

  const seqRef = useRef(0);
  const deepLinkPidRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = new URL(window.location.href).searchParams.get('pid');
    if (!raw) return;
    const pid = Number.parseInt(raw, 10);
    if (Number.isFinite(pid) && pid > 0) {
      deepLinkPidRef.current = pid;
    }
  }, []);

  const fetchBoard = useCallback(async () => {
    seqRef.current += 1;
    const token = seqRef.current;

    try {
      const params: Record<string, string | number> = {};
      if (facilityId > 0) params.facility_id = facilityId;

      const result = await oeFetch<BoardData>('visit.board', { ajaxUrl, csrfToken, params });

      if (token !== seqRef.current) return;
      setData(result);
      setFetchError(null);
      setErrorDismissed(false);
      setLastUpdated(new Date());
    } catch (err) {
      if (token !== seqRef.current) return;
      setFetchError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      if (token === seqRef.current) setInitialLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    const pid = deepLinkPidRef.current;
    if (!data || pid == null) return;

    for (const key of COLUMN_ORDER) {
      const cards = data.columns[key] ?? [];
      const match = cards.find((card) => card.pid === pid);
      if (match) {
        setSearch(match.pubpid || match.display_name);
        deepLinkPidRef.current = null;
        break;
      }
    }
  }, [data]);

  useQueueVisibilityRefresh(() => {
    void fetchBoard();
  });

  useInterval(fetchBoard, pollMs);

  useEffect(() => {
    if (!isKiosk) {
      setPrivacyOverride(null);
    }
  }, [isKiosk]);

  useEffect(() => {
    if (privacyModeProp !== undefined) {
      setPrivacyOverride(null);
    }
  }, [privacyModeProp]);

  usePageHeadingToolbar({
    dateElementId: isWall ? undefined : 'nc-board-date',
    updatedElementId: isKiosk ? undefined : 'nc-board-updated',
    refreshButtonId: isKiosk ? undefined : 'nc-refresh-queue',
    visitDate: data?.visit_date,
    lastUpdated,
    onRefresh: fetchBoard,
  });

  const closeDetail = useCallback(() => {
    setDetailVisitId(null);
    setDrawerData(null);
  }, []);

  const handleCardClick = useCallback((card: VisitCard) => {
    setSelectedVisitId((prev) => (prev === card.id ? null : card.id));
    if (isWall) return;
    setDrawerData(null);
    setDetailVisitId(card.id);
  }, [isWall]);

  const handleVisitCancelled = useCallback(() => {
    closeDetail();
    void fetchBoard();
  }, [closeDetail, fetchBoard]);

  useEffect(() => {
    if (!isWall || !data) return undefined;

    const banner = document.getElementById('nc-wall-now-serving');
    if (!banner) return undefined;

    const clinicBannerName = banner.dataset.clinicName || banner.textContent || '';
    const serving = computeNowServing(data.columns);
    banner.textContent = serving
      ? `Now serving #${serving.queue_number || '?'}`
      : clinicBannerName;

    return undefined;
  }, [data, isWall]);

  if (initialLoading) {
    return <VisitBoardSkeleton isKiosk={isKiosk} profile={profile} />;
  }

  if (!data && fetchError) {
    return (
      <div className={visitBoardRootClass(isKiosk)} data-profile={profile}>
        <div className={deskCalloutClass('error', 'flex items-center gap-3')} role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="grow">{fetchError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchBoard()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const searchText = search.trim().toLowerCase();
  const columnKeys = visibleColumnKeys(data);

  const allCards = columnKeys.flatMap((key) => data.columns[key] ?? []);
  const urgentCards = allCards.filter((card) => card.is_urgent);
  const filterMode = urgentOnly ? 'urgent' : 'all';

  const filteredColumns = columnKeys.map((key) => ({
    key,
    cards: (data.columns[key] ?? []).filter((c) => matchesSearch(c, searchText)),
  }));

  const totalVisible = filteredColumns.reduce((sum, col) => sum + col.cards.length, 0);

  const statusItems = columnKeys.map((key) => ({
    label: COLUMN_LABELS[key],
    value: (data.columns[key] ?? []).length,
    href: `#nc-vb-col-${key}`,
  }));

  const alerts = (
    <>
      {data.stale_count > 0 && (
        <div className={deskCalloutClass('warn', 'flex items-center gap-2')} role="status" aria-live="polite">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{data.stale_count}</strong>{' '}
            {data.stale_count === 1 ? 'patient' : 'patients'} in the queue arrived before today
          </span>
        </div>
      )}

      {fetchError && !errorDismissed && (
        <div className={deskCalloutClass('warn', 'flex items-center gap-2')} role="alert" aria-live="polite">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="grow text-sm">
            Could not refresh — showing last known data.{' '}
            <Button type="button" variant="link" size="sm" className="h-auto p-0 align-baseline" onClick={() => void fetchBoard()}>
              Retry now
            </Button>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            aria-label="Dismiss"
            onClick={() => setErrorDismissed(true)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {searchText && totalVisible === 0 && (
        <div className="nc-vb-filter-empty" role="status">
          No patients match the current search.
        </div>
      )}
    </>
  );

  const controls = !isWall ? (
    <VisitBoardControlsPanel
      statusBar={(
        <DeskQueueStatusBar
          id="nc-board-status-bar"
          ariaLabel="Visit board status"
          items={statusItems}
          loading={initialLoading}
          onRefresh={() => { void fetchBoard(); }}
          compact
        />
      )}
      toolbar={(
        <>
          <VisitBoardSearchField
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
          />
          <SegmentedControl
            className="nc-vb-filter-segments"
            ariaLabel="Visit board filter"
            value={filterMode}
            onChange={(id) => setUrgentOnly(id === 'urgent')}
            segments={[
              { id: 'all', label: 'All', count: allCards.length },
              { id: 'urgent', label: 'Urgent', count: urgentCards.length },
            ]}
          />
        </>
      )}
    />
  ) : undefined;

  const floor = isMobile && !isWall ? (
    <VisitBoardMobileAccordion
      columns={filteredColumns}
      privacyMode={privacyMode}
      urgentOnly={urgentOnly}
      onCardClick={handleCardClick}
      selectedVisitId={selectedVisitId}
      queueBridgeBadges={data.queue_bridge_badges ?? {}}
    />
  ) : (
    <div className={visitBoardLanesClass} id="nc-board-columns" role="region" aria-label="Visit board">
      {filteredColumns.map(({ key, cards }) => (
        <VisitBoardColumn
          key={key}
          columnKey={key}
          cards={cards}
          privacyMode={privacyMode}
          urgentOnly={urgentOnly}
          collapsed={key === 'done' && !doneExpanded}
          onToggleCollapse={key === 'done' ? () => setDoneExpanded((prev) => !prev) : undefined}
          onCardClick={handleCardClick}
          selectedVisitId={selectedVisitId}
          queueBridgeBadges={data.queue_bridge_badges ?? {}}
        />
      ))}
    </div>
  );

  const footer = !isWall ? (
    <>
      <CancelledTodaySection visits={data.cancelled ?? []} />
      <LeftUnpaidTodaySection visits={data.closed_unpaid ?? []} />
    </>
  ) : undefined;

  return (
    <div className={visitBoardRootClass(isKiosk)} data-profile={profile}>
      {isKiosk && (
        <VisitBoardKioskToolbar
          clinicName={clinicName || 'Clinic'}
          lastUpdated={lastUpdated}
          isFullscreen={isFullscreen}
          privacyMode={privacyMode}
          onToggleFullscreen={toggleFullscreen}
          onPrivacyModeChange={setPrivacyOverride}
          onRefresh={() => { void fetchBoard(); }}
        />
      )}

      <VisitBoardLayout
        alerts={alerts}
        controls={controls}
        floor={(
          <div className="nc-vb-floor-panel">
            {floor}
          </div>
        )}
        footer={footer}
      />

      <VisitDetailModal
        visitId={detailVisitId}
        open={detailVisitId !== null}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        canCancel={canCancel}
        deskUrls={deskUrls}
        onClose={closeDetail}
        onOpenDrawer={setDrawerData}
        onVisitCancelled={handleVisitCancelled}
        onQueueBridgeResolved={() => void fetchBoard()}
      />
      <VisitDetailDrawer
        open={drawerData !== null}
        data={drawerData}
        onClose={() => setDrawerData(null)}
      />
    </div>
  );
}
