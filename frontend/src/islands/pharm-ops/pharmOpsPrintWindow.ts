const POPUP_BLOCKED_MESSAGE =
  'Pop-up blocked — allow pop-ups for this site to open the print window';

/** Open a print URL; throws when the browser blocks the pop-up. */
export function openPrintWindow(url: string): void {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    throw new Error(POPUP_BLOCKED_MESSAGE);
  }
}
