import { useEffect, useRef } from 'react';
import { isPollBackoffActive } from './pollBackoff';

export interface UseIntervalOptions {
  /**
   * SCALE-3.2 — when the server rate-limits a poll (429 + retry_after_ms),
   * skip ticks until the budget window rolls over. Defaults to true because
   * nearly every consumer is a network poll; pass false ONLY for client-only
   * ticks (e.g. wait-time re-rendering) that never touch the network.
   */
  respectPollBackoff?: boolean;
}

/**
 * Run `callback` every `delayMs` milliseconds, skipping ticks when the
 * browser tab is hidden (document.hidden) or while a server poll rate-limit
 * backoff is active. Clears the interval on unmount.
 *
 * Pass `null` as delay to pause the interval without unmounting.
 */
export function useInterval(
  callback: () => void,
  delayMs: number | null,
  options: UseIntervalOptions = {}
): void {
  const savedCallback = useRef(callback);
  const respectPollBackoff = options.respectPollBackoff ?? true;

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;

    // SCALE-1.7 — ±10% jitter, fixed once per mount, so thousands of desks that all
    // load at shift start don't fire their polls in lockstep (thundering herd).
    const jitteredDelay = delayMs * (0.9 + Math.random() * 0.2);

    const tick = () => {
      if (document.hidden) return;
      if (respectPollBackoff && isPollBackoffActive()) return;
      savedCallback.current();
    };

    const id = window.setInterval(tick, jitteredDelay);
    return () => window.clearInterval(id);
  }, [delayMs, respectPollBackoff]);
}
