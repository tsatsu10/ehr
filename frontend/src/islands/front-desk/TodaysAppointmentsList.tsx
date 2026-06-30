import { CalendarDays } from 'lucide-react';
import type { TodaysAppointmentRow } from '@core/types';

interface TodaysAppointmentsListProps {
  appointments: TodaysAppointmentRow[];
  loading?: boolean;
  onSelect: (pid: number) => void;
}

export function TodaysAppointmentsList({
  appointments,
  loading = false,
  onSelect,
}: TodaysAppointmentsListProps) {
  if (loading && appointments.length === 0) {
    return (
      <div className="oe-nc-todays-appts px-3 py-4 text-center text-sm text-[var(--oe-nc-text-muted)]" role="status">
        Loading today&apos;s schedule…
      </div>
    );
  }

  if (appointments.length === 0) {
    return null;
  }

  return (
    <div className="oe-nc-todays-appts border-t border-[var(--oe-nc-border)]">
      <div className="oe-nc-todays-appts__header flex items-center gap-2 px-3 py-2 bg-[var(--oe-nc-bg-tint)]">
        <CalendarDays className="h-3.5 w-3.5 text-[var(--oe-nc-text-muted)]" aria-hidden="true" />
        <span className="text-xs font-semibold text-[var(--oe-nc-text)]">
          Today&apos;s appointments
        </span>
        <span className="text-xs text-[var(--oe-nc-text-muted)] tabular-nums">{appointments.length}</span>
      </div>
      <ul className="oe-nc-todays-appts__list list-none m-0 p-0" role="list">
        {appointments.map((row) => (
          <li key={`${row.pid}-${row.pc_eid}`}>
            <button
              type="button"
              className="oe-nc-todays-appts__row w-full text-left px-3 py-2.5 border-b border-[var(--oe-nc-border)] last:border-b-0 hover:bg-[var(--oe-nc-bg-tint)] transition-colors"
              onClick={() => onSelect(row.pid)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="oe-nc-todays-appts__time shrink-0 w-14 text-xs font-semibold tabular-nums text-[var(--oe-nc-primary)]">
                  {row.start_time_label ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--oe-nc-text)] truncate">
                    {row.display_name}
                  </span>
                  <span className="block text-xs text-[var(--oe-nc-text-muted)] truncate">
                    MRN {row.pubpid}
                    {row.provider_name ? ` · ${row.provider_name}` : ''}
                  </span>
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
