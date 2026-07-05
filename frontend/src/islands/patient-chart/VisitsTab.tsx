import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import type { ChartVisitRow } from './patientChartTypes';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
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
    <div className="border rounded p-2 mb-2 flex flex-wrap items-start">
      <div className="grow">
        <div className="flex items-center flex-wrap">
          <strong className="mr-2">#{visit.queue_number}</strong>
          <span className="text-[var(--oe-nc-text-muted)] text-sm mr-2">{dateLabel}</span>
          <Badge variant="info" className="mr-1">{formatStateLabel(visit.state)}</Badge>
          {visit.is_urgent && <Badge variant="warning" className="mr-1">URGENT</Badge>}
          {visit.skipped_triage && (
            <Badge variant="neutral" className="mr-1">Skipped triage</Badge>
          )}
          <AncillaryVisitBadges badges={visit.ancillary_badges} className="mr-1" />
        </div>
        <div className="text-sm">
          {visit.visit_type_label ?? 'Visit'}
          {visit.service_profile && visit.service_profile !== 'full_opd'
            ? ` · ${visit.service_profile}`
            : ''}
        </div>
        {visit.chief_complaint && (
          <div className="text-sm text-[var(--oe-nc-text-muted)]">CC: {visit.chief_complaint}</div>
        )}
      </div>
      <div className="flex flex-wrap items-center ml-auto">
        {visit.documentation_url && (
          <Button variant="outline" size="sm" className="ml-2" asChild>
            <a href={visit.documentation_url} target="_top">
              View documentation
            </a>
          </Button>
        )}
        {visit.export_visit_summary_url && (
          <Button variant="outline" size="sm" className="ml-2" asChild>
            <a href={visit.export_visit_summary_url} target="_top">
              Export visit summary
            </a>
          </Button>
        )}
        {isToday && visitBoardUrl && (
          <Button variant="outline" size="sm" className="ml-2" asChild>
            <a href={visitBoardUrl}>
              Board
            </a>
          </Button>
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
    return <div className={deskCalloutClass('error')}>{error}</div>;
  }

  return (
    <>
      <h5 className="mb-2">Today</h5>
      {todayVisits.length === 0 ? (
        <p className="text-[var(--oe-nc-text-muted)]">No visits today.</p>
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
        <p className="text-[var(--oe-nc-text-muted)]">No past visits on file.</p>
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          Load more
        </Button>
      )}
    </>
  );
}
