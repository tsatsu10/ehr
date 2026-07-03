import type { CalendarEvent, SchedulingOption } from './schedulingTypes';
import { slotSpan } from './schedulingCalendarUtils';

export interface DayGridFocusCell {
  slotIndex: number;
  providerIndex: number;
}

export function buildDayGridFocusCells(
  slots: string[],
  visibleProviders: SchedulingOption[],
  eventsByProvider: Map<number, CalendarEvent[]>,
  intervalMinutes: number,
): DayGridFocusCell[] {
  const cells: DayGridFocusCell[] = [];
  const coveredByProvider = new Map<number, number>();
  visibleProviders.forEach((_provider, providerIndex) => coveredByProvider.set(providerIndex, 0));

  slots.forEach((slot, slotIndex) => {
    visibleProviders.forEach((provider, providerIndex) => {
      const skip = coveredByProvider.get(providerIndex) ?? 0;
      if (skip > 0) {
        coveredByProvider.set(providerIndex, skip - 1);
        return;
      }
      const event = (eventsByProvider.get(provider.id) ?? []).find((row) => row.start_time === slot);
      const span = event ? slotSpan(event.duration_minutes, intervalMinutes) : 1;
      if (span > 1) {
        coveredByProvider.set(providerIndex, span - 1);
      }
      cells.push({ slotIndex, providerIndex });
    });
  });

  return cells;
}

export function moveDayGridFocus(
  cells: DayGridFocusCell[],
  slotIndex: number,
  providerIndex: number,
  direction: 'up' | 'down' | 'left' | 'right',
): DayGridFocusCell | null {
  if (direction === 'left' || direction === 'right') {
    const row = cells.filter((cell) => cell.slotIndex === slotIndex);
    const pos = row.findIndex(
      (cell) => cell.slotIndex === slotIndex && cell.providerIndex === providerIndex,
    );
    if (pos < 0) {
      return null;
    }
    const nextPos = direction === 'left' ? pos - 1 : pos + 1;
    return row[nextPos] ?? null;
  }

  const column = cells
    .filter((cell) => cell.providerIndex === providerIndex)
    .sort((a, b) => a.slotIndex - b.slotIndex);
  const pos = column.findIndex(
    (cell) => cell.slotIndex === slotIndex && cell.providerIndex === providerIndex,
  );
  if (pos < 0) {
    return null;
  }
  const nextPos = direction === 'up' ? pos - 1 : pos + 1;
  return column[nextPos] ?? null;
}

export function focusDayGridCell(
  table: HTMLTableElement | null,
  slotIndex: number,
  providerIndex: number,
): void {
  if (!table) {
    return;
  }
  const el = table.querySelector<HTMLElement>(
    `[data-grid-slot="${slotIndex}"][data-grid-provider="${providerIndex}"]`,
  );
  el?.focus();
}
