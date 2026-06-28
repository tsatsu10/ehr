import { useEffect, useRef } from 'react';

/**
 * Run `callback` every `delayMs` milliseconds, skipping ticks when the
 * browser tab is hidden (document.hidden). Clears the interval on unmount.
 *
 * Pass `null` as delay to pause the interval without unmounting.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;

    const tick = () => {
      if (!document.hidden) {
        savedCallback.current();
      }
    };

    const id = window.setInterval(tick, delayMs);
    return () => window.clearInterval(id);
  }, [delayMs]);
}
