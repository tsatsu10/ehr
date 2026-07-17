export type CalendarLayout = 'agenda' | 'day' | 'week' | 'month';

export function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO ('YYYY-MM-DD') -> regional display ('DD/MM/YYYY'). Returns the input unchanged if it isn't ISO-shaped. */
export function formatDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return d && m && y && /^\d{4}$/.test(y) && /^\d{2}$/.test(m) && /^\d{2}$/.test(d)
    ? `${d}/${m}/${y}`
    : isoDate;
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

/**
 * Time-grid slot labels between the clinic's open and close hour (defaults
 * 08–18 when the payload doesn't carry them). Clamped so bad config can't
 * produce an empty or runaway grid.
 */
export function buildTimeSlots(intervalMinutes: number, openHour = 8, closeHour = 18): string[] {
  const open = Math.max(0, Math.min(23, Math.floor(openHour)));
  const close = Math.max(open + 1, Math.min(24, Math.floor(closeHour)));
  const step = Math.max(5, intervalMinutes);
  const slots: string[] = [];
  for (let minutes = open * 60; minutes < close * 60; minutes += step) {
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

export type DateStepUnit = 'day' | 'week' | 'month';

/** Today as local Y-m-d (toISOString would shift across the UTC boundary). */
export function localTodayIso(): string {
  return formatDateYmd(new Date());
}

/**
 * Step an ISO date by one unit. Month steps clamp the day-of-month to the
 * target month's length (31 Jan -> 28 Feb), matching how people page a
 * month calendar.
 */
export function shiftDate(dateIso: string, unit: DateStepUnit, direction: 1 | -1): string {
  const date = new Date(`${dateIso}T12:00:00`);
  if (unit === 'day') {
    date.setDate(date.getDate() + direction);
  } else if (unit === 'week') {
    date.setDate(date.getDate() + 7 * direction);
  } else {
    const dayOfMonth = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(dayOfMonth, lastDay));
  }
  return formatDateYmd(date);
}

/**
 * Provider wayfinding accents for multi-provider calendar views — cycles the
 * seven existing role accents (tokens.css) by the provider's position in the
 * visible list, so no new colors enter the system. Only meaningful when more
 * than one provider is on screen; single-provider views stay accent-free.
 */
const PROVIDER_ACCENT_VARS = [
  '--oe-nc-role-reception',
  '--oe-nc-role-nurse',
  '--oe-nc-role-doctor',
  '--oe-nc-role-lab',
  '--oe-nc-role-pharmacy',
  '--oe-nc-role-cashier',
  '--oe-nc-role-admin',
] as const;

export function providerAccentVar(providerId: number, orderedProviderIds: number[]): string {
  const index = Math.max(0, orderedProviderIds.indexOf(providerId));
  return `var(${PROVIDER_ACCENT_VARS[index % PROVIDER_ACCENT_VARS.length]})`;
}

/**
 * Resolved calendar colour for a provider: the server-provided colour (admin
 * pick or palette default) when present, else the local role-accent cycle as
 * a safety fallback. One call the calendar uses everywhere it draws a
 * provider rail/dot.
 */
export function providerColor(
  providerId: number,
  colors: Record<number, string> | undefined,
  orderedProviderIds: number[],
): string {
  return colors?.[providerId] ?? providerAccentVar(providerId, orderedProviderIds);
}

/**
 * Chip fill colour for an appointment, by its visit type. Blocks and events
 * that don't map to a current visit type (visit_type_id 0/undefined) fall back
 * to a neutral grey so they read as "other", not mis-coloured as a real type.
 */
export function visitTypeColor(
  visitTypeId: number | undefined,
  colors: Record<number, string> | undefined,
): string {
  if (visitTypeId && colors?.[visitTypeId]) {
    return colors[visitTypeId];
  }
  return 'var(--oe-nc-text-muted, #6e6e73)';
}

export interface PeekAnchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Position the peek card next to the clicked event: below it by default,
 * flipped above when there isn't room, and clamped to the viewport on both
 * axes so it's never partly off-screen (a click deep in a month grid or near
 * an edge still lands fully in view). Coordinates are viewport-relative
 * (the card is position:fixed).
 */
export function positionPeek(
  anchor: PeekAnchor,
  cardWidth: number,
  cardHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  gap = 8,
  margin = 8,
): { top: number; left: number } {
  const spaceBelow = viewportHeight - (anchor.top + anchor.height);
  const preferred = spaceBelow >= cardHeight + gap || spaceBelow >= anchor.top
    ? anchor.top + anchor.height + gap
    : anchor.top - cardHeight - gap;

  // Clamp to the viewport on both axes so the card is always fully visible —
  // even when the clicked event has scrolled off-screen in a tall grid.
  const maxTop = Math.max(margin, viewportHeight - cardHeight - margin);
  const top = Math.min(Math.max(margin, preferred), maxTop);

  const maxLeft = Math.max(margin, viewportWidth - cardWidth - margin);
  const left = Math.min(Math.max(margin, anchor.left), maxLeft);

  return { top, left };
}

export function defaultCalendarLayout(): CalendarLayout {
  return 'agenda';
}

const CALENDAR_VIEW_KEY = 'nc-scheduling-calendar-view';
const CALENDAR_LAYOUTS: readonly CalendarLayout[] = ['agenda', 'day', 'week', 'month'];

/** The user's last-used calendar view, or null if none/invalid stored. */
export function readStoredCalendarLayout(): CalendarLayout | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(CALENDAR_VIEW_KEY);
    return stored && (CALENDAR_LAYOUTS as readonly string[]).includes(stored)
      ? (stored as CalendarLayout)
      : null;
  } catch {
    return null;
  }
}

export function storeCalendarLayout(layout: CalendarLayout): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(CALENDAR_VIEW_KEY, layout);
  } catch {
    // localStorage can throw (private mode / quota) — the view just won't persist.
  }
}

export function isCalendarUnchanged(
  payload: { unchanged?: boolean; revision?: string; poll_interval_ms?: number },
): payload is { unchanged: true; revision: string; poll_interval_ms: number } {
  return payload.unchanged === true;
}
