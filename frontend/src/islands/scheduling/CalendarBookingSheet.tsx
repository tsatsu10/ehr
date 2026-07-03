import { useCallback, useEffect, useState } from 'react';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { SlideOver } from '@components/SlideOver';
import type { CalendarBookingDraft, CalendarDayPayload, SchedulingFilters, SchedulingLabels } from './schedulingTypes';
import { ALL_PROVIDERS_ID } from './schedulingTypes';
import { bookCalendarAppointment } from './schedulingApi';
import { resolveSchedulingLabels } from './schedulingLabels';

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
  const [categoryId, setCategoryId] = useState(0);
  const [time, setTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interval = payload?.interval_minutes ?? 15;
  const providers = payload?.providers ?? [];
  const categories = payload?.categories ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setPid(draft?.pid ?? 0);
    setPatientLabel(draft?.patientLabel ?? '');
    setProviderId(
      draft?.providerId
      ?? (filters.providerId > ALL_PROVIDERS_ID ? filters.providerId : (providers[0]?.id ?? 0)),
    );
    setCategoryId(draft?.categoryId ?? categories[0]?.id ?? 0);
    setTime(draft?.time ?? '09:00');
    setDurationMinutes(draft?.durationMinutes ?? interval);
    setComments(draft?.comments ?? '');
  }, [open, draft, filters.providerId, providers, categories, interval]);

  const canSave = pid > 0 && providerId > 0 && categoryId > 0 && time !== '';

  const handleSave = useCallback(async () => {
    if (!canSave) {
      setError(labels.bookingValidation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const day = await bookCalendarAppointment(ajaxUrl, csrfToken, filters, {
        pid,
        provider_id: providerId,
        pc_catid: categoryId,
        date: filters.date,
        time,
        duration_minutes: durationMinutes,
        comments,
        recall_id: recallId > 0 ? recallId : draft?.recallId,
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
    categoryId,
    comments,
    csrfToken,
    durationMinutes,
    filters,
    labels.bookingValidation,
    labels.errorBookingFailed,
    onBooked,
    onClose,
    pid,
    providerId,
    recallId,
    draft?.recallId,
    time,
  ]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={labels.bookSheetTitle}
      ariaLabel={labels.bookSheetAria}
      id="nc-scheduling-book-sheet"
      width="md"
      footer={(
        <div className="d-flex justify-content-end w-100">
          <button type="button" className="btn btn-secondary btn-sm mr-2" onClick={onClose}>
            {labels.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canSave || saving}
            onClick={() => { void handleSave(); }}
          >
            {saving ? labels.saving : labels.saveAppointment}
          </button>
        </div>
      )}
    >
      <p className="text-muted small">{labels.bookingHint}</p>
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
      {patientLabel && (
        <p className="small text-muted mb-3">
          {labels.selectedPatient}
          :
          {' '}
          <strong>{patientLabel}</strong>
        </p>
      )}
      <div className="form-group">
        <label htmlFor="nc-scheduling-book-provider">{labels.provider}</label>
        <select
          id="nc-scheduling-book-provider"
          className="form-control form-control-sm"
          value={providerId}
          onChange={(e) => setProviderId(Number.parseInt(e.target.value, 10))}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="nc-scheduling-book-category">{labels.category}</label>
        <select
          id="nc-scheduling-book-category"
          className="form-control form-control-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(Number.parseInt(e.target.value, 10))}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="form-group col-6">
          <label htmlFor="nc-scheduling-book-time">{labels.time}</label>
          <input
            id="nc-scheduling-book-time"
            type="time"
            className="form-control form-control-sm"
            value={time}
            onChange={(e) => setTime(e.target.value.slice(0, 5))}
          />
        </div>
        <div className="form-group col-6">
          <label htmlFor="nc-scheduling-book-duration">{labels.durationMin}</label>
          <input
            id="nc-scheduling-book-duration"
            type="number"
            min={interval}
            step={interval}
            className="form-control form-control-sm"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value, 10) || interval)}
          />
        </div>
      </div>
      <div className="form-group mb-0">
        <label htmlFor="nc-scheduling-book-comments">{labels.comments}</label>
        <textarea
          id="nc-scheduling-book-comments"
          className="form-control form-control-sm"
          rows={2}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </div>
      {error && <div className="alert alert-danger mt-3 mb-0 py-2">{error}</div>}
    </SlideOver>
  );
}
