import type { CommLens } from './communicationsTypes';

const SELECTION_KEY = 'nc_comm_hub_selection';

export interface CommHubStoredSelection {
  lens: CommLens;
  selectedId: number;
  selectedType: 'message' | 'reminder';
}

export function readCommHubSelection(): CommHubStoredSelection | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(SELECTION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CommHubStoredSelection;
    if (
      (parsed.lens !== 'messages' && parsed.lens !== 'reminders')
      || typeof parsed.selectedId !== 'number'
      || (parsed.selectedType !== 'message' && parsed.selectedType !== 'reminder')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCommHubSelection(selection: CommHubStoredSelection | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!selection) {
    window.sessionStorage.removeItem(SELECTION_KEY);
    return;
  }
  window.sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
}
