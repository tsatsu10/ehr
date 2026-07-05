import type { TodayVisitRow } from '@core/types';
import { StatusPill } from '@components/StatusPill';

interface TodaysVisitsListProps {
  visits: TodayVisitRow[];
}

export function TodaysVisitsList({ visits }: TodaysVisitsListProps) {
  if (visits.length <= 1) return null;

  return (
    <div className="mb-2" id="nc-todays-visits">
      <div className="text-xs font-semibold uppercase tracking-wide mb-1">Today&apos;s visits</div>
      <ul className="list-none m-0 p-0 text-sm">
        {visits.map((visit) => (
          <li
            key={visit.visit_id}
            className={`flex flex-wrap items-center gap-2 mb-1 ${visit.is_finished ? 'text-[var(--oe-nc-text-muted)]' : ''}`}
          >
            <span>#{visit.queue_number}</span>
            {visit.visit_type_label && <span>{visit.visit_type_label}</span>}
            <StatusPill state={visit.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}
