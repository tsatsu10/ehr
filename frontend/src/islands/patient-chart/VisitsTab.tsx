import type { ChartVisitRow } from './patientChartTypes';
import { formatStateLabel } from './patientChartUtils';

interface VisitsTabProps {
  todayVisits: ChartVisitRow[];
  pastVisits: ChartVisitRow[];
  pastHasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  visitBoardUrl: string;
  onLoadMore: () => void;
}

function VisitRow({
  visit,
  visitBoardUrl,
  isToday,
}: {
  visit: ChartVisitRow;
  visitBoardUrl: string;
  isToday: boolean;
}) {
  const dateLabel = isToday ? 'Today' : visit.visit_date ?? '—';

  return (
    <div className="border rounded p-2 mb-2 d-flex flex-wrap align-items-start">
      <div className="flex-grow-1">
        <div className="d-flex align-items-center flex-wrap">
          <strong className="mr-2">#{visit.queue_number}</strong>
          <span className="text-muted small mr-2">{dateLabel}</span>
          <span className="badge badge-info mr-1">{formatStateLabel(visit.state)}</span>
          {visit.is_urgent && <span className="badge badge-warning mr-1">URGENT</span>}
          {visit.skipped_triage && (
            <span className="badge badge-secondary mr-1">Skipped triage</span>
          )}
        </div>
        <div className="small">
          {visit.visit_type_label ?? 'Visit'}
          {visit.service_profile && visit.service_profile !== 'full_opd'
            ? ` · ${visit.service_profile}`
            : ''}
        </div>
        {visit.chief_complaint && (
          <div className="small text-muted">CC: {visit.chief_complaint}</div>
        )}
      </div>
      <div className="d-flex flex-wrap align-items-center ml-auto">
        {visit.documentation_url && (
          <a
            className="btn btn-sm btn-outline-primary ml-2"
            href={visit.documentation_url}
            target="_top"
          >
            View documentation
          </a>
        )}
        {visit.export_visit_summary_url && (
          <a
            className="btn btn-sm btn-outline-secondary ml-2"
            href={visit.export_visit_summary_url}
            target="_top"
          >
            Export visit summary
          </a>
        )}
        {isToday && visitBoardUrl && (
          <a className="btn btn-sm btn-outline-secondary ml-2" href={visitBoardUrl}>
            Board
          </a>
        )}
      </div>
    </div>
  );
}

export function VisitsTab({
  todayVisits,
  pastVisits,
  pastHasMore,
  loading,
  loadingMore,
  error,
  visitBoardUrl,
  onLoadMore,
}: VisitsTabProps) {
  if (loading) {
    return <em>Loading visits…</em>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <>
      <h5 className="mb-2">Today</h5>
      {todayVisits.length === 0 ? (
        <p className="text-muted">No visits today.</p>
      ) : (
        todayVisits.map((visit, idx) => (
          <VisitRow
            key={`today-${visit.queue_number ?? idx}`}
            visit={visit}
            visitBoardUrl={visitBoardUrl}
            isToday
          />
        ))
      )}

      <h5 className="mb-2 mt-4">Past visits</h5>
      {pastVisits.length === 0 ? (
        <p className="text-muted">No past visits on file.</p>
      ) : (
        pastVisits.map((visit, idx) => (
          <VisitRow
            key={`past-${visit.visit_date ?? ''}-${visit.queue_number ?? idx}`}
            visit={visit}
            visitBoardUrl={visitBoardUrl}
            isToday={false}
          />
        ))
      )}

      {pastHasMore && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mt-2"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          Load more
        </button>
      )}
    </>
  );
}
