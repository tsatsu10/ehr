import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { CalendarDayPayload, CalendarEvent, SchedulingOption } from './schedulingTypes';
import {
  buildTimeSlots,
  monthGridDates,
  providerColor,
  slotSpan,
  visitTypeColor,
  weekDates,
  type PeekAnchor,
} from './schedulingCalendarUtils';
import {
  buildDayGridFocusCells,
  focusDayGridCell,
  moveDayGridFocus,
} from './schedulingCalendarGridUtils';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Short weekday label for a Y-m-d string (local calendar day, no TZ shift). */
function weekdayLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  return WEEKDAY_LABELS[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()] ?? '';
}

/** Today as local Y-m-d (toISOString would shift across the UTC boundary). */
function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Pixel offset of "now" within the time grid, or null when off-grid/inactive. */
function computeNowTop(
  container: HTMLElement | null,
  active: boolean,
  slots: string[],
  intervalMinutes: number,
): number | null {
  if (!container || !active || slots.length === 0) {
    return null;
  }
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = slots[0].split(':').map(Number);
  const startMins = sh * 60 + sm;
  const [eh, em] = slots[slots.length - 1].split(':').map(Number);
  const endMins = eh * 60 + em + intervalMinutes;
  if (mins < startMins || mins >= endMins) {
    return null;
  }
  const idx = Math.floor((mins - startMins) / intervalMinutes);
  const row = container.querySelector<HTMLElement>(`tr[data-slot="${slots[idx]}"]`);
  if (!row) {
    return null;
  }
  const frac = ((mins - startMins) % intervalMinutes) / intervalMinutes;
  return (row.getBoundingClientRect().top - container.getBoundingClientRect().top)
    + frac * row.getBoundingClientRect().height;
}

/** Live "now"-line position — recomputes on layout changes and every minute. */
function useNowLine(
  active: boolean,
  slots: string[],
  intervalMinutes: number,
  revalidateKey: unknown,
): [React.RefObject<HTMLDivElement | null>, number | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    setTop(computeNowTop(ref.current, active, slots, intervalMinutes));
  }, [active, slots, intervalMinutes, revalidateKey]);
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setTop(computeNowTop(ref.current, active, slots, intervalMinutes));
    }, 60000);
    return () => window.clearInterval(id);
  }, [active, slots, intervalMinutes]);
  return [ref, top];
}

interface GridProps {
  data: CalendarDayPayload;
  visibleProviders: SchedulingOption[];
  canBook: boolean;
  onSelectEvent: (event: CalendarEvent, anchor?: PeekAnchor) => void;
  onBookSlot: (draft: { date: string; time: string; providerId: number }) => void;
  onMoveEvent: (pcEid: number, date: string, time: string, providerId: number) => void;
  onResizeEvent: (event: CalendarEvent, durationMinutes: number) => void;
}

export function CalendarDayGrid({
  data,
  visibleProviders,
  canBook,
  onSelectEvent,
  onBookSlot,
  onMoveEvent,
  onResizeEvent,
}: GridProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const slots = useMemo(
    () => buildTimeSlots(data.interval_minutes, data.open_hour, data.close_hour),
    [data.interval_minutes, data.open_hour, data.close_hour],
  );
  const eventsByProvider = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const event of data.events) {
      if (event.event_date !== data.date) {
        continue;
      }
      const list = map.get(event.provider_id) ?? [];
      list.push(event);
      map.set(event.provider_id, list);
    }
    return map;
  }, [data.date, data.events]);

  const coveredByProvider = new Map<number, number>();
  visibleProviders.forEach((provider) => coveredByProvider.set(provider.id, 0));

  const focusCells = useMemo(
    () => buildDayGridFocusCells(slots, visibleProviders, eventsByProvider, data.interval_minutes),
    [slots, visibleProviders, eventsByProvider, data.interval_minutes],
  );

  const providerIds = useMemo(() => visibleProviders.map((p) => p.id), [visibleProviders]);
  const multiProvider = visibleProviders.length > 1;
  const [nowRef, nowTop] = useNowLine(data.date === localTodayIso(), slots, data.interval_minutes, data.events);

  const handleGridKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return;
    }
    const target = event.target as HTMLElement;
    const slotAttr = target.getAttribute('data-grid-slot');
    const providerAttr = target.getAttribute('data-grid-provider');
    if (slotAttr == null || providerAttr == null) {
      return;
    }
    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? 'up'
      : event.key === 'ArrowDown' ? 'down'
        : event.key === 'ArrowLeft' ? 'left' : 'right';
    const next = moveDayGridFocus(
      focusCells,
      Number(slotAttr),
      Number(providerAttr),
      direction,
    );
    if (next) {
      focusDayGridCell(tableRef.current, next.slotIndex, next.providerIndex);
    }
  }, [focusCells]);

  return (
    <div className="nc-calendar-day overflow-x-auto" ref={nowRef} style={{ position: 'relative' }}>
      {nowTop != null && <div className="nc-calendar-now-line" style={{ top: nowTop }} aria-hidden="true" />}
      <Table
        ref={tableRef}
        className={ncShadcnTableClass({ className: 'nc-calendar-grid nc-calendar-day-table mb-0' })}
        role="grid"
        onKeyDown={handleGridKeyDown}
      >
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="nc-calendar-day-time-col">Time</TableHead>
            {visibleProviders.map((provider) => (
              <TableHead key={provider.id} scope="col">
                {multiProvider && (
                  <span
                    className="nc-provider-dot"
                    style={{ background: providerColor(provider.id, data.provider_colors, providerIds) }}
                    aria-hidden="true"
                  />
                )}
                {provider.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((slot, slotIndex) => (
            <TableRow key={slot} data-slot={slot} className={slot.endsWith(':00') ? 'nc-calendar-row-hour' : undefined}>
              <TableHead scope="row" className="nc-calendar-day-time-col nc-calendar-time-label">
                <span>{slot.endsWith(':00') ? slot : ''}</span>
              </TableHead>
              {visibleProviders.map((provider, providerIndex) => {
                const skip = coveredByProvider.get(provider.id) ?? 0;
                if (skip > 0) {
                  coveredByProvider.set(provider.id, skip - 1);
                  return null;
                }
                // All events starting at this provider+slot — a double-booked
                // slot renders both stacked instead of hiding one.
                const cellEvents = (eventsByProvider.get(provider.id) ?? []).filter(
                  (row) => row.start_time === slot,
                );
                const span = cellEvents.length
                  ? Math.max(...cellEvents.map((e) => slotSpan(e.duration_minutes, data.interval_minutes)))
                  : 1;
                if (span > 1) {
                  coveredByProvider.set(provider.id, span - 1);
                }
                return (
                  <CalendarGridCell
                    key={`${provider.id}-${slot}`}
                    date={data.date}
                    slot={slot}
                    slotIndex={slotIndex}
                    providerIndex={providerIndex}
                    providerId={provider.id}
                    events={cellEvents}
                    rowSpan={span}
                    intervalMinutes={data.interval_minutes}
                    canBook={canBook}
                    visitTypeColors={data.visit_type_colors}
                    onSelectEvent={onSelectEvent}
                    onBookSlot={onBookSlot}
                    onMoveEvent={onMoveEvent}
                    onResizeEvent={onResizeEvent}
                  />
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CalendarWeekGrid({
  data,
  visibleProviders,
  canBook,
  onSelectEvent,
  onBookSlot,
  onMoveEvent,
}: Omit<GridProps, 'onResizeEvent'>) {
  const dates = useMemo(() => weekDates(data.anchor_date ?? data.date), [data.anchor_date, data.date]);
  const slots = useMemo(
    () => buildTimeSlots(data.interval_minutes, data.open_hour, data.close_hour),
    [data.interval_minutes, data.open_hour, data.close_hour],
  );
  const providers = useMemo(
    () => (visibleProviders.length > 0 ? visibleProviders : [{ id: 0, label: 'All' }]),
    [visibleProviders],
  );
  const weekColumns = useMemo(
    () => dates.flatMap((date) => providers.map((provider) => ({ date, provider }))),
    [dates, providers],
  );
  const eventsByCell = useMemo(() => {
    // Array per cell — two appointments at the same day+provider+time both show
    // instead of one silently overwriting the other in the Map.
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data.events) {
      const key = `${event.event_date}|${event.provider_id}|${event.start_time}`;
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [data.events]);

  const coveredCells = new Map<string, number>();
  weekColumns.forEach(({ date, provider }) => {
    coveredCells.set(`${date}|${provider.id}`, 0);
  });

  // Console 26 week header: weekday label + date number, today circled in the
  // accent color (artifact cal-daycol-head). The provider sub-row only renders
  // when more than one provider column is visible — the single-doctor default
  // reads as a clean calendar, not a rostering grid.
  const todayIso = localTodayIso();
  const showProviderRow = providers.length > 1;
  const weekProviderIds = providers.map((p) => p.id);
  const [nowRef, nowTop] = useNowLine(dates.includes(todayIso), slots, data.interval_minutes, data.events);

  return (
    <div className="nc-calendar-week overflow-x-auto" ref={nowRef} style={{ position: 'relative' }}>
      {nowTop != null && <div className="nc-calendar-now-line" style={{ top: nowTop }} aria-hidden="true" />}
      <Table className={ncShadcnTableClass({ className: 'nc-calendar-grid nc-calendar-week-table mb-0' })}>
        <TableHeader>
          <TableRow>
            <TableHead className="nc-calendar-day-time-col" rowSpan={showProviderRow ? 2 : 1}>Time</TableHead>
            {dates.map((date) => (
              <TableHead
                key={date}
                scope="colgroup"
                colSpan={Math.max(providers.length, 1)}
                className="nc-calendar-dowhead"
              >
                <span className="nc-calendar-dow">{weekdayLabel(date)}</span>
                <span className={`nc-calendar-dom${date === todayIso ? ' nc-calendar-dom--today' : ''}`}>
                  {Number(date.slice(8, 10))}
                </span>
              </TableHead>
            ))}
          </TableRow>
          {showProviderRow && (
            <TableRow>
              {dates.flatMap((date) => (
                providers.map((provider) => (
                  <TableHead key={`${date}-${provider.id}`} scope="col" className="text-sm">
                    <span
                      className="nc-provider-dot"
                      style={{ background: providerColor(provider.id, data.provider_colors, weekProviderIds) }}
                      aria-hidden="true"
                    />
                    {provider.label}
                  </TableHead>
                ))
              ))}
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {slots.map((slot) => (
            <TableRow key={slot} data-slot={slot} className={slot.endsWith(':00') ? 'nc-calendar-row-hour' : undefined}>
              <TableHead scope="row" className="nc-calendar-day-time-col nc-calendar-time-label">
                <span>{slot.endsWith(':00') ? slot : ''}</span>
              </TableHead>
              {weekColumns.map(({ date, provider }) => {
                const cellKey = `${date}|${provider.id}`;
                const skip = coveredCells.get(cellKey) ?? 0;
                if (skip > 0) {
                  coveredCells.set(cellKey, skip - 1);
                  return null;
                }
                const cellEvents = eventsByCell.get(`${date}|${provider.id}|${slot}`) ?? [];
                const span = cellEvents.length
                  ? Math.max(...cellEvents.map((e) => slotSpan(e.duration_minutes, data.interval_minutes)))
                  : 1;
                if (span > 1) {
                  coveredCells.set(cellKey, span - 1);
                }
                return (
                  <CalendarGridCell
                    key={`${date}-${provider.id}-${slot}`}
                    date={date}
                    slot={slot}
                    slotIndex={0}
                    providerIndex={0}
                    providerId={provider.id}
                    events={cellEvents}
                    rowSpan={span}
                    intervalMinutes={data.interval_minutes}
                    canBook={canBook}
                    visitTypeColors={data.visit_type_colors}
                    onSelectEvent={onSelectEvent}
                    onBookSlot={onBookSlot}
                    onMoveEvent={onMoveEvent}
                    onResizeEvent={() => {}}
                    compact
                  />
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CalendarMonthGrid({
  data,
  canBook,
  onSelectEvent,
  onMoveEvent,
}: Pick<GridProps, 'data' | 'canBook' | 'onSelectEvent' | 'onMoveEvent'>) {
  const dates = useMemo(() => monthGridDates(data.anchor_date ?? data.date), [data.anchor_date, data.date]);
  const monthPrefix = (data.anchor_date ?? data.date).slice(0, 7);
  const todayIso = localTodayIso();
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data.events) {
      const list = map.get(event.event_date) ?? [];
      list.push(event);
      map.set(event.event_date, list);
    }
    return map;
  }, [data.events]);

  return (
    <div className="nc-calendar-month">
      <div className="nc-calendar-month-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label} className="nc-calendar-month-dow text-[var(--oe-nc-text-muted)] text-sm">{label}</div>
        ))}
        {dates.map((date) => {
          const inMonth = date.startsWith(monthPrefix);
          const dayEvents = eventsByDate.get(date) ?? [];
          return (
            <div
              key={date}
              className={`nc-calendar-month-cell${inMonth ? '' : ' nc-calendar-month-cell--muted'}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(dropEvent) => {
                dropEvent.preventDefault();
                const pcEid = Number(dropEvent.dataTransfer.getData('text/plain'));
                if (pcEid > 0) {
                  onMoveEvent(pcEid, date, '', data.provider_id ?? 0);
                }
              }}
            >
              <div className={`nc-calendar-month-date text-sm${date === todayIso ? ' nc-calendar-month-date--today' : ''}`}>
                {Number(date.slice(8))}
              </div>
              {dayEvents.slice(0, 3).map((event) => {
                const color = visitTypeColor(event.visit_type_id, data.visit_type_colors);
                return (
                  <Button
                    key={event.pc_eid}
                    type="button"
                    variant="link"
                    size="sm"
                    className={`nc-calendar-month-event h-auto p-0 text-left${event.is_block ? ' nc-calendar-month-event--block' : ''}`}
                    // Tinted fill + accent bar by visit type, matching the
                    // day/week/agenda chips so month bookings read the same.
                    style={{
                      background: `color-mix(in srgb, ${color} 16%, white)`,
                      borderLeft: `3px solid ${color}`,
                    }}
                    // Month pills are dense; the visit type is only colour here,
                    // so carry it (+ time/name) in the title for hover + SR.
                    title={event.category_label
                      ? `${event.start_time} ${event.patient_name} — ${event.category_label}`
                      : `${event.start_time} ${event.patient_name}`}
                    draggable={canBook && !event.is_block}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(event.pc_eid));
                    }}
                    onClick={(e) => onSelectEvent(event, e.currentTarget.getBoundingClientRect())}
                  >
                    {event.start_time}
                    {' '}
                    {event.patient_name}
                  </Button>
                );
              })}
              {dayEvents.length > 3 && (
                <span className="text-[var(--oe-nc-text-muted)] text-sm">
                  +
                  {dayEvents.length - 3}
                  {' '}
                  more
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarGridCell({
  date,
  slot,
  slotIndex,
  providerIndex,
  providerId,
  events,
  rowSpan = 1,
  intervalMinutes,
  canBook,
  visitTypeColors,
  onSelectEvent,
  onBookSlot,
  onMoveEvent,
  onResizeEvent,
  compact = false,
}: {
  date: string;
  slot: string;
  slotIndex: number;
  providerIndex: number;
  providerId: number;
  /** All appointments starting in this slot — >1 means a double-booked slot. */
  events: CalendarEvent[];
  rowSpan?: number;
  intervalMinutes: number;
  canBook: boolean;
  visitTypeColors?: Record<number, string>;
  onSelectEvent: (event: CalendarEvent, anchor?: PeekAnchor) => void;
  onBookSlot: (draft: { date: string; time: string; providerId: number }) => void;
  onMoveEvent: (pcEid: number, date: string, time: string, providerId: number) => void;
  onResizeEvent: (event: CalendarEvent, durationMinutes: number) => void;
  compact?: boolean;
}) {
  const [resizing, setResizing] = useState(false);
  const gridFocusProps = compact
    ? {}
    : {
      'data-grid-slot': slotIndex,
      'data-grid-provider': providerIndex,
    };
  // Resize only makes sense for a single, non-block appointment in the slot.
  const soleEvent = events.length === 1 && !events[0].is_block ? events[0] : null;

  const handleResizeStart = useCallback((startEvent: React.MouseEvent) => {
    if (!soleEvent) {
      return;
    }
    startEvent.preventDefault();
    startEvent.stopPropagation();
    setResizing(true);
    const startY = startEvent.clientY;
    const startDuration = soleEvent.duration_minutes;

    const onMove = (moveEvent: MouseEvent) => {
      const deltaSlots = Math.round((moveEvent.clientY - startY) / 24);
      const nextDuration = Math.max(intervalMinutes, startDuration + deltaSlots * intervalMinutes);
      if (nextDuration !== soleEvent.duration_minutes) {
        onResizeEvent(soleEvent, nextDuration);
      }
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [soleEvent, intervalMinutes, onResizeEvent]);

  return (
    <TableCell
      className={`nc-calendar-day-cell p-1${resizing ? ' nc-calendar-day-cell--resizing' : ''}`}
      rowSpan={rowSpan > 1 ? rowSpan : undefined}
      style={!compact && rowSpan > 1 ? { height: `${rowSpan * 2.5}rem` } : undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const pcEid = Number(e.dataTransfer.getData('text/plain'));
        if (pcEid > 0) {
          onMoveEvent(pcEid, date, slot, providerId > 0 ? providerId : 0);
        }
      }}
    >
      {events.length > 0 ? (
        <div className="nc-calendar-day-cell-stack">
          {events.map((event, index) => {
            const color = visitTypeColor(event.visit_type_id, visitTypeColors);
            return (
              <div key={event.pc_eid} className="nc-calendar-day-event-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={`nc-calendar-day-event h-auto w-full justify-start text-left font-normal${event.is_block ? ' nc-calendar-day-event--block' : ''}`}
                  style={{
                    background: `color-mix(in srgb, ${color} 16%, white)`,
                    borderLeft: `4px solid ${color}`,
                  }}
                  // Full detail on hover — matters most in the narrow week columns
                  // where the type line is hidden to keep chips one-line.
                  title={event.category_label ? `${event.patient_name} — ${event.category_label}` : event.patient_name}
                  draggable={canBook && !event.is_block}
                  {...(index === 0 ? gridFocusProps : {})}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(event.pc_eid));
                  }}
                  onClick={(e) => onSelectEvent(event, e.currentTarget.getBoundingClientRect())}
                >
                  <strong className="nc-calendar-day-event-name">{event.patient_name}</strong>
                  {!compact && !event.is_block && event.category_label && (
                    <span className="nc-calendar-day-event-cat">{event.category_label}</span>
                  )}
                </Button>
                {!compact && soleEvent && (
                  <div
                    className="nc-calendar-day-resize-handle"
                    role="separator"
                    aria-label={`Resize ${event.patient_name} appointment`}
                    onMouseDown={handleResizeStart}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : canBook ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="nc-calendar-day-slot h-auto w-full text-[var(--oe-nc-text-muted)]"
          aria-label={`Book appointment at ${slot} on ${date}`}
          {...gridFocusProps}
          onClick={() => onBookSlot({ date, time: slot, providerId: providerId > 0 ? providerId : 0 })}
        >
          <span aria-hidden="true">+</span>
        </Button>
      ) : null}
    </TableCell>
  );
}
