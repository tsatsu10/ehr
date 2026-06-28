import { describe, expect, it } from 'vitest';
import { dueDateFromPreset, todayIsoDate } from './reminderDateUtils';

describe('reminderDateUtils', () => {
  it('computes day presets', () => {
    const base = new Date();
    base.setDate(base.getDate() + 3);
    const expected = [
      base.getFullYear(),
      String(base.getMonth() + 1).padStart(2, '0'),
      String(base.getDate()).padStart(2, '0'),
    ].join('-');

    expect(dueDateFromPreset('3_day')).toBe(expected);
  });

  it('returns null for invalid preset keys', () => {
    expect(dueDateFromPreset('invalid')).toBeNull();
  });

  it('returns today in ISO format', () => {
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
