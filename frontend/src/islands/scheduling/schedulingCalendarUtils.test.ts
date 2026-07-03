import { describe, expect, it } from 'vitest';
import {
  addMinutesToTime,
  buildTimeSlots,
  isCalendarUnchanged,
  monthGridDates,
  slotSpan,
  weekDates,
} from './schedulingCalendarUtils';

describe('schedulingCalendarUtils', () => {
  it('builds a Monday-first week for an anchor date', () => {
    expect(weekDates('2026-06-30')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ]);
  });

  it('pads month grid to full weeks', () => {
    const cells = monthGridDates('2026-06-30');
    expect(cells.length % 7).toBe(0);
    expect(cells).toContain('2026-06-30');
  });

  it('builds 15-minute slots between 08:00 and 18:00', () => {
    const slots = buildTimeSlots(15);
    expect(slots[0]).toBe('08:00');
    expect(slots.at(-1)).toBe('17:45');
  });

  it('computes slot span and adds minutes to time', () => {
    expect(slotSpan(30, 15)).toBe(2);
    expect(addMinutesToTime('09:00', 30)).toBe('09:30');
  });

  it('detects unchanged calendar poll payloads', () => {
    expect(isCalendarUnchanged({
      unchanged: true,
      revision: 'rev',
      poll_interval_ms: 30000,
    })).toBe(true);
  });
});
