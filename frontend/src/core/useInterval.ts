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

    // SCALE-1.7 — ±10% jitter, fixed once per mount, so thousands of desks that all
    // load at shift start don't fire their polls in lockstep (thundering herd).
    const jitteredDelay = delayMs * (0.9 + Math.random() * 0.2);

    const tick = () => {
      if (!document.hidden) {
        savedCallback.current();
      }
    };

    const id = window.setInterval(tick, jitteredDelay);
    return () => window.clearInterval(id);
  }, [delayMs]);
}
