import { t } from '@core/i18n';
import type { DoctorDeskNotice } from './doctorDeskUtils';

const STORAGE_PREFIX = 'nc-doctor-lab-toast-seen:';

export function wasLabResultsToastSeen(visitId: number): boolean {
  if (visitId <= 0) {
    return true;
  }
  try {
    return window.sessionStorage.getItem(`${STORAGE_PREFIX}${visitId}`) === '1';
  } catch {
    return false;
  }
}

export function markLabResultsToastSeen(visitId: number): void {
  if (visitId <= 0) {
    return;
  }
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${visitId}`, '1');
  } catch {
    // sessionStorage unavailable
  }
}

export function buildLabResultsReadyNotice(
  visitId: number,
  displayName: string,
  queueNumber: string | number,
  previousReady: boolean,
  currentReady: boolean,
  enabled: boolean,
): DoctorDeskNotice | null {
  if (!enabled || visitId <= 0 || !currentReady || previousReady) {
    return null;
  }
  if (wasLabResultsToastSeen(visitId)) {
    return null;
  }

  markLabResultsToastSeen(visitId);

  return {
    message: t('Lab results ready for {name} (queue #{queueNumber}).', { name: displayName, queueNumber }),
    variant: 'success',
  };
}

export interface LabResultsQueueCard {
  id: number;
  display_name: string;
  queue_number: string | number;
  routing_chips?: { results_ready?: boolean };
}

/** Record current ready flags without firing toasts (first poll / desk open). */
export function seedResultsReadyState(
  cards: LabResultsQueueCard[],
  activeConsult: LabResultsQueueCard | null | undefined,
  state: Record<number, boolean>,
): Record<number, boolean> {
  const nextState = { ...state };

  for (const card of cards) {
    nextState[card.id] = !!card.routing_chips?.results_ready;
  }

  if (activeConsult) {
    nextState[activeConsult.id] = !!activeConsult.routing_chips?.results_ready;
  }

  return nextState;
}

export function scanQueueCardsForLabResultsToast(
  cards: LabResultsQueueCard[],
  previousState: Record<number, boolean>,
  enabled: boolean,
): { nextState: Record<number, boolean>; notice: DoctorDeskNotice | null } {
  const nextState = { ...previousState };

  for (const card of cards) {
    const isReady = !!card.routing_chips?.results_ready;
    const notice = buildLabResultsReadyNotice(
      card.id,
      card.display_name,
      card.queue_number,
      previousState[card.id] ?? false,
      isReady,
      enabled,
    );
    nextState[card.id] = isReady;
    if (notice) {
      return { nextState, notice };
    }
  }

  return { nextState, notice: null };
}
