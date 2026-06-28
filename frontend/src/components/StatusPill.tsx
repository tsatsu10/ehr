/**
 * StatusPill — renders a colored FSM visit-state badge.
 *
 * Uses existing `oe-nc-status-pill` CSS from components.css.
 * Mirrors VISIT_STATE map in ui-components.js.
 */

import type { PillVariant, VisitState } from '@core/types';

const VISIT_STATE: Record<VisitState, { variant: PillVariant; label: string }> = {
  waiting:              { variant: 'info',    label: 'Waiting' },
  in_triage:            { variant: 'info',    label: 'In triage' },
  ready_for_doctor:     { variant: 'warning', label: 'Ready for doctor' },
  with_doctor:          { variant: 'success', label: 'With doctor' },
  ready_for_lab:        { variant: 'warning', label: 'Ready for lab' },
  in_lab:               { variant: 'info',    label: 'In lab' },
  lab_complete:         { variant: 'success', label: 'Lab complete' },
  ready_for_pharmacy:   { variant: 'warning', label: 'Ready for pharmacy' },
  in_pharmacy:          { variant: 'info',    label: 'In pharmacy' },
  pharmacy_complete:    { variant: 'success', label: 'Pharmacy complete' },
  ready_for_payment:    { variant: 'warning', label: 'Ready to pay' },
  completed:            { variant: 'success', label: 'Completed' },
  closed_unpaid:        { variant: 'danger',  label: 'Left unpaid' },
  cancelled:            { variant: 'neutral', label: 'Cancelled' },
};

export interface StatusPillProps {
  state: VisitState;
  /** When set, prepends "#N " to the label (e.g. "#3 Waiting"). */
  queueNumber?: string;
}

export function StatusPill({ state, queueNumber }: StatusPillProps) {
  const meta = VISIT_STATE[state] ?? { variant: 'neutral' as PillVariant, label: state };
  const label = queueNumber ? `#${queueNumber} ${meta.label}` : meta.label;

  return (
    <span className={`oe-nc-status-pill oe-nc-status-pill--${meta.variant}`}>
      <span className="oe-nc-status-pill__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
