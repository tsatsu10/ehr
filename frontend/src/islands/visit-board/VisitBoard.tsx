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
import { usePageHeadingToolbar } from '@core/usePageHeadingToolbar';
import type { BoardData, ColumnKey, VisitCard, VisitBoardProps, VisitDetailData } from '@core/types';
import { VisitBoardColumn } from './VisitBoardColumn';
import { SegmentedControl } from '@components/SegmentedControl';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { VisitDetailModal } from './VisitDetailModal';
import { VisitDetailDrawer } from './VisitDetailDrawer';
import { CancelledTodaySection } from './CancelledTodaySection';
import { LeftUnpaidTodaySection } from './LeftUnpaidTodaySection';
import { computeNowServing } from './visitBoardUtils';

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
}: VisitBoardProps) {
  const isWall = profile === 'wall';
  const privacyMode = privacyModeProp ?? isWall;

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

  // Refetch when the tab becomes visible again after being hidden
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void fetchBoard();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchBoard]);

  // Auto-poll every pollMs ms
  useInterval(fetchBoard, pollMs);

  usePageHeadingToolbar({
    dateElementId: isWall ? undefined : 'nc-board-date',
    updatedElementId: 'nc-board-updated',
    refreshButtonId: 'nc-refresh-queue',
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
      <div className="oe-nc-vb" data-profile={profile} aria-busy="true">
        <div className="row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-sm-6 col-md-4 col-lg-3 mb-3">
              <div className="oe-nc-vb-column">
                <div className="oe-nc-vb-column__header oe-nc-vb-skeleton" aria-hidden="true" />
                <div className="oe-nc-vb-skeleton oe-nc-vb-skeleton--card" aria-hidden="true" />
                <div className="oe-nc-vb-skeleton oe-nc-vb-skeleton--card" aria-hidden="true" />
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
      <div className="oe-nc-vb" data-profile={profile}>
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <i className="fa fa-exclamation-triangle mr-2 flex-shrink-0" aria-hidden="true" />
          <span className="flex-grow-1">{fetchError}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ml-3"
            onClick={() => void fetchBoard()}
          >
            Retry
          </button>
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
    <div className="oe-nc-vb" data-profile={profile}>

      {/* Stale-visits banner */}
      {data.stale_count > 0 && (
        <div className="alert alert-warning d-flex align-items-center mb-3" role="status" aria-live="polite">
          <i className="fa fa-clock-o mr-2 flex-shrink-0" aria-hidden="true" />
          <span>
            <strong>{data.stale_count}</strong>{' '}
            {data.stale_count === 1 ? 'patient' : 'patients'} in the queue arrived before today
          </span>
        </div>
      )}

      {/* Background-poll error banner (board data preserved beneath) */}
      {fetchError && !errorDismissed && (
        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert" aria-live="polite">
          <i className="fa fa-exclamation-triangle mr-2 flex-shrink-0" aria-hidden="true" />
          <span className="flex-grow-1 small">
            Could not refresh — showing last known data.{' '}
            <button
              type="button"
              className="btn btn-sm btn-link p-0 align-baseline"
              onClick={() => void fetchBoard()}
            >
              Retry now
            </button>
          </span>
          <button
            type="button"
            className="close ml-2"
            aria-label="Dismiss"
            onClick={() => setErrorDismissed(true)}
          >
            <span aria-hidden="true">×</span>
          </button>
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

          <div className="oe-nc-vb__toolbar mb-3 d-flex flex-wrap align-items-center justify-content-end">
          {/* Search */}
          <div className="oe-nc-search-input__wrap mr-2" style={{ maxWidth: 220 }}>
            <i className="fa fa-search oe-nc-search-input__icon" aria-hidden="true" />
            <input
              type="search"
              className="form-control form-control-sm oe-nc-search-input__field"
              placeholder="Search name, MRN, queue #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search patients"
            />
            {search && (
              <button
                type="button"
                className="oe-nc-search-input__clear"
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
        <div className="alert alert-light text-muted mb-3" role="status">
          No patients match the current filter.
        </div>
      )}

      {/* Columns */}
      <div className="row" id="nc-board-columns" role="region" aria-label="Visit board">
        {filteredColumns.map(({ key, cards }) => (
          <VisitBoardColumn
            key={key}
            columnKey={key}
            cards={cards}
            privacyMode={privacyMode}
            onCardClick={handleCardClick}
            selectedVisitId={selectedVisitId}
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
      />
      <VisitDetailDrawer
        open={drawerData !== null}
        data={drawerData}
        onClose={() => setDrawerData(null)}
      />
    </div>
  );
}
