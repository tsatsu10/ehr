import type { BoardTerminalVisit } from '@core/types';
import { CollapsibleBoardSection } from './CollapsibleBoardSection';

interface CancelledTodaySectionProps {
  visits: BoardTerminalVisit[];
}

export function CancelledTodaySection({ visits }: CancelledTodaySectionProps) {
  return (
    <CollapsibleBoardSection
      toggleId="nc-cancelled-toggle"
      sectionId="nc-cancelled-section"
      listId="nc-cancelled-list"
      title="Cancelled today"
      count={visits.length}
      dataToggleAttr="data-nc-cancelled-toggle"
    >
      {visits.length === 0 ? (
        <em className="text-[var(--oe-nc-text-muted)]">None</em>
      ) : (
        visits.map((visit) => (
          <div key={visit.id ?? `${visit.queue_number}-${visit.display_name}`} className="border-bottom py-1">
            #{visit.queue_number} {visit.display_name}
            {visit.cancel_reason ? ` — ${visit.cancel_reason}` : ''}
          </div>
        ))
      )}
    </CollapsibleBoardSection>
  );
}
