import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInterval } from '@core/useInterval';
import {
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
  isCalendarUnchanged,
  type CalendarLayout,
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
  labels: labelOverrides,
}: CalendarLensProps) {
  const labels = resolveSchedulingLabels(labelOverrides);
  const [data, setData] = useState<CalendarDayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<CalendarLayout>(defaultCalendarLayout);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<CalendarBookingDraft | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingCalendarChange | null>(null);
  const revisionRef = useRef('');

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
      categoryId: data.categories[0]?.id ?? 0,
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
      categoryId: draft?.categoryId ?? data.categories[0]?.id ?? 0,
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

  if (loading && !data) {
    return <p className="text-muted">{labels.loadingCalendar}</p>;
  }

  if (error && !data) {
    return <div className="alert alert-danger py-2">{error}</div>;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="oe-nc-calendar">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {moveError ?? ''}
      </div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
        <p className="text-muted small mb-2 mb-md-0">
          {data.events.length}
          {' '}
          {data.events.length === 1 ? labels.calendarAppointmentSingular : labels.calendarAppointments}
          {layout === 'day' || layout === 'agenda' ? (
            <>
              {' '}
              {labels.calendarOn}
              {' '}
              {data.date}
              .
            </>
          ) : (
            <>
              {' '}
              {labels.calendarFrom}
              {' '}
              {data.start_date}
              {' '}
              {labels.calendarTo}
              {' '}
              {data.end_date}
              .
            </>
          )}
          {' '}
          {labels.calendarSlotIntervals}
          {' '}
          {data.interval_minutes}
          -minute intervals.
        </p>
        <div className="btn-group btn-group-sm mb-2" role="group" aria-label="Calendar layout">
          {([
            ['agenda', labels.calendarAgenda],
            ['day', labels.calendarDayGrid],
            ['week', labels.calendarWeek],
            ['month', labels.calendarMonth],
          ] as [CalendarLayout, string][]).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`btn btn-outline-secondary${layout === mode ? ' active' : ''}`}
              onClick={() => setLayout(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {moveError && <div className="alert alert-warning py-2">{moveError}</div>}

      {layout === 'agenda' ? (
        <div className="oe-nc-calendar-agenda" role="list">
          {data.events.length === 0 && (
            <p className="text-muted small">{labels.calendarNoAppointments}</p>
          )}
          {data.events
            .filter((event) => layout !== 'agenda' || event.event_date === data.date)
            .map((event) => (
            <button
              key={event.pc_eid}
              type="button"
              className="oe-nc-calendar-agenda__row btn btn-light btn-block text-left mb-2"
              role="listitem"
              aria-label={`${formatSlotRange(event)} ${event.patient_name}, ${event.category_label}, ${event.status_label}`}
              onClick={() => setSelectedEvent(event)}
            >
              <div className="d-flex justify-content-between align-items-start">
                <strong className="small">
                  {event.event_date !== data.date ? `${event.event_date} ` : ''}
                  {formatSlotRange(event)}
                </strong>
                <span className="badge badge-light border">{event.status_label}</span>
              </div>
              <div className="small">{event.patient_name}</div>
              <div className="text-muted small">
                {event.category_label}
                {' · '}
                {event.provider_label}
              </div>
            </button>
          ))}
        </div>
      ) : layout === 'day' ? (
        <CalendarDayGrid
          data={data}
          visibleProviders={visibleProviders}
          canBook={data.can_book}
          onSelectEvent={setSelectedEvent}
          onBookSlot={(draft) => openBooking(draft)}
          onMoveEvent={handleMoveEvent}
          onResizeEvent={handleResizeEvent}
        />
      ) : layout === 'week' ? (
        <CalendarWeekGrid
          data={data}
          visibleProviders={visibleProviders}
          canBook={data.can_book}
          onSelectEvent={setSelectedEvent}
          onBookSlot={(draft) => openBooking(draft)}
          onMoveEvent={handleMoveEvent}
        />
      ) : (
        <CalendarMonthGrid
          data={data}
          onSelectEvent={setSelectedEvent}
          onMoveEvent={handleMoveEvent}
        />
      )}

      {selectedEvent && (
        <div className="oe-nc-calendar-peek border rounded p-3 mt-3 bg-white">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <strong>{selectedEvent.patient_name}</strong>
              <div className="text-muted small">
                MRN
                {' '}
                {selectedEvent.pubpid}
                {' · '}
                {formatSlotRange(selectedEvent)}
              </div>
            </div>
            <button
              type="button"
              className="close"
              aria-label="Close"
              onClick={() => setSelectedEvent(null)}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <p className="small mb-2">
            {selectedEvent.category_label}
            {' · '}
            {selectedEvent.provider_label}
            {' · '}
            <span className="badge badge-light border">{selectedEvent.status_label}</span>
          </p>
          {selectedEvent.comments && (
            <p className="small text-muted mb-2">{selectedEvent.comments}</p>
          )}
          {selectedEvent.is_recurring && (
            <p className="small text-muted mb-2">Recurring series</p>
          )}
          <a className="btn btn-sm btn-outline-primary mr-2" href={frontDeskUrl}>
            {labels.frontDesk}
          </a>
          <button
            type="button"
            className="btn btn-sm btn-link"
            onClick={() => setSelectedEvent(null)}
          >
            {labels.close}
          </button>
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
