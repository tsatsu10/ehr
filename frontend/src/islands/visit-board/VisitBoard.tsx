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
import type { BoardData, ColumnKey, VisitCard, VisitBoardProps, VisitDetailData } from '@core/types';
import { VisitBoardColumn } from './VisitBoardColumn';
import { SegmentedControl } from '@components/SegmentedControl';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { VisitDetailModal } from './VisitDetailModal';
import { VisitDetailDrawer } from './VisitDetailDrawer';
import { CancelledTodaySection } from './CancelledTodaySection';
import { LeftUnpaidTodaySection } from './LeftUnpaidTodaySection';
import { computeNowServing } from './visitBoardUtils';
import { useVisitBoardKiosk } from './useVisitBoardKiosk';
import { VisitBoardKioskToolbar } from './VisitBoardKioskToolbar';
import {
  visitBoardRootClass,
  visitBoardLanesClass,
  visitBoardLaneClass,
  visitBoardColumnClass,
  visitBoardColumnHeaderClass,
  visitBoardSkeletonClass,
  visitBoardSkeletonCardClass,
  visitBoardToolbarClass,
} from '@components/visitBoardStyles';

export const COLUMN_ORDER: ColumnKey[] = [
  'waiting', 'triage', 'doctor', 'lab', 'pharmacy', 'payment', 'done',
];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  waiting:  'Waiting',
  triage:   'Triage',
  doctor:   'Doctor',
  lab:      'Lab',
  pharmacy: 'Pharmacy',
  payment:  'Payment',
  done:     'Done',
};

function matchesFilter(card: VisitCard, searchText: string, urgentOnly: boolean): boolean {
  if (urgentOnly && !card.is_urgent) return false;
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
  const [privacyOverride, setPrivacyOverride] = useState<boolean | null>(null);
  const privacyMode = privacyOverride ?? privacyModeProp ?? isWall;
  const { isFullscreen, toggleFullscreen } = useVisitBoardKiosk(isKiosk);

  // Board data from last successful fetch — preserved across re-fetch errors
  const [data, setData] = useState<BoardData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  // fetchError is set on background-poll errors; board data is kept visible
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [detailVisitId, setDetailVisitId] = useState<number | null>(null);
  const [drawerData, setDrawerData] = useState<VisitDetailData | null>(null);

  // Guard against stale responses (race between rapid refreshes or slow polls)
  const seqRef = useRef(0);

  const fetchBoard = useCallback(async () => {
    seqRef.current += 1;
    const token = seqRef.current;

    try {
      const params: Record<string, string | number> = {};
      if (facilityId > 0) params.facility_id = facilityId;

      const result = await oeFetch<BoardData>('visit.board', { ajaxUrl, csrfToken, params });

      if (token !== seqRef.current) return; // stale response
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

  // Initial load
  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  useQueueVisibilityRefresh(() => {
    void fetchBoard();
  });

  // Auto-poll every pollMs ms
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

    const clinicName = banner.dataset.clinicName || banner.textContent || '';
    const serving = computeNowServing(data.columns);
    banner.textContent = serving
      ? `Now serving #${serving.queue_number || '?'}`
      : clinicName;

    return undefined;
  }, [data, isWall]);

  // ── Initial skeleton ─────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div
        className={visitBoardRootClass(isKiosk)}
        data-profile={profile}
        aria-busy="true"
      >
        <div className={visitBoardLanesClass} aria-busy="true">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className={visitBoardLaneClass}>
              <div className={visitBoardColumnClass}>
                <div className={`${visitBoardColumnHeaderClass} ${visitBoardSkeletonClass}`} aria-hidden="true" />
                <div className={visitBoardSkeletonCardClass} aria-hidden="true" />
                <div className={visitBoardSkeletonCardClass} aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Full error (never loaded any data yet) ───────────────────────────────

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
    cards: (data.columns[key] ?? []).filter((c) => matchesFilter(c, searchText, urgentOnly)),
  }));

  const totalVisible = filteredColumns.reduce((sum, col) => sum + col.cards.length, 0);
  const statusItems = columnKeys.map((key) => ({
    label: COLUMN_LABELS[key],
    value: (data.columns[key] ?? []).length,
  }));

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

      {/* Stale-visits banner */}
      {data.stale_count > 0 && (
        <div className={deskCalloutClass('warn', 'mb-3 flex items-center gap-2')} role="status" aria-live="polite">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{data.stale_count}</strong>{' '}
            {data.stale_count === 1 ? 'patient' : 'patients'} in the queue arrived before today
          </span>
        </div>
      )}

      {fetchError && !errorDismissed && (
        <div className={deskCalloutClass('warn', 'mb-3 flex items-center gap-2')} role="alert" aria-live="polite">
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

      {/* Stats + filter bar (desktop only, not wall) */}
      {!isWall && (
        <>
          <DeskQueueStatusBar
            id="nc-board-status-bar"
            ariaLabel="Visit board status"
            items={statusItems}
            loading={initialLoading}
            onRefresh={() => { void fetchBoard(); }}
            compact
          />

          <div className={`${visitBoardToolbarClass} mb-3 flex flex-wrap items-center justify-end`}>
          {/* Search */}
          <div className="relative mr-2" style={{ maxWidth: 220 }}>
            <i className="fa fa-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--oe-nc-text-muted)]" aria-hidden="true" />
            <Input
              type="search"
              className="h-8 pl-8 pr-8"
              placeholder="Search name, MRN, queue #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search patients"
            />
            {search && (
              <button
                type="button"
                className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded border-0 bg-transparent text-lg leading-none text-[var(--oe-nc-text-muted)] hover:bg-[var(--oe-nc-bg-tint)] hover:text-[var(--oe-nc-text)]"
                aria-label="Clear search"
                onClick={() => setSearch('')}
              >
                ×
              </button>
            )}
          </div>

          {/* Filter: all vs urgent */}
          <SegmentedControl
            className="mr-2 mb-1"
            ariaLabel="Visit board filter"
            value={filterMode}
            onChange={(id) => setUrgentOnly(id === 'urgent')}
            segments={[
              { id: 'all', label: 'All', count: allCards.length },
              { id: 'urgent', label: 'Urgent', count: urgentCards.length },
            ]}
          />
          </div>
        </>
      )}

      {/* No results message */}
      {(searchText || urgentOnly) && totalVisible === 0 && (
        <div
          className="mb-3 rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)] px-4 py-3 text-sm text-[var(--oe-nc-text-muted)]"
          role="status"
        >
          No patients match the current filter.
        </div>
      )}

      {/* Columns */}
      <div className={visitBoardLanesClass} id="nc-board-columns" role="region" aria-label="Visit board">
        {filteredColumns.map(({ key, cards }) => (
          <VisitBoardColumn
            key={key}
            columnKey={key}
            cards={cards}
            privacyMode={privacyMode}
            onCardClick={handleCardClick}
            selectedVisitId={selectedVisitId}
            queueBridgeBadges={data.queue_bridge_badges ?? {}}
          />
        ))}
      </div>

      {!isWall && (
        <>
          <CancelledTodaySection visits={data.cancelled ?? []} />
          <LeftUnpaidTodaySection visits={data.closed_unpaid ?? []} />
        </>
      )}

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
