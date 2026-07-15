import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { ConfirmModal } from '@components/ConfirmModal';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { formatFefoLotLabel } from './pharmOpsLotUtils';
import { usePharmDrugSearch } from './usePharmDrugSearch';
import type {
  OtcDrugSearchRow,
  OtcSaleConfirmResult,
  OtcSaleForm,
  OtcSaleInitialContext,
} from './pharmOpsTypes';

/** Round to cents for the fee input; empty string for anything not a positive amount. */
function moneyString(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  return String(Math.round(value * 100) / 100);
}

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
      // Fee defaults to unit price x quantity (falls back to the flat amount if no unit price).
      const unit = data.fee?.unit_amount ?? data.fee?.amount ?? 0;
      setFee(moneyString(unit * defaultQty));
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

  const unitPrice = form?.fee?.unit_amount ?? form?.fee?.amount ?? 0;
  const allowDiscount = form?.allow_discount === true;

  // Quantity sets the fee (qty x unit) — the listed price, and the starting point in discount mode.
  const handleQuantityChange = useCallback((value: string) => {
    setQuantity(value);
    const qty = Number(value);
    if (unitPrice > 0 && Number.isFinite(qty) && qty > 0) {
      setFee(moneyString(unitPrice * qty));
    }
  }, [unitPrice]);

  // Editing the amount: with the discount toggle ON it is a manual price, clamped so it can never
  // exceed the listed price (a discount only). With the toggle OFF it is a budget — the amount sets
  // how many whole units it buys, then snaps to the exact cost (never above the amount entered).
  const handleFeeBlur = useCallback(() => {
    const amount = Number(fee);
    if (unitPrice <= 0 || !Number.isFinite(amount) || amount <= 0) {
      return;
    }
    if (allowDiscount) {
      const listPrice = unitPrice * Math.max(1, Number(quantity) || 1);
      setFee(moneyString(Math.min(amount, listPrice)));
      return;
    }
    const qty = Math.max(1, Math.floor(amount / unitPrice));
    setQuantity(String(qty));
    setFee(moneyString(unitPrice * qty));
  }, [allowDiscount, fee, quantity, unitPrice]);

  const handleSelectPatient = useCallback((nextPid: number, row?: { display_name?: string }) => {
    setPid(nextPid);
    setPatientLabel(row?.display_name ?? '');
    setSelectedDrug(null);
    setDrugQuery('');
    setForm(null);
    setLoadError(null);
    setSuccess(null);
  }, []);

  // Walk-in flow: clear the picked patient to search again (the search box replaces the banner).
  const changePatient = useCallback(() => {
    setPid(null);
    setPatientLabel('');
    setEncounterId(null);
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

  const onHand = form?.inventory?.on_hand ?? 0;
  const qtyNum = Number(quantity);
  const feeNum = Number(fee);
  const overStock = form != null && Number.isFinite(qtyNum) && qtyNum > 0 && qtyNum > onHand;
  // The amount can never exceed the listed price (quantity x unit); a discount only ever lowers it.
  const listPrice = unitPrice > 0 && qtyNum > 0 ? unitPrice * qtyNum : Infinity;
  const overListPrice = feeNum > listPrice + 0.01;

  const canSubmit = canDispense
    && !loadingForm
    && !success
    && pid != null
    && selectedDrug != null
    && form != null
    && !form.encounter_required
    && qtyNum > 0
    && !overStock
    && feeNum > 0
    && !overListPrice
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
        dismissOnOutsideClick={false}
        footer={success ? (
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSubmit}
              onClick={() => setConfirmOpen(true)}
            >
              Confirm sale
            </Button>
          </>
        )}
      >
        {success ? (
          <div className={deskCalloutClass('success', 'mb-0')} role="status">
            Sold {success.drug_name ?? drugName} · qty {success.quantity}.
          </div>
        ) : (
          <>
            {pid == null ? (
              <PatientSearchDropdown
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                inputId="nc-pharmops-otc-patient"
                resultsId="nc-pharmops-otc-patient-results"
                label="Patient"
                onSelectPatient={handleSelectPatient}
              />
            ) : patientIdentity ? (
              <div className="mb-3">
                <PatientContextBanner
                  layout="compact"
                  identity={patientIdentity}
                  safety={form ? {
                    allergies_severe: form.safety?.allergy_warning
                      ? (form.safety.allergies ?? [])
                      : (form.safety?.allergies ?? []).slice(0, 3),
                  } : undefined}
                />
                {!initialContext?.pid ? (
                  <button
                    type="button"
                    className="text-sm text-[var(--oe-nc-primary,#2563eb)] underline mt-1"
                    onClick={changePatient}
                  >
                    Change patient
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mb-3 position-relative">
              <label className="text-sm font-bold mb-1" htmlFor="nc-pharmops-otc-drug">
                Product
              </label>
              <Input
                id="nc-pharmops-otc-drug"
                type="search"
                className="h-8"
                placeholder="Search dispensable products"
                autoComplete="off"
                value={drugQuery}
                disabled={!pid}
                onChange={(e) => {
                  setDrugQuery(e.target.value);
                  // Open the results as the user types — onFocus alone never fires once results
                  // arrive, so the list would otherwise stay hidden on the first search.
                  setDrugOpen(e.target.value.trim().length >= 2);
                  setSelectedDrug(null);
                  setForm(null);
                }}
                onBlur={() => setTimeout(() => setDrugOpen(false), 150)}
                onFocus={() => {
                  if (drugResults.length > 0) setDrugOpen(true);
                }}
              />
              {loadingDrugs ? (
                <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">Searching…</div>
              ) : null}
              {drugSearchError ? (
                <div className="text-sm text-[var(--oe-nc-danger,#dc2626)] mt-1" role="alert">{drugSearchError}</div>
              ) : null}
              {drugOpen && drugQuery.trim().length >= 2 && !drugSearchError ? (
                <div
                  className="nc-list-group absolute w-full shadow-sm"
                  style={{ zIndex: 20, maxHeight: 240, overflowY: 'auto' }}
                >
                  {drugResults.length === 0 ? (
                    <div className="nc-list-group-item text-[var(--oe-nc-text-muted)]">No products found</div>
                  ) : (
                    drugResults.map((row) => (
                      <button
                        key={row.drug_id}
                        type="button"
                        className="nc-list-group-item nc-list-group-item-action text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectDrug(row)}
                      >
                        <strong>{row.drug_name}</strong>
                        <span className="text-[var(--oe-nc-text-muted)] text-sm ml-2">QOH {row.on_hand ?? 0}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {loadingForm ? (
              <p className="text-[var(--oe-nc-text-muted)] mb-0">Loading product details…</p>
            ) : loadError ? (
              <div className={deskCalloutClass('error', 'mb-0')}>{loadError}</div>
            ) : form ? (
              <>
                {form.encounter_warning ? (
                  <div className={deskCalloutClass('warn', 'py-2 px-3 text-sm')}>{form.encounter_warning}</div>
                ) : null}
                <div className="nc-pharmops-dispense-meta text-sm text-[var(--oe-nc-text-muted)] mb-2">
                  {form.visit?.queue_number ? `Q#${form.visit.queue_number}` : null}
                  {form.visit?.queue_number && form.visit?.visit_date ? ' · ' : null}
                  {form.visit?.visit_date ? `Enc ${form.visit.visit_date}` : null}
                </div>
                <div className="nc-pharmops-dispense-rx mb-3">
                  <div className="font-bold">{drugName}</div>
                </div>
                <div className="nc-pharmops-dispense-stock mb-3 text-sm">
                  <div>
                    QOH: {form.inventory?.on_hand ?? 0}
                    {lotLabel ? ` · FEFO ${lotLabel}` : ''}
                  </div>
                  {form.inventory?.message ? (
                    <div className="text-[var(--color-oe-warning,#ea580c)] mt-1">{form.inventory.message}</div>
                  ) : null}
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="nc-form-group col-span-12 md:col-span-6">
                    <label htmlFor="nc-pharmops-otc-qty">Qty</label>
                    <Input
                      id="nc-pharmops-otc-qty"
                      type="number"
                      min={1}
                      className="h-8"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                    />
                    {overStock ? (
                      <div className="text-[var(--oe-nc-danger,#dc2626)] text-sm mt-1" role="alert">
                        Only {onHand} in stock.
                      </div>
                    ) : null}
                  </div>
                  <div className="nc-form-group col-span-12 md:col-span-6">
                    <label htmlFor="nc-pharmops-otc-fee">
                      {unitPrice > 0 ? 'Amount to pay' : 'Fee'} ({currency})
                    </label>
                    <Input
                      id="nc-pharmops-otc-fee"
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      onBlur={handleFeeBlur}
                    />
                    {unitPrice > 0 ? (
                      <div className="text-[var(--oe-nc-text-muted)] text-sm mt-1">
                        {currency}{moneyString(unitPrice)} each · list {currency}{moneyString(unitPrice * (qtyNum > 0 ? qtyNum : 1))}
                        {allowDiscount
                          ? ' — you can lower it (discount)'
                          : ' — the amount sets how many units'}
                      </div>
                    ) : null}
                    {overListPrice ? (
                      <div className="text-[var(--oe-nc-danger,#dc2626)] text-sm mt-1" role="alert">
                        Amount can’t be more than the listed price.
                      </div>
                    ) : null}
                  </div>
                </div>
                {form.safety?.allergy_warning ? (
                  <div className={deskCalloutClass('warn', 'py-2 px-3 text-sm')}>
                    <div className="font-bold mb-1">Allergy warning</div>
                    <div className="mb-2">
                      Documented allergies may match this product:
                      {' '}
                      {(form.safety.allergies ?? []).join(', ')}
                    </div>
                    <label className="mb-0 flex items-center">
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
                  <div className={deskCalloutClass('error', 'py-2 px-3 text-sm mb-0')}>{submitError}</div>
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
        {lotLabel ? <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">FEFO {lotLabel}</p> : null}
      </ConfirmModal>
    </>
  );
}
