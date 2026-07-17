import { describe, expect, it } from 'vitest';
import {
  addMinutesToTime,
  buildTimeSlots,
  formatDateDisplay,
  isCalendarUnchanged,
  monthGridDates,
  positionPeek,
  shiftDate,
  slotSpan,
  weekDates,
} from './schedulingCalendarUtils';

describe('schedulingCalendarUtils', () => {
  it('formats an ISO date as DD/MM/YYYY', () => {
    expect(formatDateDisplay('2026-07-15')).toBe('15/07/2026');
  });

  it('returns non-ISO input unchanged', () => {
    expect(formatDateDisplay('')).toBe('');
    expect(formatDateDisplay('not-a-date')).toBe('not-a-date');
  });

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

  it('shifts dates by day, week, and month', () => {
    expect(shiftDate('2026-07-16', 'day', 1)).toBe('2026-07-17');
    expect(shiftDate('2026-07-16', 'day', -1)).toBe('2026-07-15');
    expect(shiftDate('2026-07-16', 'week', 1)).toBe('2026-07-23');
    expect(shiftDate('2026-07-16', 'month', 1)).toBe('2026-08-16');
    expect(shiftDate('2026-01-01', 'day', -1)).toBe('2025-12-31');
  });

  it('clamps the day of month when stepping into a shorter month', () => {
    expect(shiftDate('2026-01-31', 'month', 1)).toBe('2026-02-28');
    expect(shiftDate('2026-03-31', 'month', -1)).toBe('2026-02-28');
    expect(shiftDate('2028-01-31', 'month', 1)).toBe('2028-02-29');
  });

  it('positions the peek below an event with room, clamped to the viewport', () => {
    // Event near top-left, plenty of room below.
    const pos = positionPeek({ top: 100, left: 50, width: 120, height: 24 }, 320, 200, 1024, 768);
    expect(pos.top).toBe(132); // 100 + 24 + 8 gap
    expect(pos.left).toBe(50);
  });

  it('flips the peek above the event when there is no room below', () => {
    // Event near the bottom edge.
    const pos = positionPeek({ top: 700, left: 900, width: 120, height: 24 }, 320, 200, 1024, 768);
    expect(pos.top).toBe(700 - 200 - 8); // flipped above
    expect(pos.left).toBe(1024 - 320 - 8); // clamped off the right edge
  });

  it('keeps the peek fully on screen when the event is below the fold', () => {
    // Event at top:680 in a 549-tall viewport (scrolled off); card 149 tall.
    const pos = positionPeek({ top: 680, left: 419, width: 120, height: 44 }, 320, 149, 1024, 549);
    expect(pos.top + 149).toBeLessThanOrEqual(549); // bottom within viewport
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  it('detects unchanged calendar poll payloads', () => {
    expect(isCalendarUnchanged({
      unchanged: true,
      revision: 'rev',
      poll_interval_ms: 30000,
    })).toBe(true);
  });
});
