import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { ConfirmModal } from '@components/ConfirmModal';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { SlideOver } from '@components/SlideOver';
import { formatFefoLotLabel } from './pharmOpsLotUtils';
import { usePharmDrugSearch } from './usePharmDrugSearch';
import type {
  OtcDrugSearchRow,
  OtcSaleConfirmResult,
  OtcSaleForm,
  OtcSaleInitialContext,
} from './pharmOpsTypes';

interface PharmOpsOtcSaleDrawerProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  canDispense: boolean;
  initialContext?: OtcSaleInitialContext | null;
  onClose: () => void;
  onSold?: () => void;
}

export function PharmOpsOtcSaleDrawer({
  open,
  ajaxUrl,
  csrfToken,
  canDispense,
  initialContext,
  onClose,
  onSold,
}: PharmOpsOtcSaleDrawerProps) {
  const [pid, setPid] = useState<number | null>(null);
  const [patientLabel, setPatientLabel] = useState('');
  const [encounterId, setEncounterId] = useState<number | null>(null);
  const [drugQuery, setDrugQuery] = useState('');
  const [drugOpen, setDrugOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<OtcDrugSearchRow | null>(null);
  const [form, setForm] = useState<OtcSaleForm | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [fee, setFee] = useState('');
  const [allergyAck, setAllergyAck] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<OtcSaleConfirmResult | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const {
    results: drugResults,
    loading: loadingDrugs,
    error: drugSearchError,
  } = usePharmDrugSearch({
    open,
    query: drugQuery,
    ajaxUrl,
    csrfToken,
  });

  const resetState = useCallback(() => {
    setPid(null);
    setPatientLabel('');
    setEncounterId(null);
    setDrugQuery('');
    setDrugOpen(false);
    setSelectedDrug(null);
    setForm(null);
    setQuantity('1');
    setFee('');
    setAllergyAck(false);
    setLoadError(null);
    setSubmitError(null);
    setSuccess(null);
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    if (initialContext?.pid && initialContext.pid > 0) {
      setPid(initialContext.pid);
      setPatientLabel(initialContext.patientLabel ?? '');
      setEncounterId(initialContext.encounterId ?? null);
    }
  }, [initialContext, open, resetState]);

  const loadSaleForm = useCallback(async (patientId: number, drugId: number, encId?: number | null) => {
    setLoadingForm(true);
    setLoadError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = { pid: patientId, drug_id: drugId };
      if (encId && encId > 0) body.encounter_id = encId;

      const data = await oeFetch<OtcSaleForm>('pharm_ops.otc_sale_get', {
        ...fetchOptions,
        json: body,
      });
      setForm(data);
      setEncounterId(data.encounter_id > 0 ? data.encounter_id : null);
      const defaultQty = data.drug?.default_quantity ?? 1;
      setQuantity(String(defaultQty));
      setFee(String(data.fee?.amount ?? 0));
      setAllergyAck(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load sale form');
      setForm(null);
    } finally {
      setLoadingForm(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    if (!open || !pid || !selectedDrug) return;
    void loadSaleForm(pid, selectedDrug.drug_id, encounterId);
  }, [encounterId, loadSaleForm, open, pid, selectedDrug]);

  const handleSelectPatient = useCallback((nextPid: number, row?: { display_name?: string }) => {
    setPid(nextPid);
    setPatientLabel(row?.display_name ?? '');
    setSelectedDrug(null);
    setDrugQuery('');
    setForm(null);
    setLoadError(null);
    setSuccess(null);
  }, []);

  const handleSelectDrug = useCallback((row: OtcDrugSearchRow) => {
    setSelectedDrug(row);
    setDrugQuery(row.drug_name);
    setDrugOpen(false);
    setLoadError(null);
    setSuccess(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pid || !selectedDrug || !form) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await oeFetch<OtcSaleConfirmResult>('pharm_ops.otc_sale_confirm', {
        ...fetchOptions,
        json: {
          pid,
          drug_id: selectedDrug.drug_id,
          encounter_id: form.encounter_id > 0 ? form.encounter_id : encounterId,
          quantity: Number(quantity),
          fee: Number(fee),
          allergy_acknowledged: allergyAck || !form.safety?.allergy_warning,
        },
      });
      setSuccess(result);
      setConfirmOpen(false);
      onSold?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'OTC sale failed');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [allergyAck, encounterId, fee, fetchOptions, form, onSold, pid, quantity, selectedDrug]);

  const drugName = selectedDrug?.drug_name ?? form?.drug?.drug_name ?? 'Product';
  const currency = form?.fee?.currency_symbol ?? '';
  const lotLabel = formatFefoLotLabel(form?.inventory?.fefo_lot);
  const patientIdentity = form?.patient
    ? {
        display_name: form.patient.display_name ?? form.patient.patient_label ?? patientLabel,
        pubpid: form.patient.mrn,
      }
    : pid
      ? { display_name: patientLabel || 'Patient' }
      : null;

  const canSubmit = canDispense
    && !loadingForm
    && !success
    && pid != null
    && selectedDrug != null
    && form != null
    && !form.encounter_required
    && Number(quantity) > 0
    && (form.inventory?.can_fulfill !== false)
    && (!form.safety?.allergy_warning || allergyAck);

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        id="nc-pharmops-otc-drawer"
        title="Sell OTC"
        width="md"
        footer={success ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
            >
              Confirm sale
            </button>
          </>
        )}
      >
        {success ? (
          <div className="alert alert-success mb-0" role="status">
            Sold {success.drug_name ?? drugName} · qty {success.quantity}.
          </div>
        ) : (
          <>
            {!initialContext?.pid ? (
              <PatientSearchDropdown
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                inputId="nc-pharmops-otc-patient"
                resultsId="nc-pharmops-otc-patient-results"
                label="Patient"
                onSelectPatient={handleSelectPatient}
              />
            ) : patientIdentity ? (
              <PatientContextBanner layout="compact" identity={patientIdentity} />
            ) : null}

            <div className="mb-3 position-relative">
              <label className="small font-weight-bold mb-1" htmlFor="nc-pharmops-otc-drug">
                Product
              </label>
              <input
                id="nc-pharmops-otc-drug"
                type="search"
                className="form-control form-control-sm"
                placeholder="Search dispensable products"
                autoComplete="off"
                value={drugQuery}
                disabled={!pid}
                onChange={(e) => {
                  setDrugQuery(e.target.value);
                  setSelectedDrug(null);
                  setForm(null);
                }}
                onBlur={() => setTimeout(() => setDrugOpen(false), 150)}
                onFocus={() => {
                  if (drugResults.length > 0) setDrugOpen(true);
                }}
              />
              {loadingDrugs ? (
                <div className="small text-muted mt-1">Searching…</div>
              ) : null}
              {drugSearchError ? (
                <div className="small text-danger mt-1" role="alert">{drugSearchError}</div>
              ) : null}
              {drugOpen && drugQuery.trim().length >= 2 && !drugSearchError ? (
                <div
                  className="list-group position-absolute w-100 shadow-sm"
                  style={{ zIndex: 20, maxHeight: 240, overflowY: 'auto' }}
                >
                  {drugResults.length === 0 ? (
                    <div className="list-group-item text-muted">No products found</div>
                  ) : (
                    drugResults.map((row) => (
                      <button
                        key={row.drug_id}
                        type="button"
                        className="list-group-item list-group-item-action text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectDrug(row)}
                      >
                        <strong>{row.drug_name}</strong>
                        <span className="text-muted small ml-2">QOH {row.on_hand ?? 0}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {loadingForm ? (
              <p className="text-muted mb-0">Loading product details…</p>
            ) : loadError ? (
              <div className="alert alert-danger mb-0">{loadError}</div>
            ) : form ? (
              <>
                {form.encounter_warning ? (
                  <div className="alert alert-warning py-2 px-3 small">{form.encounter_warning}</div>
                ) : null}
                {patientIdentity ? (
                  <PatientContextBanner
                    layout="compact"
                    identity={patientIdentity}
                    safety={{
                      allergies_severe: form.safety?.allergy_warning
                        ? (form.safety.allergies ?? [])
                        : (form.safety?.allergies ?? []).slice(0, 3),
                    }}
                  />
                ) : null}
                <div className="oe-nc-pharmops-dispense__meta small text-muted mb-2">
                  {form.visit?.queue_number ? `Q#${form.visit.queue_number}` : null}
                  {form.visit?.queue_number && form.visit?.visit_date ? ' · ' : null}
                  {form.visit?.visit_date ? `Enc ${form.visit.visit_date}` : null}
                </div>
                <div className="oe-nc-pharmops-dispense__rx mb-3">
                  <div className="font-weight-bold">{drugName}</div>
                </div>
                <div className="oe-nc-pharmops-dispense__stock mb-3 small">
                  <div>
                    QOH: {form.inventory?.on_hand ?? 0}
                    {lotLabel ? ` · FEFO ${lotLabel}` : ''}
                  </div>
                  {form.inventory?.message ? (
                    <div className="text-warning mt-1">{form.inventory.message}</div>
                  ) : null}
                </div>
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label htmlFor="nc-pharmops-otc-qty">Qty</label>
                    <input
                      id="nc-pharmops-otc-qty"
                      type="number"
                      min={1}
                      className="form-control form-control-sm"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="form-group col-md-6">
                    <label htmlFor="nc-pharmops-otc-fee">Fee ({currency})</label>
                    <input
                      id="nc-pharmops-otc-fee"
                      type="number"
                      min={0}
                      step="0.01"
                      className="form-control form-control-sm"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                    />
                  </div>
                </div>
                {form.safety?.allergy_warning ? (
                  <div className="alert alert-warning py-2 px-3 small">
                    <div className="font-weight-bold mb-1">Allergy warning</div>
                    <div className="mb-2">
                      Documented allergies may match this product:
                      {' '}
                      {(form.safety.allergies ?? []).join(', ')}
                    </div>
                    <label className="mb-0 d-flex align-items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={allergyAck}
                        onChange={(e) => setAllergyAck(e.target.checked)}
                      />
                      I verified allergies with the patient
                    </label>
                  </div>
                ) : null}
                {submitError ? (
                  <div className="alert alert-danger py-2 px-3 small mb-0">{submitError}</div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </SlideOver>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm OTC sale"
        confirmLabel="Sell"
        confirmVariant="success"
        submitting={submitting}
        submittingLabel="Selling…"
        onConfirm={() => { void handleConfirm(); }}
        identityBanner={patientIdentity ? (
          <PatientContextBanner layout="compact" identity={patientIdentity} />
        ) : null}
      >
        <p className="mb-2">
          <strong>{drugName}</strong>
          {' · '}
          qty {quantity}
          {currency ? ` · ${currency}${fee}` : ''}
        </p>
        {lotLabel ? <p className="small text-muted mb-0">FEFO {lotLabel}</p> : null}
      </ConfirmModal>
    </>
  );
}
