/**
 * StatusPill — visit-state badge built on shadcn Badge.
 */
import { Badge, type BadgeProps } from './ui/badge';
import type { PillVariant, VisitState } from '@core/types';

const VISIT_STATE: Record<VisitState, { variant: PillVariant; label: string; dot: string }> = {
  waiting:              { variant: 'info',    label: 'Waiting',           dot: '#38bdf8' },
  in_triage:            { variant: 'info',    label: 'In triage',         dot: '#38bdf8' },
  ready_for_doctor:     { variant: 'warning', label: 'Ready for doctor',  dot: '#f59e0b' },
  with_doctor:          { variant: 'success', label: 'With doctor',       dot: '#10b981' },
  ready_for_lab:        { variant: 'warning', label: 'Ready for lab',     dot: '#f59e0b' },
  in_lab:               { variant: 'info',    label: 'In lab',            dot: '#38bdf8' },
  lab_complete:         { variant: 'success', label: 'Lab complete',      dot: '#10b981' },
  ready_for_pharmacy:   { variant: 'warning', label: 'Ready for pharmacy',dot: '#f59e0b' },
  in_pharmacy:          { variant: 'info',    label: 'In pharmacy',       dot: '#38bdf8' },
  pharmacy_complete:    { variant: 'success', label: 'Pharmacy complete', dot: '#10b981' },
  ready_for_payment:    { variant: 'warning', label: 'Ready to pay',      dot: '#f59e0b' },
  completed:            { variant: 'success', label: 'Completed',         dot: '#10b981' },
  closed_unpaid:        { variant: 'danger',  label: 'Left unpaid',       dot: '#ef4444' },
  cancelled:            { variant: 'neutral', label: 'Cancelled',         dot: '#94a3b8' },
};

export interface StatusPillProps {
  state: VisitState;
  queueNumber?: string;
  className?: string;
}

export function StatusPill({ state, queueNumber, className }: StatusPillProps) {
  const meta = VISIT_STATE[state] ?? { variant: 'neutral' as PillVariant, label: state, dot: '#94a3b8' };
  const label = queueNumber ? `#${queueNumber} ${meta.label}` : meta.label;

  return (
    <Badge variant={meta.variant as BadgeProps['variant']} className={className}>
      <span
        className="block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.dot }}
        aria-hidden="true"
      />
      {label}
    </Badge>
  );
}
