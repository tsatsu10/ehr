import { useEffect } from 'react';

/**
 * Sync clinic visit date into a Twig page-heading subtitle slot (e.g. #nc-lab-date).
 */
export function usePageSubtitleDate(elementId: string, visitDate: string | null | undefined): void {
  useEffect(() => {
    const dateEl = document.getElementById(elementId);
    if (!dateEl) return undefined;

    dateEl.textContent = visitDate ?? '';
    return () => {
      dateEl.textContent = '';
    };
  }, [elementId, visitDate]);
}
