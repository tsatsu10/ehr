import { CalendarDays, ChevronRight, FileText, History } from 'lucide-react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChartEmptyState,
  ChartLoadingState,
  ChartSection,
  ChartStack,
} from './chartUi';
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
    <article
      className={cn(
        'nc-chart-visit-row flex flex-wrap items-start gap-3',
        isToday && 'nc-chart-visit-row--today',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-[var(--oe-nc-text)]">#{visit.queue_number}</strong>
          <span className="text-sm text-[var(--oe-nc-text-muted)]">{dateLabel}</span>
          <Badge variant="info">{formatStateLabel(visit.state)}</Badge>
          {visit.is_urgent && <Badge variant="warning">URGENT</Badge>}
          {visit.skipped_triage && <Badge variant="neutral">Skipped triage</Badge>}
          <AncillaryVisitBadges badges={visit.ancillary_badges} />
        </div>
        <div className="mt-1 text-sm text-[var(--oe-nc-text)]">
          {visit.visit_type_label ?? 'Visit'}
          {visit.service_profile && visit.service_profile !== 'full_opd'
            ? ` · ${visit.service_profile}`
            : ''}
        </div>
        {visit.chief_complaint && (
          <div className="mt-1 text-sm text-[var(--oe-nc-text-muted)]">
            CC: {visit.chief_complaint}
          </div>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {visit.documentation_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={visit.documentation_url} target="_top">
              <FileText className="mr-1 h-4 w-4" aria-hidden />
              View documentation
            </a>
          </Button>
        )}
        {visit.export_visit_summary_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={visit.export_visit_summary_url} target="_top">
              Export summary
            </a>
          </Button>
        )}
        {isToday && visitBoardUrl && (
          <Button variant="ghost" size="sm" asChild>
            <a href={visitBoardUrl}>
              Board
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </a>
          </Button>
        )}
      </div>
    </article>
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
    return <ChartLoadingState label="Loading visits…" />;
  }

  if (error) {
    return <div className={deskCalloutClass('error')}>{error}</div>;
  }

  return (
    <ChartStack>
      <ChartSection
        title="Today"
        description="Visits in progress or completed today"
        icon={<CalendarDays className="h-4 w-4" aria-hidden />}
        variant="accent"
      >
        {todayVisits.length === 0 ? (
          <ChartEmptyState title="No visits today" />
        ) : (
          <div className="space-y-2">
            {todayVisits.map((visit, idx) => (
              <VisitRow
                key={`today-${visit.queue_number ?? idx}`}
                visit={visit}
                visitBoardUrl={visitBoardUrl}
                isToday
              />
            ))}
          </div>
        )}
      </ChartSection>

      <ChartSection
        title="Past visits"
        description="Historical encounters, most recent first"
        icon={<History className="h-4 w-4" aria-hidden />}
      >
        {pastVisits.length === 0 ? (
          <ChartEmptyState title="No past visits on file" />
        ) : (
          <div className="space-y-2">
            {pastVisits.map((visit, idx) => (
              <VisitRow
                key={`past-${visit.visit_date ?? ''}-${visit.queue_number ?? idx}`}
                visit={visit}
                visitBoardUrl={visitBoardUrl}
                isToday={false}
              />
            ))}
          </div>
        )}
        {pastHasMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 cursor-pointer"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        )}
      </ChartSection>
    </ChartStack>
  );
}
