import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPollBackoffActive, notePollRateLimited, resetPollBackoff } from './pollBackoff';

describe('pollBackoff (SCALE-3.2)', () => {
  afterEach(() => {
    resetPollBackoff();
    vi.useRealTimers();
  });

  it('is inactive by default', () => {
    expect(isPollBackoffActive()).toBe(false);
  });

  it('activates for the server-provided window', () => {
    vi.useFakeTimers();
    notePollRateLimited(5_000);

    expect(isPollBackoffActive()).toBe(true);
    vi.advanceTimersByTime(4_000);
    expect(isPollBackoffActive()).toBe(true);
    vi.advanceTimersByTime(1_100);
    expect(isPollBackoffActive()).toBe(false);
  });

  it('clamps absurd retry_after values to the 120s ceiling', () => {
    vi.useFakeTimers();
    notePollRateLimited(99_999_999);

    vi.advanceTimersByTime(120_500);
    expect(isPollBackoffActive()).toBe(false);
  });

  it('never shortens an already-longer backoff', () => {
    vi.useFakeTimers();
    notePollRateLimited(60_000);
    notePollRateLimited(1_000);

    vi.advanceTimersByTime(30_000);
    expect(isPollBackoffActive()).toBe(true);
  });

  it('falls back to a sane default when no retry_after is given', () => {
    vi.useFakeTimers();
    notePollRateLimited();

    expect(isPollBackoffActive()).toBe(true);
    vi.advanceTimersByTime(30_500);
    expect(isPollBackoffActive()).toBe(false);
  });
});
