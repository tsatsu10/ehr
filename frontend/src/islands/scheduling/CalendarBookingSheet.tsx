import { useCallback, useEffect, useState } from 'react';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
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
      <p className="text-[var(--oe-nc-text-muted)] text-sm">{labels.bookingHint}</p>
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
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
          {labels.selectedPatient}
          :
          {' '}
          <strong>{patientLabel}</strong>
        </p>
      )}
      <div className="nc-form-group">
        <label htmlFor="nc-scheduling-book-provider">{labels.provider}</label>
        <NativeSelect
          id="nc-scheduling-book-provider"
          className="h-8"
          value={providerId}
          onChange={(e) => setProviderId(Number.parseInt(e.target.value, 10))}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="nc-form-group">
        <label htmlFor="nc-scheduling-book-category">{labels.category}</label>
        <NativeSelect
          id="nc-scheduling-book-category"
          className="h-8"
          value={categoryId}
          onChange={(e) => setCategoryId(Number.parseInt(e.target.value, 10))}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-12 gap-3">
        <div className="nc-form-group col-span-6">
          <label htmlFor="nc-scheduling-book-time">{labels.time}</label>
          <Input
            id="nc-scheduling-book-time"
            type="time"
            className="h-8"
            value={time}
            onChange={(e) => setTime(e.target.value.slice(0, 5))}
          />
        </div>
        <div className="nc-form-group col-span-6">
          <label htmlFor="nc-scheduling-book-duration">{labels.durationMin}</label>
          <Input
            id="nc-scheduling-book-duration"
            type="number"
            min={interval}
            step={interval}
            className="h-8"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value, 10) || interval)}
          />
        </div>
      </div>
      <div className="nc-form-group mb-0">
        <label htmlFor="nc-scheduling-book-comments">{labels.comments}</label>
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
