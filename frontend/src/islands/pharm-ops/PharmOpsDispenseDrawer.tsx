import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal } from '@components/ConfirmModal';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { SlideOver } from '@components/SlideOver';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import type { DispenseConfirmResult, DispenseForm } from './pharmOpsTypes';
import { openDispenseLabelPdf } from './labelPrintUtils';
import { formatFefoLotLabel } from './pharmOpsLotUtils';

interface PharmOpsDispenseDrawerProps {
  open: boolean;
  prescriptionId: number | null;
  ajaxUrl: string;
  csrfToken: string;
  canDispense: boolean;
  onClose: () => void;
  onDispensed: () => void;
}

function patientIdentity(form: DispenseForm | null) {
  const patient = form?.patient;
  return {
    display_name: patient?.display_name ?? patient?.patient_label ?? 'Patient',
    pubpid: patient?.mrn,
  };
}

export function PharmOpsDispenseDrawer({
  open,
  prescriptionId,
  ajaxUrl,
  csrfToken,
  canDispense,
  onClose,
  onDispensed,
}: PharmOpsDispenseDrawerProps) {
  const [form, setForm] = useState<DispenseForm | null>(null);
  const [quantity, setQuantity] = useState('');
  const [fee, setFee] = useState('');
  const [allergyAck, setAllergyAck] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<DispenseConfirmResult | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const loadForm = useCallback(async (id: number) => {
    setLoading(true);
    setLoadError(null);
    setSuccess(null);
    try {
      const data = await oeFetch<DispenseForm>('pharm_ops.dispense_get', {
        ...fetchOptions,
        json: { prescription_id: id },
      });
      setForm(data);
      const defaultQty = data.drug?.default_quantity ?? data.drug?.qty_remaining ?? 1;
      setQuantity(String(defaultQty));
      setFee(String(data.fee?.amount ?? 0));
      setAllergyAck(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load dispense form');
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    if (!open || !prescriptionId) {
      setForm(null);
      setLoadError(null);
      setSuccess(null);
      return;
    }
    void loadForm(prescriptionId);
  }, [loadForm, open, prescriptionId]);

  const handleConfirm = useCallback(async () => {
    if (!prescriptionId || !form) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await oeFetch<DispenseConfirmResult>('pharm_ops.dispense_confirm', {
        ...fetchOptions,
        json: {
          prescription_id: prescriptionId,
          quantity: Number(quantity),
          fee: Number(fee),
          allergy_acknowledged: allergyAck || !form.safety?.allergy_warning,
        },
      });
      setSuccess(result);
      setConfirmOpen(false);
      onDispensed();
      if (result.can_print_label && result.sale_id) {
        setLabelError(null);
        void openDispenseLabelPdf(ajaxUrl, csrfToken, result.sale_id, true).catch((err) => {
          setLabelError(err instanceof Error ? err.message : 'Could not open dispense label');
        });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Dispense failed');
      setConfirmOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [allergyAck, ajaxUrl, csrfToken, fee, fetchOptions, form, onDispensed, prescriptionId, quantity]);

  const drugName = form?.drug?.drug_name ?? 'Medication';
  const currency = form?.fee?.currency_symbol ?? '';
  const lotLabel = formatFefoLotLabel(form?.inventory?.fefo_lot);
  const canSubmit = canDispense
    && !loading
    && !success
    && Number(quantity) > 0
    && (form?.inventory?.can_fulfill !== false)
    && (!form?.safety?.allergy_warning || allergyAck);

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        dismissOnOutsideClick={false}
        id="nc-pharmops-dispense-drawer"
        title={`Dispense — ${drugName}`}
        width="md"
        footer={success ? (
          <>
            {success.can_print_label && success.sale_id ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mr-2"
                onClick={() => {
                  void openDispenseLabelPdf(ajaxUrl, csrfToken, success.sale_id);
                }}
              >
                Print label
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={onClose}>
              Close
            </Button>
          </>
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
              Confirm dispense
            </Button>
          </>
        )}
      >
        {loading ? (
          <p className="text-[var(--oe-nc-text-muted)] mb-0">Loading…</p>
        ) : loadError ? (
          <div className={deskCalloutClass('error', 'mb-0')}>{loadError}</div>
        ) : success ? (
          <div className={deskCalloutClass('success', 'mb-0')} role="status">
            Dispensed {success.drug_name ?? drugName}
            {success.dispense_status === 'partial' ? ' (partial)' : ''}.
            {success.can_print_label ? (
              <div className="text-sm mt-1 mb-0">Patient label opened in a new tab when pop-ups are allowed.</div>
            ) : null}
            {labelError ? (
              <div className={deskCalloutClass('warn', 'mt-2 mb-0 py-2')} role="alert">{labelError}</div>
            ) : null}
          </div>
        ) : form ? (
          <>
            <PatientContextBanner
              layout="compact"
              identity={patientIdentity(form)}
              safety={{
                allergies_severe: form.safety?.allergy_warning
                  ? (form.safety.allergies ?? [])
                  : (form.safety?.allergies ?? []).slice(0, 3),
              }}
            />
            <div className="nc-pharmops-dispense-meta text-sm text-[var(--oe-nc-text-muted)] mb-2">
              {form.visit?.queue_number ? `Q#${form.visit.queue_number}` : null}
              {form.visit?.queue_number && form.visit?.visit_date ? ' · ' : null}
              {form.visit?.visit_date ? `Enc ${form.visit.visit_date}` : null}
            </div>
            <div className="nc-pharmops-dispense-rx mb-3">
              <div className="font-bold">{drugName}</div>
              {form.drug?.sig ? (
                <div className="text-sm text-[var(--oe-nc-text-muted)]">{form.drug.sig}</div>
              ) : null}
              {form.drug?.qty_ordered ? (
                <div className="text-sm text-[var(--oe-nc-text-muted)]">
                  Prescribed {form.drug.qty_ordered}
                  {form.drug.qty_dispensed ? ` · dispensed ${form.drug.qty_dispensed}` : ''}
                  {form.drug.qty_remaining ? ` · remaining ${form.drug.qty_remaining}` : ''}
                </div>
              ) : null}
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
                <label htmlFor="nc-pharmops-dispense-qty">Dispense qty</label>
                <Input
                  id="nc-pharmops-dispense-qty"
                  type="number"
                  min={1}
                  className="h-8"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="nc-form-group col-span-12 md:col-span-6">
                <label htmlFor="nc-pharmops-dispense-fee">Fee ({currency})</label>
                <Input
                  id="nc-pharmops-dispense-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-8"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
            </div>
            {form.safety?.allergy_warning ? (
              <div className={deskCalloutClass('warn', 'py-2 px-3 text-sm')}>
                <div className="font-bold mb-1">Allergy warning</div>
                <div className="mb-2">
                  Documented allergies may match this medication:
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
      </SlideOver>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm dispense"
        confirmLabel="Dispense"
        confirmVariant="success"
        submitting={submitting}
        submittingLabel="Dispensing…"
        onConfirm={() => { void handleConfirm(); }}
        identityBanner={form ? (
          <PatientContextBanner layout="compact" identity={patientIdentity(form)} />
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
