/**
 * Desk active-visit sessionStorage helpers (T1-F19).
 *
 * Mirrors NewClinicUI.setDeskActiveVisitId / clearDeskActiveVisitId in ui-components.js.
 */

export function getDeskActiveVisitId(storageKey: string): number {
  if (!storageKey) return 0;
  try {
    return Number.parseInt(window.sessionStorage.getItem(storageKey) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function setDeskActiveVisitId(storageKey: string, visitId: number): void {
  if (!storageKey || visitId <= 0) return;
  try {
    window.sessionStorage.setItem(storageKey, String(visitId));
  } catch {
    // private mode / quota — ignore
  }
}

export function clearDeskActiveVisitId(storageKey: string): void {
  if (!storageKey) return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}
