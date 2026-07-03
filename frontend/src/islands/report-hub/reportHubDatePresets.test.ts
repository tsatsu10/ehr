import { describe, expect, it, vi } from 'vitest';
import { reportDateRangeForPreset } from './reportHubDatePresets';

describe('reportDateRangeForPreset', () => {
  it('returns single day for today preset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00'));
    const range = reportDateRangeForPreset('today');
    expect(range).toEqual({ from: '2026-06-18', to: '2026-06-18' });
    vi.useRealTimers();
  });

  it('returns Monday through today for this_week preset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T12:00:00'));
    const range = reportDateRangeForPreset('this_week');
    expect(range.from).toBe('2026-06-15');
    expect(range.to).toBe('2026-06-18');
    vi.useRealTimers();
  });
});
