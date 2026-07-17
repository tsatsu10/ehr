import { useCallback, useEffect, useMemo, useState } from 'react';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
import type { CalendarBookingDraft, CalendarDayPayload, SchedulingFilters, SchedulingLabels } from './schedulingTypes';
import { ALL_PROVIDERS_ID } from './schedulingTypes';
import { bookCalendarAppointment, fetchFreeSlots } from './schedulingApi';
import { resolveSchedulingLabels } from './schedulingLabels';
import { visitTypeColor } from './schedulingCalendarUtils';

/** Initials for the selected-patient avatar, from a "Surname, First" display name. */
function patientInitials(name: string): string {
  const parts = name.replace(',', ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface CalendarBookingSheetProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  filters: SchedulingFilters;
  payload: CalendarDayPayload | null;
  draft: CalendarBookingDraft | null;
  recallId?: number;
  labels?: Partial<SchedulingLabels>;
  onClose: () => void;
  onBooked: (day: CalendarDayPayload) => void;
}

export function CalendarBookingSheet({
  open,
  ajaxUrl,
  csrfToken,
  filters,
  payload,
  draft,
  recallId = 0,
  labels: labelOverrides,
  onClose,
  onBooked,
}: CalendarBookingSheetProps) {
  const labels = resolveSchedulingLabels(labelOverrides);
  const [pid, setPid] = useState(0);
  const [patientLabel, setPatientLabel] = useState('');
  const [providerId, setProviderId] = useState(0);
  const [visitTypeId, setVisitTypeId] = useState(0);
  const [time, setTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [comments, setComments] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [slotsRetryToken, setSlotsRetryToken] = useState(0);

  const interval = payload?.interval_minutes ?? 15;
  const providers = useMemo(() => payload?.providers ?? [], [payload?.providers]);
  // Wire key is "categories" for historical reasons; the options are visit types.
  const visitTypes = useMemo(() => payload?.categories ?? [], [payload?.categories]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setPid(draft?.pid ?? 0);
    setPatientLabel(draft?.patientLabel ?? '');
    setProviderId(
      // "|| " not "??": callers (CalendarLens) pass providerId: 0 as their own
      // "undecided, you pick" sentinel when the "All providers" filter is
      // active — 0 is falsy but not nullish, so ?? would leave it stuck at 0
      // and silently block Save (the field would visually show the sole/first
      // provider selected while the real state stayed unset).
      draft?.providerId
      || (filters.providerId > ALL_PROVIDERS_ID ? filters.providerId : (providers[0]?.id ?? 0)),
    );
    setVisitTypeId(draft?.visitTypeId ?? ((payload?.default_visit_type_id || visitTypes[0]?.id) ?? 0));
    setTime(draft?.time ?? '09:00');
    setDurationMinutes(draft?.durationMinutes ?? interval);
    setComments(draft?.comments ?? '');
    setRepeat('none');
    setRepeatUntil('');
  }, [open, draft, filters.providerId, providers, visitTypes, interval, payload?.default_visit_type_id]);

  // A repeating appointment needs an end date; otherwise no extra requirement.
  const repeatValid = repeat === 'none' || repeatUntil !== '';
  const canSave = pid > 0 && providerId > 0 && visitTypeId > 0 && time !== '' && repeatValid;
  const draftRecallId = draft?.recallId;

  // "Next free times" chips — suggestions only; save still runs the server
  // conflict check, so a stale chip fails safely. Debounced so stepping the
  // duration spinner doesn't fire a request per tick.
  useEffect(() => {
    if (!open || providerId <= 0) {
      setSlots(null);
      return undefined;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(false);
    const timer = window.setTimeout(() => {
      fetchFreeSlots(ajaxUrl, csrfToken, {
        facility_id: filters.facilityId,
        provider_id: providerId,
        date: filters.date,
        duration_minutes: durationMinutes,
      }).then((result) => {
        if (!cancelled) {
          setSlots(result.slots ?? []);
          setSlotsLoading(false);
        }
      }).catch(() => {
        if (!cancelled) {
          setSlots(null);
          setSlotsError(true);
          setSlotsLoading(false);
        }
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, ajaxUrl, csrfToken, filters.facilityId, filters.date, providerId, durationMinutes, slotsRetryToken]);

  const handleSave = useCallback(async () => {
    if (!canSave) {
      setError(repeat !== 'none' && repeatUntil === '' ? labels.repeatUntilRequired : labels.bookingValidation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const day = await bookCalendarAppointment(ajaxUrl, csrfToken, filters, {
        pid,
        provider_id: providerId,
        visit_type_id: visitTypeId,
        date: filters.date,
        time,
        duration_minutes: durationMinutes,
        comments,
        recall_id: recallId > 0 ? recallId : draftRecallId,
        repeat: repeat !== 'none' ? repeat : undefined,
        repeat_until: repeat !== 'none' ? repeatUntil : undefined,
      });
      onBooked(day);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorBookingFailed);
    } finally {
      setSaving(false);
    }
  }, [
    ajaxUrl,
    canSave,
    visitTypeId,
    comments,
    csrfToken,
    durationMinutes,
    filters,
    labels.bookingValidation,
    labels.errorBookingFailed,
    labels.repeatUntilRequired,
    onBooked,
    onClose,
    pid,
    providerId,
    recallId,
    draftRecallId,
    repeat,
    repeatUntil,
    time,
  ]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dismissOnOutsideClick={false}
      title={labels.bookSheetTitle}
      ariaLabel={labels.bookSheetAria}
      id="nc-scheduling-book-sheet"
      width="md"
      footer={(
        <div className="flex justify-end w-full gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave || saving}
            onClick={() => { void handleSave(); }}
          >
            {saving ? labels.saving : labels.saveAppointment}
          </Button>
        </div>
      )}
    >
      <p className="nc-book-hint">{labels.bookingHint}</p>

      {/* Patient — the hero: a search until one is chosen, then a compact card. */}
      <div className="nc-book-section">
        {pid > 0 ? (
          <>
            <span className="nc-book-section-label">{labels.patient}</span>
            <div className="nc-book-patient-card">
              <span className="nc-book-avatar" aria-hidden="true">{patientInitials(patientLabel)}</span>
              <span className="nc-book-patient-name">{patientLabel || `PID ${pid}`}</span>
              <button
                type="button"
                className="nc-book-change"
                onClick={() => { setPid(0); setPatientLabel(''); }}
              >
                {labels.changePatient}
              </button>
            </div>
          </>
        ) : (
          <PatientSearchDropdown
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            inputId="nc-scheduling-book-patient"
            resultsId="nc-scheduling-book-patient-results"
            label={labels.patient}
            onSelectPatient={(selectedPid, row) => {
              setPid(selectedPid);
              setPatientLabel(row?.display_name ?? `PID ${selectedPid}`);
            }}
          />
        )}
      </div>

      {/* Visit type — a dropdown (scales to many types) with a colour swatch
          showing the selected type's calendar colour. */}
      <div className="nc-book-section">
        <label className="nc-book-section-label" htmlFor="nc-scheduling-book-visit-type">{labels.visitType}</label>
        <div className="nc-book-vt-select">
          <span
            className="nc-book-vt-swatch"
            style={{ background: visitTypeColor(visitTypeId, payload?.visit_type_colors) }}
            aria-hidden="true"
          />
          <NativeSelect
            id="nc-scheduling-book-visit-type"
            value={visitTypeId}
            onChange={(e) => setVisitTypeId(Number.parseInt(e.target.value, 10))}
          >
            {visitTypes.map((visitType) => (
              <option key={visitType.id} value={visitType.id}>{visitType.label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Provider */}
      <div className="nc-book-section">
        <label className="nc-book-section-label" htmlFor="nc-scheduling-book-provider">{labels.provider}</label>
        <NativeSelect
          id="nc-scheduling-book-provider"
          value={providerId}
          onChange={(e) => setProviderId(Number.parseInt(e.target.value, 10))}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </NativeSelect>
      </div>

      {/* When — time + duration, then the next-free-time chips. */}
      <div className="nc-book-section">
        <span className="nc-book-section-label">{labels.whenLabel}</span>
        <div className="nc-book-when">
          <div className="nc-book-field">
            <label htmlFor="nc-scheduling-book-time">{labels.time}</label>
            <Input
              id="nc-scheduling-book-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value.slice(0, 5))}
            />
          </div>
          <div className="nc-book-field">
            <label htmlFor="nc-scheduling-book-duration">{labels.durationMin}</label>
            <Input
              id="nc-scheduling-book-duration"
              type="number"
              min={interval}
              step={interval}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value, 10) || interval)}
            />
          </div>
        </div>
        <div className="nc-book-slots" aria-live="polite">
          <span className="nc-slot-chips-label">{labels.nextFreeTimes}</span>
          {slotsLoading && (
            <div className="nc-slot-chips" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => <span key={i} className="nc-slot-chip nc-slot-chip--skeleton" />)}
            </div>
          )}
          {!slotsLoading && slotsError && (
            <p className="nc-slot-chips-note">
              {labels.freeSlotsError}
              {' '}
              <button
                type="button"
                className="nc-slot-chips-retry"
                onClick={() => setSlotsRetryToken((value) => value + 1)}
              >
                {labels.retry}
              </button>
            </p>
          )}
          {!slotsLoading && !slotsError && slots !== null && slots.length === 0 && (
            <p className="nc-slot-chips-note">{labels.noFreeSlots}</p>
          )}
          {!slotsLoading && !slotsError && slots !== null && slots.length > 0 && (
            <div className="nc-slot-chips">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`nc-slot-chip${time === slot ? ' is-selected' : ''}`}
                  aria-pressed={time === slot}
                  onClick={() => setTime(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Repeats — one recurring series (weekly/every 2 weeks/monthly) until a date. */}
      <div className="nc-book-section">
        <label className="nc-book-section-label" htmlFor="nc-scheduling-book-repeat">{labels.repeatLabel}</label>
        <NativeSelect
          id="nc-scheduling-book-repeat"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        >
          <option value="none">{labels.repeatNone}</option>
          <option value="weekly">{labels.repeatWeekly}</option>
          <option value="biweekly">{labels.repeatBiweekly}</option>
          <option value="monthly">{labels.repeatMonthly}</option>
        </NativeSelect>
        {repeat !== 'none' && (
          <div className="nc-book-field nc-book-repeat-until">
            <label htmlFor="nc-scheduling-book-repeat-until">{labels.repeatUntilLabel}</label>
            <Input
              id="nc-scheduling-book-repeat-until"
              type="date"
              value={repeatUntil}
              min={filters.date}
              onChange={(e) => setRepeatUntil(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="nc-book-section nc-book-section--last">
        <label className="nc-book-section-label" htmlFor="nc-scheduling-book-comments">{labels.comments}</label>
        <Textarea
          id="nc-scheduling-book-comments"
          className="min-h-[4.5rem]"
          rows={2}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </div>
      {error && <div className={deskCalloutClass('error', 'mt-3 mb-0 py-2')}>{error}</div>}
    </SlideOver>
  );
}
