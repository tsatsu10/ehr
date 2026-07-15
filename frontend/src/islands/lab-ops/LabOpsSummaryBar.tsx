import type { WorklistSummary } from './labOpsTypes';

/**
 * D-LAB-TAT — day-level SLIPTA indicators above the worklist: how many orders, how many released,
 * the median turnaround time, and the specimen-rejection rate for the selected date. The rejection
 * rate turns amber past 2% and red past 5% (common lab targets) so a bad day stands out.
 */
interface LabOpsSummaryBarProps {
  summary: WorklistSummary;
}

function rejectionTone(pct: number): string {
  if (pct >= 5) return 'text-[var(--oe-nc-danger,#dc2626)]';
  if (pct >= 2) return 'text-[var(--oe-nc-warning,#b45309)]';
  return 'text-[var(--oe-nc-text)]';
}

export function LabOpsSummaryBar({ summary }: LabOpsSummaryBarProps) {
  const {
    total_orders: total,
    released,
    rejections,
    rejection_rate_pct: rejectionPct,
    median_tat_label: tatLabel,
  } = summary;

  return (
    <dl className="nc-labops-summary" aria-label="Lab day summary">
      <div className="nc-labops-summary-stat">
        <dt>Orders today</dt>
        <dd>{total}</dd>
      </div>
      <div className="nc-labops-summary-stat">
        <dt>Released</dt>
        <dd>{released}</dd>
      </div>
      <div className="nc-labops-summary-stat">
        <dt>Median turnaround</dt>
        <dd>{tatLabel ?? '—'}</dd>
      </div>
      <div className="nc-labops-summary-stat">
        <dt>Rejection rate</dt>
        <dd className={rejectionTone(rejectionPct)}>
          {rejectionPct}% <span className="nc-labops-summary-sub">({rejections})</span>
        </dd>
      </div>
    </dl>
  );
}
