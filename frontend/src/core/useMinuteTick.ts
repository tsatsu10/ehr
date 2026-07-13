import { useSyncExternalStore } from 'react';

/**
 * A single shared ~30s ticker (SCALE-1.8 follow-up).
 *
 * Components that display live, client-computed elapsed time (WaitTimeSpan) call
 * this so they re-render as time passes — WITHOUT any network poll. One interval is
 * shared across every subscriber (100 queue cards = 1 timer, not 100), and it stops
 * when the last subscriber unmounts. This is what lets the delta poll (SCALE-1.8)
 * skip unchanged payloads while the on-screen wait still advances.
 */

const TICK_MS = 30_000;

// Current wall-clock ms, refreshed on each tick. Held in the store (not read during
// render) so components stay pure — they use this returned value instead of calling
// Date.now() themselves. Only changes every ~30s, so it's a stable snapshot between
// ticks (required by useSyncExternalStore).
let nowMs = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  nowMs = Date.now(); // fresh baseline when a component (re)mounts
  if (timer === null) {
    timer = setInterval(() => {
      // No point re-rendering a backgrounded tab.
      if (typeof document !== 'undefined' && document.hidden) return;
      nowMs = Date.now();
      listeners.forEach((listener) => listener());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return nowMs;
}

/** Current wall-clock ms, refreshed ~every 30s so callers re-render for live elapsed time. */
export function useMinuteTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
