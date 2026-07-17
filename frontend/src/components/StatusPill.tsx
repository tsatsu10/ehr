/**
 * StatusPill — visit-state badge built on shadcn Badge.
 * Console 26 palette (2026-07-16).
 */
import { Badge, type BadgeProps } from './ui/badge';
import type { PillVariant, VisitState } from '@core/types';

/* Dots use the severity palette; "waiting" carries the Console 26 accent */
const VISIT_STATE: Record<VisitState, { variant: PillVariant; label: string; dot: string }> = {
  waiting:              { variant: 'info',    label: 'Waiting',           dot: '#0071e3' },
  in_triage:            { variant: 'info',    label: 'In triage',         dot: '#0e7490' },
  ready_for_doctor:     { variant: 'warning', label: 'Ready for doctor',  dot: '#b45309' },
  with_doctor:          { variant: 'success', label: 'With doctor',       dot: '#047857' },
  ready_for_lab:        { variant: 'warning', label: 'Ready for lab',     dot: '#b45309' },
  in_lab:               { variant: 'info',    label: 'In lab',            dot: '#0e7490' },
  lab_complete:         { variant: 'success', label: 'Lab complete',      dot: '#047857' },
  ready_for_pharmacy:   { variant: 'warning', label: 'Ready for pharmacy',dot: '#b45309' },
  in_pharmacy:          { variant: 'info',    label: 'In pharmacy',       dot: '#0e7490' },
  pharmacy_complete:    { variant: 'success', label: 'Pharmacy complete', dot: '#047857' },
  ready_for_payment:    { variant: 'warning', label: 'Ready to pay',      dot: '#b45309' },
  completed:            { variant: 'success', label: 'Completed',         dot: '#047857' },
  closed_unpaid:        { variant: 'danger',  label: 'Left unpaid',       dot: '#b42318' },
  cancelled:            { variant: 'neutral', label: 'Cancelled',         dot: '#93a3b1' },
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
