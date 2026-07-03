import { useCallback, useMemo, useRef, useState } from 'react';
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
    <div className="oe-nc-calendar-day table-responsive">
      <table
        ref={tableRef}
        className="table table-sm table-bordered oe-nc-calendar-day__table mb-0"
        role="grid"
        onKeyDown={handleGridKeyDown}
      >
        <thead>
          <tr>
            <th scope="col" className="oe-nc-calendar-day__time-col">Time</th>
            {visibleProviders.map((provider) => (
              <th key={provider.id} scope="col">{provider.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot, slotIndex) => (
            <tr key={slot}>
              <th scope="row" className="text-muted small oe-nc-calendar-day__time-col">{slot}</th>
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
            </tr>
          ))}
        </tbody>
      </table>
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
  const providers = visibleProviders.length > 0
    ? visibleProviders
    : [{ id: 0, label: 'All' }];
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
    <div className="oe-nc-calendar-week table-responsive">
      <table className="table table-sm table-bordered mb-0">
        <thead>
          <tr>
            <th className="oe-nc-calendar-day__time-col" rowSpan={2}>Time</th>
            {dates.map((date) => (
              <th key={date} scope="colgroup" colSpan={Math.max(providers.length, 1)}>
                {date.slice(5)}
              </th>
            ))}
          </tr>
          <tr>
            {dates.flatMap((date) => (
              providers.map((provider) => (
                <th key={`${date}-${provider.id}`} scope="col" className="small">
                  {provider.label}
                </th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot}>
              <th scope="row" className="text-muted small oe-nc-calendar-day__time-col">{slot}</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalendarMonthGrid({
  data,
  onSelectEvent,
  onMoveEvent,
}: Pick<GridProps, 'data' | 'onSelectEvent' | 'onMoveEvent'>) {
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
    <div className="oe-nc-calendar-month">
      <div className="oe-nc-calendar-month__grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <div key={label} className="oe-nc-calendar-month__dow text-muted small">{label}</div>
        ))}
        {dates.map((date) => {
          const inMonth = date.startsWith(monthPrefix);
          const dayEvents = eventsByDate.get(date) ?? [];
          return (
            <div
              key={date}
              className={`oe-nc-calendar-month__cell${inMonth ? '' : ' oe-nc-calendar-month__cell--muted'}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(dropEvent) => {
                dropEvent.preventDefault();
                const pcEid = Number(dropEvent.dataTransfer.getData('text/plain'));
                if (pcEid > 0) {
                  onMoveEvent(pcEid, date, '', data.provider_id ?? 0);
                }
              }}
            >
              <div className="oe-nc-calendar-month__date small">{Number(date.slice(8))}</div>
              {dayEvents.slice(0, 3).map((event) => (
                <button
                  key={event.pc_eid}
                  type="button"
                  className="oe-nc-calendar-month__event btn btn-link btn-sm p-0 text-left"
                  draggable={canBook}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(event.pc_eid));
                  }}
                  onClick={() => onSelectEvent(event)}
                >
                  {event.start_time}
                  {' '}
                  {event.patient_name}
                </button>
              ))}
              {dayEvents.length > 3 && (
                <span className="text-muted small">
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
    <td
      className={`oe-nc-calendar-day__cell p-1${resizing ? ' oe-nc-calendar-day__cell--resizing' : ''}`}
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
        <div className="oe-nc-calendar-day__event-wrap">
          <button
            type="button"
            className="oe-nc-calendar-day__event btn btn-sm btn-block text-left"
            draggable={canBook}
            {...gridFocusProps}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', String(event.pc_eid));
            }}
            onClick={() => onSelectEvent(event)}
          >
            <strong className="d-block small">{event.patient_name}</strong>
            {!compact && (
              <span className="text-muted small">{event.category_label}</span>
            )}
          </button>
          {!compact && (
            <div
              className="oe-nc-calendar-day__resize-handle"
              role="separator"
              aria-label={`Resize ${event.patient_name} appointment`}
              onMouseDown={handleResizeStart}
            />
          )}
        </div>
      ) : canBook && providerId > 0 ? (
        <button
          type="button"
          className="btn btn-link btn-sm btn-block text-muted oe-nc-calendar-day__slot"
          {...gridFocusProps}
          onClick={() => onBookSlot({ date, time: slot, providerId })}
        >
          +
        </button>
      ) : canBook ? (
        <button
          type="button"
          className="btn btn-link btn-sm btn-block text-muted oe-nc-calendar-day__slot"
          {...gridFocusProps}
          onClick={() => onBookSlot({ date, time: slot, providerId: 0 })}
        >
          +
        </button>
      ) : null}
    </td>
  );
}
