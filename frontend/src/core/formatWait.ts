/**
 * Wait-time formatting utilities.
 * Mirrors the logic in ui-components.js::formatWaitLabel and getWaitTimeClass.
 */

const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

export function formatWaitLabel(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 1) return '< 1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export type WaitSeverity = 'long' | 'medium' | '';

export function waitSeverity(waitMinutes: number, visitDate: string): WaitSeverity {
  const vd = (visitDate ?? '').slice(0, 10);
  if (vd && vd < TODAY) return 'long';       // carry-over from previous day
  if (waitMinutes >= 240) return 'long';     // 4h+
  if (waitMinutes >= 120) return 'medium';   // 2h+
  return '';
}
