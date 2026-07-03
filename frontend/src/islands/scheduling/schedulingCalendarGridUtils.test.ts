import { describe, expect, it } from 'vitest';
import {
  buildDayGridFocusCells,
  moveDayGridFocus,
} from './schedulingCalendarGridUtils';
import type { CalendarEvent } from './schedulingTypes';

describe('schedulingCalendarGridUtils', () => {
  it('builds focus cells that skip rowspan continuations', () => {
    const slots = ['09:00', '09:15', '09:30'];
    const providers = [{ id: 10, label: 'Dr A' }];
    const events = new Map<number, CalendarEvent[]>([
      [10, [{
        pc_eid: 1,
        pid: 2,
        pubpid: 'A1',
        patient_name: 'Pat',
        event_date: '2026-06-30',
        start_time: '09:00',
        end_time: '09:30',
        duration_minutes: 30,
        provider_id: 10,
        provider_label: 'Dr A',
        category_id: 1,
        category_label: 'Visit',
        status: '-',
        status_label: 'None',
        is_recurring: false,
        comments: '',
      }]],
    ]);

    const cells = buildDayGridFocusCells(slots, providers, events, 15);
    expect(cells).toHaveLength(2);
    expect(cells[0]).toEqual({ slotIndex: 0, providerIndex: 0 });
    expect(cells[1]).toEqual({ slotIndex: 2, providerIndex: 0 });
  });

  it('moves focus down the provider column', () => {
    const cells = [
      { slotIndex: 0, providerIndex: 0 },
      { slotIndex: 1, providerIndex: 0 },
      { slotIndex: 0, providerIndex: 1 },
    ];
    expect(moveDayGridFocus(cells, 0, 0, 'down')).toEqual({ slotIndex: 1, providerIndex: 0 });
    expect(moveDayGridFocus(cells, 0, 0, 'right')).toEqual({ slotIndex: 0, providerIndex: 1 });
  });
});
