import { useCallback, useEffect, useState } from 'react';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import type { RecallFormDraft, RecallBucket, SchedulingFilters, SchedulingLabels, SchedulingOption } from './schedulingTypes';
import { saveRecall } from './schedulingApi';
import { resolveSchedulingLabels } from './schedulingLabels';

interface RecallFormSheetProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  filters: SchedulingFilters;
  bucket: RecallBucket;
  providers: SchedulingOption[];
  facilities: SchedulingOption[];
  recallTypes?: SchedulingOption[];
  draft: RecallFormDraft | null;
  labels?: Partial<SchedulingLabels>;
  onClose: () => void;
  onSaved: () => void;
}

export function RecallFormSheet({
  open,
  ajaxUrl,
  csrfToken,
  filters,
  bucket,
  providers,
  facilities,
  recallTypes = [],
  draft,
  labels: labelOverrides,
  onClose,
  onSaved,
}: RecallFormSheetProps) {
  const labels = resolveSchedulingLabels(labelOverrides);
  const [pid, setPid] = useState(0);
  const [patientLabel, setPatientLabel] = useState('');
  const [dueDate, setDueDate] = useState(filters.date);
  const [reason, setReason] = useState('');
  const [providerId, setProviderId] = useState(0);
  const [facilityId, setFacilityId] = useState(filters.facilityId);
  const [recallType, setRecallType] = useState('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setPid(draft?.pid ?? 0);
    setPatientLabel(draft?.patientLabel ?? '');
    setDueDate(draft?.dueDate ?? filters.date);
    setReason(draft?.reason ?? '');
    setProviderId(draft?.providerId ?? providers[0]?.id ?? 0);
    setFacilityId(draft?.facilityId ?? filters.facilityId);
    setRecallType(draft?.recallType ?? recallTypes[0]?.id?.toString() ?? 'general');
  }, [open, draft, filters.date, filters.facilityId, providers, recallTypes]);

  const canSave = pid > 0 && dueDate !== '' && providerId > 0 && facilityId > 0;

  const handleSave = useCallback(async () => {
    if (!canSave) {
      setError(labels.recallValidation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRecall(ajaxUrl, csrfToken, filters, bucket, {
        recall_id: draft?.recallId,
        pid,
        due_date: dueDate,
        reason,
        provider_id: providerId,
        facility_id: facilityId,
        recall_type: recallType,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  }, [
    ajaxUrl,
    bucket,
    canSave,
    csrfToken,
    draft?.recallId,
    dueDate,
    facilityId,
    filters,
    labels.errorSaveFailed,
    labels.recallValidation,
    onClose,
    onSaved,
    pid,
    providerId,
    reason,
    recallType,
  ]);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={draft?.recallId ? labels.recallSheetEdit : labels.recallSheetNew}
      ariaLabel={labels.recallSheetAria}
      id="nc-scheduling-recall-sheet"
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
            {saving ? labels.saving : labels.saveRecall}
          </Button>
        </div>
      )}
    >
      <p className="text-[var(--oe-nc-text-muted)] text-sm">{labels.recallHint}</p>
      {!draft?.recallId && (
        <PatientSearchDropdown
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          inputId="nc-scheduling-recall-patient"
          resultsId="nc-scheduling-recall-patient-results"
          label={labels.patient}
          onSelectPatient={(selectedPid, row) => {
            setPid(selectedPid);
            setPatientLabel(row?.display_name ?? `PID ${selectedPid}`);
          }}
        />
      )}
      {patientLabel && (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
          {labels.patient}
          :
          {' '}
          <strong>{patientLabel}</strong>
        </p>
      )}
      <div className="nc-form-group">
        <label htmlFor="nc-scheduling-recall-due">{labels.dueDate}</label>
        <Input
          id="nc-scheduling-recall-due"
          type="date"
          className="h-8"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="nc-form-group">
        <label htmlFor="nc-scheduling-recall-reason">{labels.reason}</label>
        <Input
          id="nc-scheduling-recall-reason"
          type="text"
          className="h-8"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={labels.reasonPlaceholder}
        />
      </div>
      <div className="nc-form-group">
        <label htmlFor="nc-scheduling-recall-type">{labels.recallType}</label>
        <NativeSelect
          id="nc-scheduling-recall-type"
          className="h-8"
          value={recallType}
          onChange={(e) => setRecallType(e.target.value)}
        >
          {(recallTypes.length > 0 ? recallTypes : [{ id: 'general', label: 'General' }]).map((type) => (
            <option key={String(type.id)} value={String(type.id)}>{type.label}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="nc-form-group">
        <label htmlFor="nc-scheduling-recall-provider">{labels.provider}</label>
        <NativeSelect
          id="nc-scheduling-recall-provider"
          className="h-8"
          value={providerId}
          onChange={(e) => setProviderId(Number.parseInt(e.target.value, 10))}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="nc-form-group mb-0">
        <label htmlFor="nc-scheduling-recall-facility">{labels.facility}</label>
        <NativeSelect
          id="nc-scheduling-recall-facility"
          className="h-8"
          value={facilityId}
          onChange={(e) => setFacilityId(Number.parseInt(e.target.value, 10))}
        >
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>{facility.label}</option>
          ))}
        </NativeSelect>
      </div>
      {error && <div className={deskCalloutClass('error', 'mt-3 mb-0 py-2')}>{error}</div>}
    </SlideOver>
  );
}
