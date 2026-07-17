import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useInterval } from '@core/useInterval';
import { useModalDismiss } from '@components/useModalDismiss';
import { ConfirmModal } from '@components/ConfirmModal';
import { SegmentedControl } from '@components/SegmentedControl';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  cancelCalendarAppointment,
  fetchCalendarRange,
  moveCalendarAppointment,
  pollCalendarRange,
  resizeCalendarAppointment,
} from './schedulingApi';
import { CalendarBookingSheet } from './CalendarBookingSheet';
import { CalendarNotifyModal } from './CalendarNotifyModal';
import { CalendarRecurringScopeModal, type RecurringEditScope } from './CalendarRecurringScopeModal';
import { CalendarDayGrid, CalendarMonthGrid, CalendarWeekGrid } from './CalendarRangeViews';
import type {
  CalendarBookingDraft,
  CalendarDayPayload,
  CalendarEvent,
  CalendarView,
  SchedulingFilters,
} from './schedulingTypes';
import { ALL_PROVIDERS_ID } from './schedulingTypes';
import {
  defaultCalendarLayout,
  formatDateDisplay,
  isCalendarUnchanged,
  positionPeek,
  providerColor,
  visitTypeColor,
  type CalendarLayout,
  type PeekAnchor,
} from './schedulingCalendarUtils';
import { resolveSchedulingLabels } from './schedulingLabels';
import type { SchedulingLabels } from './schedulingTypes';

interface CalendarLensProps {
  ajaxUrl: string;
  csrfToken: string;
  filters: SchedulingFilters;
  refreshToken: number;
  bookSignal: number;
  frontDeskUrl: string;
  /** Controlled layout (shell owns it for the date stepper + keyboard shortcuts). */
  layout?: CalendarLayout;
  /** Lets the shell mirror the active layout (drives the filter-bar date stepper unit). */
  onLayoutChange?: (layout: CalendarLayout) => void;
  labels?: Partial<SchedulingLabels>;
}

function formatSlotRange(event: CalendarEvent): string {
  if (event.end_time) {
    return `${event.start_time}–${event.end_time}`;
  }
  return event.start_time;
}

type PendingCalendarChange =
  | {
    kind: 'move';
    pcEid: number;
    date: string;
    time: string;
    providerId: number;
    patientName: string;
    occurrenceDate: string;
    isRecurring: boolean;
    pid: number;
    recurrScope?: RecurringEditScope;
  }
  | {
    kind: 'resize';
    event: CalendarEvent;
    durationMinutes: number;
    recurrScope?: RecurringEditScope;
  };

export function CalendarLens({
  ajaxUrl,
  csrfToken,
  filters,
  refreshToken,
  bookSignal,
  frontDeskUrl,
  layout: controlledLayout,
  onLayoutChange,
  labels: labelOverrides,
}: CalendarLensProps) {
  const labels = resolveSchedulingLabels(labelOverrides);
  const [data, setData] = useState<CalendarDayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalLayout, setInternalLayout] = useState<CalendarLayout>(defaultCalendarLayout);
  const layout = controlledLayout ?? internalLayout;
  const setLayout = useCallback((next: CalendarLayout) => {
    setInternalLayout(next);
    onLayoutChange?.(next);
  }, [onLayoutChange]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [peekAnchor, setPeekAnchor] = useState<PeekAnchor | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<CalendarBookingDraft | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingCalendarChange | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CalendarEvent | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const revisionRef = useRef('');

  const peekReturnFocusRef = useRef<HTMLElement | null>(null);
  const selectEvent = useCallback((event: CalendarEvent, anchorRect?: DOMRect | PeekAnchor) => {
    // Remember the trigger so focus returns to the clicked appointment on close.
    peekReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSelectedEvent(event);
    setPeekAnchor(anchorRect
      ? { top: anchorRect.top, left: anchorRect.left, width: anchorRect.width, height: anchorRect.height }
      : null);
  }, []);
  const closePeek = useCallback(() => {
    setSelectedEvent(null);
    setPeekAnchor(null);
    const returnTo = peekReturnFocusRef.current;
    peekReturnFocusRef.current = null;
    if (returnTo && document.contains(returnTo)) {
      returnTo.focus();
    }
  }, []);
  useModalDismiss(selectedEvent !== null, closePeek);

  const peekRef = useRef<HTMLDivElement>(null);
  // Move focus into the peek when it opens so keyboard/SR users land on the
  // dialog it announces (aria-modal), not stranded on the trigger behind it.
  useEffect(() => {
    if (selectedEvent) {
      peekRef.current?.focus();
    }
  }, [selectedEvent]);
  const [peekStyle, setPeekStyle] = useState<CSSProperties | undefined>(undefined);
  useLayoutEffect(() => {
    if (!selectedEvent || !peekAnchor) {
      setPeekStyle(undefined); // no anchor → CSS centers it
      return;
    }
    const card = peekRef.current;
    if (!card) {
      return;
    }
    const { top, left } = positionPeek(
      peekAnchor,
      card.offsetWidth,
      card.offsetHeight,
      window.innerWidth,
      window.innerHeight,
    );
    setPeekStyle({ position: 'fixed', top, left, margin: 0 });
  }, [selectedEvent, peekAnchor]);

  const apiView = useMemo((): CalendarView => {
    if (layout === 'week') return 'week';
    if (layout === 'month') return 'month';
    return 'day';
  }, [layout]);

  const applyPayload = useCallback((payload: CalendarDayPayload) => {
    revisionRef.current = payload.revision;
    setData(payload);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const day = await fetchCalendarRange(ajaxUrl, csrfToken, filters, apiView);
      applyPayload(day);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorLoadCalendar);
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, filters, apiView, applyPayload, labels.errorLoadCalendar]);

  const poll = useCallback(async () => {
    if (!revisionRef.current) {
      return;
    }
    try {
      const payload = await pollCalendarRange(
        ajaxUrl,
        csrfToken,
        filters,
        apiView,
        revisionRef.current,
      );
      if (isCalendarUnchanged(payload)) {
        return;
      }
      applyPayload(payload);
    } catch {
      // Keep last good calendar on background poll failure.
    }
  }, [ajaxUrl, csrfToken, filters, apiView, applyPayload]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useInterval(() => {
    if (document.visibilityState === 'visible') {
      void poll();
    }
  }, data?.poll_interval_ms ?? 30000);

  useEffect(() => {
    if (bookSignal <= 0 || !data?.can_book) {
      return;
    }
    setBookingDraft({
      date: filters.date,
      time: '09:00',
      providerId: filters.providerId > ALL_PROVIDERS_ID ? filters.providerId : 0,
      pid: 0,
      patientLabel: '',
      visitTypeId: (data.default_visit_type_id || data.categories[0]?.id) ?? 0,
      durationMinutes: data.interval_minutes,
      comments: '',
    });
    setBookingOpen(true);
  }, [bookSignal, data, filters.date, filters.providerId]);

  const visibleProviders = useMemo(() => {
    if (!data) {
      return [];
    }
    if (filters.providerId > ALL_PROVIDERS_ID) {
      return data.providers.filter((provider) => provider.id === filters.providerId);
    }
    const idsWithEvents = new Set(data.events.map((event) => event.provider_id));
    const withEvents = data.providers.filter((provider) => idsWithEvents.has(provider.id));
    return withEvents.length > 0 ? withEvents : data.providers;
  }, [data, filters.providerId]);

  const visibleProviderIds = useMemo(() => visibleProviders.map((p) => p.id), [visibleProviders]);
  const multiProviderView = visibleProviders.length > 1;
  const showLegendToggle = multiProviderView && (layout === 'day' || layout === 'week' || layout === 'agenda');

  const openBooking = (draft?: Partial<CalendarBookingDraft> & { date?: string }) => {
    if (!data?.can_book) {
      return;
    }
    setBookingDraft({
      date: draft?.date ?? filters.date,
      time: draft?.time ?? '09:00',
      providerId: draft?.providerId
        ?? (filters.providerId > ALL_PROVIDERS_ID ? filters.providerId : (data.providers[0]?.id ?? 0)),
      pid: draft?.pid ?? 0,
      patientLabel: draft?.patientLabel ?? '',
      visitTypeId: draft?.visitTypeId ?? ((data.default_visit_type_id || data.categories[0]?.id) ?? 0),
      durationMinutes: draft?.durationMinutes ?? data.interval_minutes,
      comments: draft?.comments ?? '',
    });
    setBookingOpen(true);
  };

  const handleMoveEvent = useCallback(async (
    pcEid: number,
    date: string,
    time: string,
    providerId: number,
  ) => {
    const source = data?.events.find((row) => row.pc_eid === pcEid);
    if (!source || !data?.can_book) {
      return;
    }
    const targetProvider = providerId > 0 ? providerId : source.provider_id;
    const targetTime = time || source.start_time;
    if (source.event_date === date && source.start_time === targetTime && source.provider_id === targetProvider) {
      return;
    }
    const change: PendingCalendarChange = {
      kind: 'move',
      pcEid,
      date,
      time: targetTime,
      providerId: targetProvider,
      patientName: source.patient_name,
      occurrenceDate: source.event_date,
      isRecurring: source.is_recurring,
      pid: source.pid,
    };
    if (source.is_recurring) {
      setPendingChange(change);
      return;
    }
    if (data.patient_notify?.medex_enabled && source.pid > 0) {
      setPendingChange(change);
      return;
    }
    setMoveError(null);
    try {
      const payload = await moveCalendarAppointment(ajaxUrl, csrfToken, filters, apiView, {
        pc_eid: pcEid,
        date,
        time: targetTime,
        provider_id: targetProvider,
      });
      applyPayload(payload);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : labels.errorMoveAppointment);
    }
  }, [ajaxUrl, csrfToken, filters, apiView, data, applyPayload, labels.errorMoveAppointment]);

  const handleResizeEvent = useCallback(async (event: CalendarEvent, durationMinutes: number) => {
    if (!data?.can_book || durationMinutes === event.duration_minutes) {
      return;
    }
    const change: PendingCalendarChange = { kind: 'resize', event, durationMinutes };
    if (event.is_recurring) {
      setPendingChange(change);
      return;
    }
    if (data.patient_notify?.medex_enabled && event.pid > 0) {
      setPendingChange(change);
      return;
    }
    setMoveError(null);
    try {
      const payload = await resizeCalendarAppointment(
        ajaxUrl,
        csrfToken,
        filters,
        apiView,
        event.pc_eid,
        durationMinutes,
      );
      applyPayload(payload);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : labels.errorResizeAppointment);
    }
  }, [ajaxUrl, csrfToken, filters, apiView, data, applyPayload, labels.errorResizeAppointment]);

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) {
      return;
    }
    setCancelling(true);
    setMoveError(null);
    try {
      const payload = await cancelCalendarAppointment(ajaxUrl, csrfToken, filters, apiView, cancelTarget.pc_eid);
      applyPayload(payload);
      setCancelTarget(null);
      closePeek();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : labels.errorCancelAppointment);
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, ajaxUrl, csrfToken, filters, apiView, applyPayload, closePeek, labels.errorCancelAppointment]);

  const pendingIsRecurring = pendingChange?.kind === 'move'
    ? pendingChange.isRecurring
    : pendingChange?.kind === 'resize'
      ? pendingChange.event.is_recurring
      : false;
  const awaitingRecurrScope = pendingChange !== null
    && pendingIsRecurring
    && !pendingChange.recurrScope;
  const awaitingNotify = pendingChange !== null
    && !awaitingRecurrScope
    && !!data?.patient_notify?.medex_enabled
    && (pendingChange.kind === 'move'
      ? pendingChange.pid > 0
      : pendingChange.event.pid > 0);

  const commitPendingChange = useCallback(async (notifyPatient: boolean) => {
    if (!pendingChange || awaitingRecurrScope) {
      return;
    }
    setMoveError(null);
    const recurring = pendingChange.recurrScope && pendingIsRecurring
      ? {
        occurrence_date: pendingChange.kind === 'move'
          ? pendingChange.occurrenceDate
          : pendingChange.event.event_date,
        recurr_scope: pendingChange.recurrScope,
      }
      : undefined;
    try {
      if (pendingChange.kind === 'move') {
        const payload = await moveCalendarAppointment(ajaxUrl, csrfToken, filters, apiView, {
          pc_eid: pendingChange.pcEid,
          date: pendingChange.date,
          time: pendingChange.time,
          provider_id: pendingChange.providerId,
          notify_patient: notifyPatient,
          occurrence_date: recurring?.occurrence_date,
          recurr_scope: recurring?.recurr_scope,
        });
        applyPayload(payload);
      } else {
        const payload = await resizeCalendarAppointment(
          ajaxUrl,
          csrfToken,
          filters,
          apiView,
          pendingChange.event.pc_eid,
          pendingChange.durationMinutes,
          notifyPatient,
          recurring,
        );
        applyPayload(payload);
      }
      setPendingChange(null);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : labels.errorMoveAppointment);
      setPendingChange(null);
    }
  }, [
    ajaxUrl,
    apiView,
    applyPayload,
    awaitingRecurrScope,
    csrfToken,
    filters,
    labels.errorMoveAppointment,
    pendingChange,
    pendingIsRecurring,
  ]);

  const handleRecurrScopeSelect = useCallback((scope: RecurringEditScope) => {
    if (!pendingChange) {
      return;
    }
    const next: PendingCalendarChange = { ...pendingChange, recurrScope: scope };
    const needsNotify = !!data?.patient_notify?.medex_enabled
      && (next.kind === 'move' ? next.pid > 0 : next.event.pid > 0);
    if (needsNotify) {
      setPendingChange(next);
      return;
    }
    setPendingChange(next);
    void (async () => {
      setMoveError(null);
      const recurring = {
        occurrence_date: next.kind === 'move' ? next.occurrenceDate : next.event.event_date,
        recurr_scope: scope,
      };
      try {
        if (next.kind === 'move') {
          const payload = await moveCalendarAppointment(ajaxUrl, csrfToken, filters, apiView, {
            pc_eid: next.pcEid,
            date: next.date,
            time: next.time,
            provider_id: next.providerId,
            occurrence_date: recurring.occurrence_date,
            recurr_scope: recurring.recurr_scope,
          });
          applyPayload(payload);
        } else {
          const payload = await resizeCalendarAppointment(
            ajaxUrl,
            csrfToken,
            filters,
            apiView,
            next.event.pc_eid,
            next.durationMinutes,
            false,
            recurring,
          );
          applyPayload(payload);
        }
        setPendingChange(null);
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : labels.errorMoveAppointment);
        setPendingChange(null);
      }
    })();
  }, [ajaxUrl, apiView, applyPayload, csrfToken, data, filters, labels.errorMoveAppointment, pendingChange]);

  // The view switcher works without data, so keep it (and the toolbar row)
  // mounted while loading — skeletonising the whole lens made the tabs pop in
  // after the fetch, jumping the layout on every first paint.
  const layoutSegments = ([
    ['agenda', labels.calendarAgenda],
    ['day', labels.calendarDayGrid],
    ['week', labels.calendarWeek],
    ['month', labels.calendarMonth],
  ] as [CalendarLayout, string][]).map(([mode, label]) => ({ id: mode, label }));

  const layoutToolbar = (countSlot: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between mb-3">
      <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2 md:mb-0">{countSlot}</p>
      <SegmentedControl
        className="mb-2"
        segments={layoutSegments}
        value={layout}
        onChange={(id) => setLayout(id as CalendarLayout)}
        ariaLabel="Calendar layout"
      />
      <span className="nc-shortcut-hint" aria-hidden="true">{labels.shortcutHint}</span>
    </div>
  );

  if (loading && !data) {
    return (
      <div className="nc-calendar" aria-busy="true">
        <span className="sr-only">{labels.loadingCalendar}</span>
        {layoutToolbar(<span className="nc-calendar-skeleton-text" aria-hidden="true" />)}
        <div className="nc-calendar-skeleton" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="nc-calendar-skeleton-row" />)}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return <div className={deskCalloutClass('error', 'py-2')}>{error}</div>;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="nc-calendar">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {moveError ?? ''}
      </div>
      {layoutToolbar(
        <>
          {data.events.length}
          {' '}
          {data.events.length === 1 ? labels.calendarAppointmentSingular : labels.calendarAppointments}
          {layout === 'day' || layout === 'agenda' ? (
            <>
              {' '}
              {labels.calendarOn}
              {' '}
              {formatDateDisplay(data.date)}
              .
            </>
          ) : (
            <>
              {' '}
              {labels.calendarFrom}
              {' '}
              {formatDateDisplay(data.start_date ?? '')}
              {' '}
              {labels.calendarTo}
              {' '}
              {formatDateDisplay(data.end_date ?? '')}
              .
            </>
          )}
          {' '}
          {labels.calendarSlotIntervals}
          {' '}
          {data.interval_minutes}
          -minute intervals.
        </>,
      )}

      {showLegendToggle && (
        <div className="mb-2">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((value) => !value)}
          >
            {labels.providerColors}
          </Button>
          {legendOpen && (
            <div className="nc-provider-legend" role="list" aria-label={labels.providerColors}>
              {visibleProviders.map((provider) => (
                <span key={provider.id} className="nc-provider-legend-item" role="listitem">
                  <span
                    className="nc-provider-dot"
                    style={{ background: providerColor(provider.id, data.provider_colors, visibleProviderIds) }}
                    aria-hidden="true"
                  />
                  {provider.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {moveError && <div className={deskCalloutClass('warn', 'py-2')}>{moveError}</div>}

      {layout === 'agenda' ? (
        <div className="nc-calendar-agenda" role="list">
          {data.events.length === 0 && (
            <p className="text-[var(--oe-nc-text-muted)] text-sm">{labels.calendarNoAppointments}</p>
          )}
          {data.events
            .filter((event) => event.event_date === data.date)
            .map((event) => (
            <Button
              key={event.pc_eid}
              type="button"
              variant="secondary"
              className={`nc-calendar-agenda-row mb-2 h-auto w-full justify-start text-left font-normal${event.is_block ? ' nc-calendar-agenda-row--block' : ''}`}
              role="listitem"
              // Visit-type colour as a left rail (border, not box-shadow, so the
              // card's float shadow + hover lift survive).
              style={{ borderLeft: `4px solid ${visitTypeColor(event.visit_type_id, data.visit_type_colors)}` }}
              aria-label={`${formatSlotRange(event)} ${event.patient_name}, ${event.category_label}, ${event.status_label}`}
              onClick={(e) => selectEvent(event, e.currentTarget.getBoundingClientRect())}
            >
              <span className="nc-calendar-agenda-time">
                {event.event_date !== data.date ? `${formatDateDisplay(event.event_date)} ` : ''}
                {formatSlotRange(event)}
              </span>
              <span className="nc-calendar-agenda-main">
                <span className="nc-calendar-agenda-name">
                  {event.patient_name}
                </span>
                <span className="nc-calendar-agenda-meta">
                  {!event.is_block && (
                    <>
                      {event.category_label}
                      {' · '}
                      {multiProviderView && (
                        <span
                          className="nc-provider-dot"
                          style={{ background: providerColor(event.provider_id, data.provider_colors, visibleProviderIds) }}
                          aria-hidden="true"
                        />
                      )}
                      {event.provider_label}
                    </>
                  )}
                  {event.is_block && labels.calendarBlockTag}
                </span>
              </span>
              {event.is_block
                ? <Badge variant="neutral">{labels.calendarBlockTag}</Badge>
                : <Badge variant="outline">{event.status_label}</Badge>}
            </Button>
          ))}
        </div>
      ) : layout === 'day' ? (
        <CalendarDayGrid
          data={data}
          visibleProviders={visibleProviders}
          canBook={data.can_book}
          onSelectEvent={selectEvent}
          onBookSlot={(draft) => openBooking(draft)}
          onMoveEvent={handleMoveEvent}
          onResizeEvent={handleResizeEvent}
        />
      ) : layout === 'week' ? (
        <CalendarWeekGrid
          data={data}
          visibleProviders={visibleProviders}
          canBook={data.can_book}
          onSelectEvent={selectEvent}
          onBookSlot={(draft) => openBooking(draft)}
          onMoveEvent={handleMoveEvent}
        />
      ) : (
        <CalendarMonthGrid
          data={data}
          canBook={data.can_book}
          onSelectEvent={selectEvent}
          onMoveEvent={handleMoveEvent}
        />
      )}

      {selectedEvent && (
        // Floating overlay (not an inline panel): a click on an event anywhere
        // in the grid — especially deep in a tall month grid — must show the
        // details in view, not append a card far below the fold.
        <div
          className="nc-calendar-peek-backdrop"
          onClick={closePeek}
        >
          <div
            ref={peekRef}
            className="nc-calendar-peek"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedEvent.patient_name} appointment`}
            tabIndex={-1}
            style={peekStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <strong>{selectedEvent.patient_name}</strong>
                <div className="text-[var(--oe-nc-text-muted)] text-sm">
                  {!selectedEvent.is_block && (
                    <>
                      MRN
                      {' '}
                      {selectedEvent.pubpid}
                      {' · '}
                    </>
                  )}
                  {formatDateDisplay(selectedEvent.event_date)}
                  {' · '}
                  {formatSlotRange(selectedEvent)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[var(--oe-nc-text-muted)]"
                aria-label="Close"
                onClick={closePeek}
              >
                <span aria-hidden="true">&times;</span>
              </Button>
            </div>
            <p className="text-sm mb-2">
              {selectedEvent.category_label}
              {selectedEvent.is_block ? (
                <>
                  {' · '}
                  <Badge variant="neutral">{labels.calendarBlockTag}</Badge>
                </>
              ) : (
                <>
                  {' · '}
                  {selectedEvent.provider_label}
                  {' · '}
                  <Badge variant="outline">{selectedEvent.status_label}</Badge>
                </>
              )}
            </p>
            {selectedEvent.comments && (
              <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">{selectedEvent.comments}</p>
            )}
            {selectedEvent.is_recurring && (
              <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">Recurring series</p>
            )}
            <Button variant="outline" size="sm" className="mr-2" asChild>
              <a href={frontDeskUrl}>
                {labels.frontDesk}
              </a>
            </Button>
            {data.can_book && !selectedEvent.is_block && !selectedEvent.is_recurring && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mr-2 text-(--oe-nc-danger) hover:text-(--oe-nc-danger)"
                onClick={() => setCancelTarget(selectedEvent)}
              >
                {labels.cancelAppointmentAction}
              </Button>
            )}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={closePeek}
            >
              {labels.close}
            </Button>
          </div>
        </div>
      )}

      <CalendarBookingSheet
        open={bookingOpen}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        filters={filters}
        payload={data}
        draft={bookingDraft}
        labels={labels}
        onClose={() => setBookingOpen(false)}
        onBooked={(day) => {
          applyPayload(day);
          setSelectedEvent(null);
        }}
      />

      <CalendarRecurringScopeModal
        open={awaitingRecurrScope}
        labels={labels}
        onSelect={handleRecurrScopeSelect}
        onCancel={() => setPendingChange(null)}
      />

      <ConfirmModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={labels.cancelAppointmentConfirm}
        confirmLabel={labels.cancelAppointmentAction}
        cancelLabel={labels.cancelAppointmentKeep}
        confirmVariant="danger"
        submitting={cancelling}
        onConfirm={() => { void handleCancel(); }}
      >
        <p className="text-sm text-[var(--oe-nc-text-muted)]">
          {cancelTarget?.patient_name}
          {' · '}
          {cancelTarget ? formatDateDisplay(cancelTarget.event_date) : ''}
          {' · '}
          {cancelTarget ? formatSlotRange(cancelTarget) : ''}
        </p>
      </ConfirmModal>

      <CalendarNotifyModal
        open={awaitingNotify}
        patientName={pendingChange?.kind === 'move'
          ? pendingChange.patientName
          : pendingChange?.event.patient_name ?? ''}
        changeLabel={pendingChange?.kind === 'resize' ? labels.notifyResizeLabel : labels.notifyMoveLabel}
        notifyLabel={labels.notifyPatientConfirm}
        skipNotifyLabel={labels.notifyPatientSkip}
        abortLabel={labels.notifyPatientAbort}
        title={labels.notifyPatientTitle}
        body={labels.notifyPatientBody}
        onNotify={() => { void commitPendingChange(true); }}
        onSkipNotify={() => { void commitPendingChange(false); }}
        onAbort={() => setPendingChange(null)}
      />
    </div>
  );
}
