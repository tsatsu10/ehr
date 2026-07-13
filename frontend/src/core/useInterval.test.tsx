import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInterval } from './useInterval';
import { notePollRateLimited, resetPollBackoff } from './pollBackoff';

describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetPollBackoff();
    vi.useRealTimers();
  });

  it('fires the callback on each interval tick', () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, 1_000));

    // Jitter is ±10%, so 1.2s guarantees at least one tick.
    vi.advanceTimersByTime(1_200);
    expect(cb).toHaveBeenCalled();
  });

  it('skips ticks while a poll backoff is active (SCALE-3.2)', () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, 1_000));

    notePollRateLimited(10_000);
    vi.advanceTimersByTime(3_600);
    expect(cb).not.toHaveBeenCalled();

    // Backoff over → polling resumes on the next tick.
    vi.advanceTimersByTime(8_000);
    expect(cb).toHaveBeenCalled();
  });

  it('client-only ticks opt out of the backoff', () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, 1_000, { respectPollBackoff: false }));

    notePollRateLimited(10_000);
    vi.advanceTimersByTime(1_200);
    expect(cb).toHaveBeenCalled();
  });

  it('pauses entirely when delay is null', () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, null));

    vi.advanceTimersByTime(10_000);
    expect(cb).not.toHaveBeenCalled();
  });
});
