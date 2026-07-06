import type { VisitState, ColumnKey, VisitCard } from '@core/types';

export const COLUMN_ORDER: ColumnKey[] = [
  'waiting', 'triage', 'doctor', 'lab', 'pharmacy', 'payment', 'done',
];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  waiting:  'Waiting',
  triage:   'Triage',
  doctor:   'Doctor',
  lab:      'Lab',
  pharmacy: 'Pharmacy',
  payment:  'Payment',
  done:     'Done',
};

export interface DeskAction {
  label: string;
  url: string;
}

export function deskActionForState(
  state: VisitState | string,
  deskUrls: Record<string, string>,
): DeskAction | null {
  if (state === 'waiting' && deskUrls.front_desk) {
    return { label: 'Open Front Desk', url: deskUrls.front_desk };
  }
  if (state === 'in_triage' && deskUrls.triage) {
    return { label: 'Open Triage', url: deskUrls.triage };
  }
  if ((state === 'ready_for_doctor' || state === 'with_doctor') && deskUrls.doctor) {
    return { label: 'Open Doctor Desk', url: deskUrls.doctor };
  }
  if (
    (state === 'ready_for_lab' || state === 'in_lab' || state === 'lab_complete')
    && deskUrls.lab
  ) {
    return { label: 'Open Lab Desk', url: deskUrls.lab };
  }
  if (
    (state === 'ready_for_pharmacy' || state === 'in_pharmacy' || state === 'pharmacy_complete')
    && deskUrls.pharmacy
  ) {
    return { label: 'Open Pharmacy Desk', url: deskUrls.pharmacy };
  }
  if (state === 'ready_for_payment' && deskUrls.cashier) {
    return { label: 'Open Cashier', url: deskUrls.cashier };
  }
  return null;
}

const WALL_SERVING_PRIORITY: VisitState[] = [
  'with_doctor',
  'ready_for_doctor',
  'in_triage',
  'waiting',
];

function columnKeyForWallState(state: VisitState): ColumnKey {
  if (state === 'with_doctor' || state === 'ready_for_doctor') return 'doctor';
  if (state === 'in_triage') return 'triage';
  return 'waiting';
}

/** Wall display: lowest queue # among highest-priority active state. */
export function computeNowServing(
  columns: Partial<Record<ColumnKey, VisitCard[]>>,
): VisitCard | null {
  for (const state of WALL_SERVING_PRIORITY) {
    const columnKey = columnKeyForWallState(state);
    const cards = (columns[columnKey] ?? []).filter((card) => card.state === state);
    if (!cards.length) continue;

    return [...cards].sort(
      (a, b) => parseInt(String(a.queue_number), 10) - parseInt(String(b.queue_number), 10),
    )[0];
  }

  return null;
}
