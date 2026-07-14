import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ClipboardList, Loader2, Pill, PlusCircle } from 'lucide-react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { t } from '@core/i18n';
import { oeFetch } from '@core/oeFetch';
import { useRxDrugSearch } from './useRxDrugSearch';
import type {
  DrugSearchRow,
  ExistingPrescription,
  RxEditProps,
  RxFormData,
  RxSaveResult,
} from './rxEditTypes';

function emptyDraft() {
  return {
    prescriptionId: 0,
    drugName: '',
    drugId: 0,
    dosage: '',
    quantity: '1',
    route: '',
    interval: '',
    refills: '0',
    note: '',
    sig: '',
    prn: false,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
  };
}

export function RxEditForm({ ajaxUrl, csrfToken, visitId, prescriptionId = 0, returnUrl }: RxEditProps) {
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const [data, setData] = useState<RxFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [draft, setDraft] = useState(emptyDraft());
  const [drugQuery, setDrugQuery] = useState('');
  const [drugSearchOpen, setDrugSearchOpen] = useState(false);
  const [allergyAck, setAllergyAck] = useState(false);
  const [existingRx, setExistingRx] = useState<ExistingPrescription[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pid = data?.pid ?? 0;
  const { results: drugResults, loading: searching } = useRxDrugSearch({
    pid,
    query: drugQuery,
    ajaxUrl,
    csrfToken,
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    void oeFetch<RxFormData>('pharmacy.rx_form_data', {
      ...fetchOptions,
      params: { visit_id: String(visitId), prescription_id: String(prescriptionId) },
    })
      .then((payload) => {
        if (!alive) return;
        setData(payload);
        setExistingRx(payload.existing_prescriptions ?? []);
        if (payload.prescription) {
          const rx = payload.prescription;
          setDraft({
            prescriptionId: rx.prescription_id,
            drugName: rx.drug_name,
            drugId: rx.drug_id,
            dosage: rx.dosage,
            quantity: rx.quantity || '1',
            route: rx.route,
            interval: rx.interval,
            refills: String(rx.refills ?? 0),
            note: rx.note,
            sig: rx.sig,
            prn: rx.prn,
            startDate: rx.start_date ?? new Date().toISOString().slice(0, 10),
            endDate: rx.end_date ?? '',
          });
          setDrugQuery(rx.drug_name);
        }
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : t('Could not load the prescription form'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetchOptions, prescriptionId, visitId]);

  const allergies = data?.allergies ?? [];
  const isEdit = draft.prescriptionId > 0;

  const pickDrug = useCallback((row: DrugSearchRow) => {
    setDraft((prev) => ({ ...prev, drugName: row.display_name, drugId: row.drug_id }));
    setDrugQuery(row.display_name);
    setDrugSearchOpen(false);
    setAllergyAck(false);
  }, []);

  const selectedAllergyMatch = useMemo(() => {
    if (!draft.drugName) return false;
    return drugResults.some((row) => row.display_name === draft.drugName && row.allergy_match);
  }, [draft.drugName, drugResults]);

  const canSave = draft.drugName.trim() !== '' && (!selectedAllergyMatch || allergyAck);

  const resetForNewEntry = useCallback(() => {
    setDraft(emptyDraft());
    setDrugQuery('');
    setAllergyAck(false);
    setSaveError(null);
  }, []);

  const submit = async () => {
    if (saving || !canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await oeFetch<RxSaveResult>('pharmacy.rx_save', {
        ...fetchOptions,
        json: {
          visit_id: visitId,
          prescription_id: draft.prescriptionId,
          drug_name: draft.drugName,
          drug_id: draft.drugId,
          dosage: draft.dosage,
          quantity: draft.quantity,
          route: draft.route,
          interval: draft.interval,
          refills: Number(draft.refills) || 0,
          note: draft.note,
          sig: draft.sig,
          prn: draft.prn,
          start_date: draft.startDate,
          end_date: draft.endDate || null,
        },
      });
      setExistingRx(result.existing_prescriptions ?? []);
      showDeskToast(
        result.action === 'updated' ? t('Prescription updated.') : t('Prescription added.'),
        'success',
      );
      resetForNewEntry();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('Could not save the prescription'));
    } finally {
      setSaving(false);
    }
  };

  const editExisting = (rx: ExistingPrescription) => {
    setDraft({
      prescriptionId: rx.prescription_id,
      drugName: rx.drug_name,
      drugId: 0,
      dosage: rx.dosage,
      quantity: rx.quantity || '1',
      route: rx.route,
      interval: rx.interval,
      refills: String(rx.refills ?? 0),
      note: '',
      sig: '',
      prn: rx.prn,
      startDate: rx.start_date ?? new Date().toISOString().slice(0, 10),
      endDate: rx.end_date ?? '',
    });
    setDrugQuery(rx.drug_name);
    setAllergyAck(false);
    setSaveError(null);
  };

  if (loading) {
    return (
      <div className="nc-rx-edit nc-rx-edit--status" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>{t('Loading the prescription form…')}</span>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="nc-rx-edit">
        <div className={deskCalloutClass('error')} role="alert">{loadError}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="nc-rx-edit">
      <header className="nc-rx-edit__hero">
        <span className="nc-rx-edit__hero-icon" aria-hidden="true">
          <Pill className="h-6 w-6" />
        </span>
        <div className="nc-rx-edit__hero-text">
          <h2 className="nc-rx-edit__title">
            {isEdit ? t('Edit prescription') : t('New prescription')}
          </h2>
          {data.patient_name && (
            <p className="nc-rx-edit__patient">{data.patient_name}</p>
          )}
        </div>
        {allergies.length > 0 && (
          <Badge variant="warning" className="nc-rx-edit__hero-badge">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {t('{count} known allergy', { count: allergies.length })}
          </Badge>
        )}
      </header>

      {existingRx.length > 0 && (
        <section className="nc-rx-edit__card">
          <div className="nc-rx-edit__card-head">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            <h3 className="nc-rx-edit__card-title">{t('Prescriptions on this visit')}</h3>
          </div>
          <ul className="nc-rx-edit__existing-list">
            {existingRx.map((rx) => (
              <li key={rx.prescription_id} className="nc-rx-edit__existing-row">
                <div className="nc-rx-edit__existing-info">
                  <strong>{rx.drug_name}</strong>
                  <span className="nc-rx-edit__existing-meta">
                    {[rx.dosage, rx.quantity && t('qty {qty}', { qty: rx.quantity }), rx.route]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => editExisting(rx)}>
                  {t('Edit')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="nc-rx-edit__card">
        <div className="nc-rx-edit__card-head">
          <Pill className="h-4 w-4" aria-hidden="true" />
          <h3 className="nc-rx-edit__card-title">{t('Medication')}</h3>
        </div>

        <div className="nc-rx-edit__field nc-rx-edit__drug-search">
          <Label htmlFor="nc-rx-edit-drug">{t('Drug name')}</Label>
          <Input
            id="nc-rx-edit-drug"
            type="search"
            autoComplete="off"
            placeholder={t('Search the formulary…')}
            value={drugQuery}
            onChange={(e) => {
              setDrugQuery(e.target.value);
              setDraft((prev) => ({ ...prev, drugName: e.target.value, drugId: 0 }));
              setDrugSearchOpen(true);
              setAllergyAck(false);
            }}
            onFocus={() => setDrugSearchOpen(true)}
            onBlur={() => setTimeout(() => setDrugSearchOpen(false), 150)}
          />
          {drugSearchOpen && drugQuery.trim().length >= 2 && (
            <div className="nc-rx-edit__drug-results" role="listbox">
              {searching ? (
                <div className="nc-rx-edit__drug-result nc-rx-edit__drug-result--muted">
                  {t('Searching…')}
                </div>
              ) : drugResults.length === 0 ? (
                <div className="nc-rx-edit__drug-result nc-rx-edit__drug-result--muted">
                  {t('No formulary match — you can still prescribe by typing the name.')}
                </div>
              ) : (
                drugResults.map((row) => (
                  <button
                    key={row.drug_id}
                    type="button"
                    className="nc-rx-edit__drug-result"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickDrug(row)}
                  >
                    <span>{row.display_name}</span>
                    {row.allergy_match && (
                      <Badge variant="danger" className="nc-rx-edit__drug-result-badge">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {t('Allergy')}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedAllergyMatch && (
          <div className={deskCalloutClass('error', 'nc-rx-edit__allergy-warning')} role="alert">
            <div className="font-bold mb-1">{t('Allergy warning')}</div>
            <div className="mb-2">
              {t('Documented allergies may match this medication: {allergies}', {
                allergies: allergies.join(', '),
              })}
            </div>
            <label className="mb-0 flex items-center gap-2">
              <input
                type="checkbox"
                checked={allergyAck}
                onChange={(e) => setAllergyAck(e.target.checked)}
              />
              {t('I verified allergies with the patient')}
            </label>
          </div>
        )}

        <div className="nc-rx-edit__grid">
          <div className="nc-rx-edit__field">
            <Label htmlFor="nc-rx-edit-dosage">{t('Dosage / sig')}</Label>
            <Input
              id="nc-rx-edit-dosage"
              type="text"
              maxLength={100}
              placeholder={t('e.g. 500mg twice daily')}
              value={draft.dosage}
              onChange={(e) => setDraft((prev) => ({ ...prev, dosage: e.target.value }))}
            />
          </div>
          <div className="nc-rx-edit__field">
            <Label htmlFor="nc-rx-edit-quantity">{t('Quantity')}</Label>
            <Input
              id="nc-rx-edit-quantity"
              type="text"
              maxLength={25}
              value={draft.quantity}
              onChange={(e) => setDraft((prev) => ({ ...prev, quantity: e.target.value }))}
            />
          </div>
          <div className="nc-rx-edit__field">
            <Label htmlFor="nc-rx-edit-route">{t('Route')}</Label>
            <NativeSelect
              id="nc-rx-edit-route"
              value={draft.route}
              onChange={(e) => setDraft((prev) => ({ ...prev, route: e.target.value }))}
            >
              <option value="">{t('— none —')}</option>
              {data.route_options.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.title}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="nc-rx-edit__field">
            <Label htmlFor="nc-rx-edit-interval">{t('Frequency')}</Label>
            <NativeSelect
              id="nc-rx-edit-interval"
              value={draft.interval}
              onChange={(e) => setDraft((prev) => ({ ...prev, interval: e.target.value }))}
            >
              <option value="">{t('— none —')}</option>
              {data.interval_options.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.title}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="nc-rx-edit__field">
            <Label htmlFor="nc-rx-edit-refills">{t('Refills')}</Label>
            <Input
              id="nc-rx-edit-refills"
              type="number"
              min={0}
              value={draft.refills}
              onChange={(e) => setDraft((prev) => ({ ...prev, refills: e.target.value }))}
            />
          </div>
          <div className="nc-rx-edit__field nc-rx-edit__field--checkbox">
            <Label htmlFor="nc-rx-edit-prn" className="nc-rx-edit__label">
              <Checkbox
                id="nc-rx-edit-prn"
                checked={draft.prn}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, prn: checked === true }))}
              />
              {t('As needed (PRN)')}
            </Label>
          </div>
        </div>
      </section>

      <section className="nc-rx-edit__card">
        <div className="nc-rx-edit__card-head">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <h3 className="nc-rx-edit__card-title">{t('Duration & notes')}</h3>
        </div>
        <div className="nc-rx-edit__grid">
          <div className="nc-rx-edit__field">
            <Label htmlFor="nc-rx-edit-start">{t('Start date')}</Label>
            <input
              id="nc-rx-edit-start"
              className="nc-input"
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div className="nc-rx-edit__field">
            <Label htmlFor="nc-rx-edit-end">{t('End date')}</Label>
            <input
              id="nc-rx-edit-end"
              className="nc-input"
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="nc-rx-edit__field">
          <Label htmlFor="nc-rx-edit-note">{t('Note')}</Label>
          <Textarea
            id="nc-rx-edit-note"
            rows={2}
            maxLength={255}
            value={draft.note}
            onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
          />
        </div>
      </section>

      {saveError && (
        <div className={deskCalloutClass('error', 'nc-rx-edit__status')} role="alert">
          {saveError}
        </div>
      )}

      <div className="nc-rx-edit__actions">
        {isEdit && (
          <Button type="button" variant="secondary" onClick={resetForNewEntry}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t('New prescription instead')}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={() => { window.location.href = returnUrl; }}>
          {t('Done')}
        </Button>
        <Button
          type="button"
          variant="cta"
          disabled={saving || !canSave}
          onClick={() => void submit()}
        >
          {saving ? t('Saving…') : isEdit ? t('Save changes') : t('Add prescription')}
        </Button>
      </div>
    </div>
  );
}
