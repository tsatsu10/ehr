import { useEffect } from 'react';

/** M0-F34 — immediate queue refresh when the tab becomes visible again. */
export function useQueueVisibilityRefresh(onVisible: () => void): void {
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) {
        onVisible();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [onVisible]);
}
