/**
 * Fleet-wide poll backoff (SCALE-3.2).
 *
 * When the server rate-limits a poll action (HTTP 429 with `retry_after_ms`),
 * every island in this tab should stop hammering until the budget window rolls
 * over — the limit is per user per action, so retrying immediately only burns
 * more budget. oeFetch records the 429 here; useInterval consults it and skips
 * network-poll ticks while the backoff is active (≈ "back off to pollMs × 2
 * for one cycle", or longer if the server said so).
 */

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 120_000;
const DEFAULT_BACKOFF_MS = 30_000;

let backoffUntilEpochMs = 0;

/** Record a server rate-limit; polls pause until the window rolls over. */
export function notePollRateLimited(retryAfterMs?: number): void {
  const ms = Math.min(
    Math.max(retryAfterMs ?? DEFAULT_BACKOFF_MS, MIN_BACKOFF_MS),
    MAX_BACKOFF_MS
  );
  backoffUntilEpochMs = Math.max(backoffUntilEpochMs, Date.now() + ms);
}

/** Should recurring network polls skip this tick? */
export function isPollBackoffActive(): boolean {
  return Date.now() < backoffUntilEpochMs;
}

/** Test helper — clears the backoff window. */
export function resetPollBackoff(): void {
  backoffUntilEpochMs = 0;
}
