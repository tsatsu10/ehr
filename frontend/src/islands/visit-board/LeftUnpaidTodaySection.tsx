import type { BoardTerminalVisit } from '@core/types';
import { CollapsibleBoardSection } from './CollapsibleBoardSection';

interface LeftUnpaidTodaySectionProps {
  visits: BoardTerminalVisit[];
}

export function LeftUnpaidTodaySection({ visits }: LeftUnpaidTodaySectionProps) {
  return (
    <CollapsibleBoardSection
      toggleId="nc-unpaid-toggle"
      sectionId="nc-unpaid-section"
      listId="nc-unpaid-list"
      title="Left unpaid today"
      count={visits.length}
      dataToggleAttr="data-nc-unpaid-toggle"
    >
      {visits.length === 0 ? (
        <em className="text-muted">None</em>
      ) : (
        visits.map((visit) => (
          <div key={visit.id ?? `${visit.queue_number}-${visit.display_name}`} className="border-bottom py-1">
            #{visit.queue_number} {visit.display_name}
            {visit.unpaid_reason ? ` — ${visit.unpaid_reason}` : ''}
          </div>
        ))
      )}
    </CollapsibleBoardSection>
  );
}
