import { useCallback, useMemo, useRef, useState } from 'react';
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
  slotSpan,
  weekDates,
} from './schedulingCalendarUtils';
import {
  buildDayGridFocusCells,
  focusDayGridCell,
  moveDayGridFocus,
} from './schedulingCalendarGridUtils';

interface GridProps {
  data: CalendarDayPayload;
  visibleProviders: SchedulingOption[];
  canBook: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
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
  const slots = useMemo(() => buildTimeSlots(data.interval_minutes), [data.interval_minutes]);
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
    <div className="nc-calendar-day overflow-x-auto">
      <Table
        ref={tableRef}
        className={ncShadcnTableClass({ bordered: true, className: 'nc-calendar-day-table mb-0' })}
        role="grid"
        onKeyDown={handleGridKeyDown}
      >
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="nc-calendar-day-time-col">Time</TableHead>
            {visibleProviders.map((provider) => (
              <TableHead key={provider.id} scope="col">{provider.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((slot, slotIndex) => (
            <TableRow key={slot}>
              <TableHead scope="row" className="text-[var(--oe-nc-text-muted)] text-sm nc-calendar-day-time-col">{slot}</TableHead>
              {visibleProviders.map((provider, providerIndex) => {
                const skip = coveredByProvider.get(provider.id) ?? 0;
                if (skip > 0) {
                  coveredByProvider.set(provider.id, skip - 1);
                  return null;
                }
                const event = (eventsByProvider.get(provider.id) ?? []).find(
                  (row) => row.start_time === slot,
                );
                const span = event ? slotSpan(event.duration_minutes, data.interval_minutes) : 1;
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
                    event={event}
                    rowSpan={span}
                    intervalMinutes={data.interval_minutes}
                    canBook={canBook}
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
  const slots = useMemo(() => buildTimeSlots(data.interval_minutes), [data.interval_minutes]);
  const providers = useMemo(
    () => (visibleProviders.length > 0 ? visibleProviders : [{ id: 0, label: 'All' }]),
    [visibleProviders],
  );
  const weekColumns = useMemo(
    () => dates.flatMap((date) => providers.map((provider) => ({ date, provider }))),
    [dates, providers],
  );
  const eventsByCell = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const event of data.events) {
      map.set(`${event.event_date}|${event.provider_id}|${event.start_time}`, event);
    }
    return map;
  }, [data.events]);

  const coveredCells = new Map<string, number>();
  weekColumns.forEach(({ date, provider }) => {
    coveredCells.set(`${date}|${provider.id}`, 0);
  });

  return (
    <div className="nc-calendar-week overflow-x-auto">
      <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
        <TableHeader>
          <TableRow>
            <TableHead className="nc-calendar-day-time-col" rowSpan={2}>Time</TableHead>
            {dates.map((date) => (
              <TableHead key={date} scope="colgroup" colSpan={Math.max(providers.length, 1)}>
                {date.slice(5)}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            {dates.flatMap((date) => (
              providers.map((provider) => (
                <TableHead key={`${date}-${provider.id}`} scope="col" className="text-sm">
                  {provider.label}
                </TableHead>
              ))
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((slot) => (
            <TableRow key={slot}>
              <TableHead scope="row" className="text-[var(--oe-nc-text-muted)] text-sm nc-calendar-day-time-col">{slot}</TableHead>
              {weekColumns.map(({ date, provider }) => {
                const cellKey = `${date}|${provider.id}`;
                const skip = coveredCells.get(cellKey) ?? 0;
                if (skip > 0) {
                  coveredCells.set(cellKey, skip - 1);
                  return null;
                }
                const event = eventsByCell.get(`${date}|${provider.id}|${slot}`);
                const span = event ? slotSpan(event.duration_minutes, data.interval_minutes) : 1;
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
                    event={event}
                    rowSpan={span}
                    intervalMinutes={data.interval_minutes}
                    canBook={canBook}
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
              <div className="nc-calendar-month-date text-sm">{Number(date.slice(8))}</div>
              {dayEvents.slice(0, 3).map((event) => (
                <Button
                  key={event.pc_eid}
                  type="button"
                  variant="link"
                  size="sm"
                  className="nc-calendar-month-event h-auto p-0 text-left"
                  draggable={canBook}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(event.pc_eid));
                  }}
                  onClick={() => onSelectEvent(event)}
                >
                  {event.start_time}
                  {' '}
                  {event.patient_name}
                </Button>
              ))}
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
  event,
  rowSpan = 1,
  intervalMinutes,
  canBook,
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
  event?: CalendarEvent;
  rowSpan?: number;
  intervalMinutes: number;
  canBook: boolean;
  onSelectEvent: (event: CalendarEvent) => void;
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

  const handleResizeStart = useCallback((startEvent: React.MouseEvent) => {
    if (!event) {
      return;
    }
    startEvent.preventDefault();
    startEvent.stopPropagation();
    setResizing(true);
    const startY = startEvent.clientY;
    const startDuration = event.duration_minutes;

    const onMove = (moveEvent: MouseEvent) => {
      const deltaSlots = Math.round((moveEvent.clientY - startY) / 24);
      const nextDuration = Math.max(intervalMinutes, startDuration + deltaSlots * intervalMinutes);
      if (nextDuration !== event.duration_minutes) {
        onResizeEvent(event, nextDuration);
      }
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [event, intervalMinutes, onResizeEvent]);

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
      {event ? (
        <div className="nc-calendar-day-event-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="nc-calendar-day-event h-auto w-full justify-start text-left font-normal"
            draggable={canBook}
            {...gridFocusProps}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', String(event.pc_eid));
            }}
            onClick={() => onSelectEvent(event)}
          >
            <strong className="block text-sm">{event.patient_name}</strong>
            {!compact && (
              <span className="text-[var(--oe-nc-text-muted)] text-sm">{event.category_label}</span>
            )}
          </Button>
          {!compact && (
            <div
              className="nc-calendar-day-resize-handle"
              role="separator"
              aria-label={`Resize ${event.patient_name} appointment`}
              onMouseDown={handleResizeStart}
            />
          )}
        </div>
      ) : canBook && providerId > 0 ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="nc-calendar-day-slot h-auto w-full text-[var(--oe-nc-text-muted)]"
          {...gridFocusProps}
          onClick={() => onBookSlot({ date, time: slot, providerId })}
        >
          +
        </Button>
      ) : canBook ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="nc-calendar-day-slot h-auto w-full text-[var(--oe-nc-text-muted)]"
          {...gridFocusProps}
          onClick={() => onBookSlot({ date, time: slot, providerId: 0 })}
        >
          +
        </Button>
      ) : null}
    </TableCell>
  );
}
