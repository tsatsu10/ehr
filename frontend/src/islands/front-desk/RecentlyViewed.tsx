import { Clock, X } from 'lucide-react';
import type { RecentPatient } from '@core/useRecentlyViewedPatients';

interface RecentlyViewedProps {
  patients: RecentPatient[];
  onSelect: (pid: number) => void;
  onClear: () => void;
}

export function RecentlyViewed({ patients, onSelect, onClear }: RecentlyViewedProps) {
  if (patients.length === 0) return null;

  return (
    <div className="oe-nc-recently-viewed flex items-center gap-2 flex-wrap px-3 py-2 border-b border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)]">
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--oe-nc-text-muted)] shrink-0">
        <Clock className="h-3 w-3" aria-hidden="true" />
        Recent
      </span>
      <ul className="flex flex-wrap gap-1.5 list-none p-0 m-0 flex-1 min-w-0">
        {patients.map((patient) => (
          <li key={patient.pid}>
            <button
              type="button"
              className="oe-nc-recently-viewed__pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[var(--oe-nc-border)] text-xs font-medium text-[var(--oe-nc-text)] hover:border-[var(--oe-nc-primary)] hover:text-[var(--oe-nc-primary)] transition-colors max-w-[14rem]"
              onClick={() => onSelect(patient.pid)}
              title={`${patient.display_name} · MRN ${patient.pubpid}`}
            >
              <span className="truncate">{patient.display_name}</span>
              <span className="text-[var(--oe-nc-text-muted)] tabular-nums">{patient.pubpid}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="oe-nc-recently-viewed__clear shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full text-[var(--oe-nc-text-muted)] hover:bg-white hover:text-[var(--oe-nc-text)] transition-colors"
        onClick={onClear}
        aria-label="Clear recently viewed"
        title="Clear recently viewed"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
