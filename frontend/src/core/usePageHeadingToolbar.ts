import { useEffect } from 'react';
import { usePageSubtitleDate } from './usePageSubtitleDate';

function formatUpdatedTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Mirror legacy #nc-*-updated label in the page heading. */
export function usePageHeadingUpdated(elementId: string, lastUpdated: Date | null): void {
  useEffect(() => {
    const updatedEl = document.getElementById(elementId);
    if (!updatedEl) return undefined;

    updatedEl.textContent = lastUpdated ? `Updated ${formatUpdatedTime(lastUpdated)}` : '';
    return () => {
      updatedEl.textContent = '';
    };
  }, [elementId, lastUpdated]);
}

/** Wire Twig page-heading button to a React handler. */
export function usePageHeadingButton(buttonId: string, onClick: () => void): void {
  useEffect(() => {
    const button = document.getElementById(buttonId);
    if (!button) return undefined;

    const handler = () => onClick();
    button.addEventListener('click', handler);
    return () => button.removeEventListener('click', handler);
  }, [buttonId, onClick]);
}

/** Wire Twig page-heading refresh button to a React queue refetch handler. */
export function usePageHeadingRefresh(buttonId: string, onRefresh: () => void): void {
  useEffect(() => {
    const button = document.getElementById(buttonId);
    if (!button) return undefined;

    const handler = () => onRefresh();
    button.addEventListener('click', handler);
    return () => button.removeEventListener('click', handler);
  }, [buttonId, onRefresh]);
}

export interface PageHeadingToolbarOptions {
  dateElementId?: string;
  updatedElementId: string;
  refreshButtonId: string;
  visitDate?: string | null;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

/** Bundle page-heading date, updated time, and refresh for legacy Twig parity. */
export function usePageHeadingToolbar({
  dateElementId,
  updatedElementId,
  refreshButtonId,
  visitDate,
  lastUpdated,
  onRefresh,
}: PageHeadingToolbarOptions): void {
  usePageSubtitleDate(dateElementId ?? '', dateElementId ? visitDate : null);
  usePageHeadingUpdated(updatedElementId, lastUpdated);
  usePageHeadingRefresh(refreshButtonId, onRefresh);
}
