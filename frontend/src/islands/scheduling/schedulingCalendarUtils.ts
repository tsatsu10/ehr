export type CalendarLayout = 'agenda' | 'day' | 'week' | 'month';

export function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function weekDates(anchor: string): string[] {
  const anchorDate = new Date(`${anchor}T12:00:00`);
  const weekday = anchorDate.getDay();
  const diffToMonday = (weekday + 6) % 7;
  const monday = new Date(anchorDate);
  monday.setDate(anchorDate.getDate() - diffToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    dates.push(formatDateYmd(day));
  }
  return dates;
}

export function monthGridDates(anchor: string): string[] {
  const anchorDate = new Date(`${anchor}T12:00:00`);
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startPad);

  const dates: string[] = [];
  const totalCells = Math.ceil((startPad + last.getDate()) / 7) * 7;
  for (let i = 0; i < totalCells; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    dates.push(formatDateYmd(day));
  }
  return dates;
}

export function buildTimeSlots(intervalMinutes: number): string[] {
  const slots: string[] = [];
  for (let minutes = 8 * 60; minutes < 18 * 60; minutes += intervalMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    slots.push(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
  }
  return slots;
}

export function slotSpan(durationMinutes: number, intervalMinutes: number): number {
  return Math.max(1, Math.round(durationMinutes / intervalMinutes));
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function defaultCalendarLayout(): CalendarLayout {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
    return 'agenda';
  }
  return 'agenda';
}

export function isCalendarUnchanged(
  payload: { unchanged?: boolean; revision?: string; poll_interval_ms?: number },
): payload is { unchanged: true; revision: string; poll_interval_ms: number } {
  return payload.unchanged === true;
}
