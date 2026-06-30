import type { TodayVisitRow } from '@core/types';
import { StatusPill } from '@components/StatusPill';

interface TodaysVisitsListProps {
  visits: TodayVisitRow[];
}

export function TodaysVisitsList({ visits }: TodaysVisitsListProps) {
  if (visits.length <= 1) return null;

  return (
    <div className="oe-nc-patient-banner__section mb-2" id="nc-todays-visits">
      <div className="small font-weight-bold mb-1">Today&apos;s visits</div>
      <ul className="list-unstyled mb-0 small">
        {visits.map((visit) => (
          <li
            key={visit.visit_id}
            className={`d-flex flex-wrap align-items-center mb-1 ${visit.is_finished ? 'text-muted' : ''}`}
          >
            <span className="mr-2">#{visit.queue_number}</span>
            {visit.visit_type_label && <span className="mr-2">{visit.visit_type_label}</span>}
            <StatusPill state={visit.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}
