/**
 * FormularyRxModal — quick prescribe from OPD formulary (M4-F37 / V1.2-PHARM-RX).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { useModalDismiss } from '@components/useModalDismiss';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { Label } from '@components/ui/label';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import type {
  DoctorVisit,
  FormularyRxCatalogData,
  FormularyRxCatalogDrug,
  FormularyRxPlaceResult,
} from '@core/types';
import { postDoctorAction } from './postDoctorAction';
import { formatDoctorMoney } from './doctorDeskUtils';
import { Badge } from '@components/ui/badge';
import { stockBadgeVariant, stockLabel } from '../pharm-ops/pharmOpsStockUtils';

interface FormularyRxModalProps {
  open: boolean;
  visit: DoctorVisit | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onPlaced: (result: FormularyRxPlaceResult) => void;
  onFullRxForm: () => void;
}

export function FormularyRxModal({
  open,
  visit,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onPlaced,
  onFullRxForm,
}: FormularyRxModalProps) {
  useModalDismiss(open, onClose);

  const [catalog, setCatalog] = useState<FormularyRxCatalogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const facilityParams: Record<string, string | number> | undefined =
    facilityId > 0 ? { facility_id: facilityId } : undefined;

  useEffect(() => {
    if (!open || !visit) return;

    setLoading(true);
    setCatalog(null);
    setSelected(new Set());
    setError(null);

    void oeFetch<FormularyRxCatalogData>('doctor.formulary_rx_catalog', {
      ajaxUrl,
      csrfToken,
      params: facilityParams,
    })
      .then(setCatalog)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load formulary');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit?.id, ajaxUrl, csrfToken, facilityId]);

  const estimatedTotal = useMemo(() => {
    if (!catalog) return null;
    let total = 0;
    let hasFee = false;
    for (const drug of catalog.drugs) {
      if (selected.has(drug.drug_id) && drug.fee_amount != null && !Number.isNaN(drug.fee_amount)) {
        total += drug.fee_amount;
        hasFee = true;
      }
    }
    return hasFee ? total : null;
  }, [catalog, selected]);

  const toggleDrug = useCallback((drugId: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(drugId);
      else next.delete(drugId);
      return next;
    });
  }, []);

  const applyStarterPack = useCallback(() => {
    if (!catalog) return;
    setSelected(new Set(catalog.drugs.filter((d) => d.is_starter).map((d) => d.drug_id)));
  }, [catalog]);

  const handlePlace = async () => {
    if (!visit || blocked || submitting) return;

    const ids = [...selected];
    if (ids.length === 0) {
      setError('Select at least one medication.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await postDoctorAction<FormularyRxPlaceResult>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'doctor.formulary_rx_place',
      body: { visit_id: visit.id, drug_ids: ids },
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message || 'Prescribe failed');
      return;
    }

    onPlaced(result.data);
  };

  if (!visit) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-doctor-formulary-rx-modal"
        className={dialogContentSizeClass.lg}
        aria-labelledby="nc-doctor-formulary-rx-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-doctor-formulary-rx-title">Quick prescribe</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3">
            Pick from the clinic OPD formulary. Stock quantity on hand is shown when Pharmacy Operations is enabled.
          </p>

          <div id="nc-formulary-rx-drugs" className="nc-catalog-picker">
            {loading && <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">Loading formulary…</p>}
            {!loading && catalog && !catalog.has_catalog && (
              <p className={deskCalloutClass('warn', 'text-sm mb-0')}>
                Formulary is not ready. Use Full Rx form or import the starter pack in Pharm Ops setup.
              </p>
            )}
            {!loading && catalog?.has_catalog && catalog.drugs.map((drug: FormularyRxCatalogDrug) => (
              <div className="flex items-start gap-2 mb-2" key={drug.drug_id}>
                <Checkbox
                  className="nc-formulary-rx-drug mt-0.5"
                  id={`nc-formulary-rx-drug-${drug.drug_id}`}
                  checked={selected.has(drug.drug_id)}
                  onCheckedChange={(checked) => toggleDrug(drug.drug_id, checked === true)}
                />
                <Label
                  htmlFor={`nc-formulary-rx-drug-${drug.drug_id}`}
                  className="font-normal leading-snug cursor-pointer"
                >
                  {drug.display_name || drug.name}
                  {drug.dosage ? (
                    <span className="text-[var(--oe-nc-text-muted)]"> — {drug.dosage}</span>
                  ) : null}
                  {drug.quantity ? (
                    <span className="text-[var(--oe-nc-text-muted)]"> · qty {drug.quantity}</span>
                  ) : null}
                  {drug.has_fee ? (
                    <span className="text-[var(--oe-nc-text-muted)]">
                      {' '}
                      {formatDoctorMoney(drug.fee_amount)}
                    </span>
                  ) : null}
                  {drug.qoh_display ? (
                    <Badge variant={stockBadgeVariant(drug.stock_status)} className="ml-1 align-middle">
                      {drug.qoh_display}
                      {stockLabel(drug.stock_status) ? ` · ${stockLabel(drug.stock_status)}` : ''}
                    </Badge>
                  ) : null}
                </Label>
              </div>
            ))}
          </div>

          {catalog?.has_catalog && (
            <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                id="nc-formulary-rx-starter"
                onClick={applyStarterPack}
              >
                Starter pack
              </Button>
              <span className="text-[var(--oe-nc-text-muted)] text-sm" id="nc-formulary-rx-total">
                {estimatedTotal != null
                  ? `Est. unit fees: ${formatDoctorMoney(estimatedTotal)}`
                  : ''}
              </span>
            </div>
          )}

          {error && (
            <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} id="nc-formulary-rx-error" role="alert">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter className="justify-between sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="nc-formulary-rx-full-form mr-auto"
            onClick={onFullRxForm}
          >
            Full Rx form
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            id="nc-formulary-rx-place"
            disabled={submitting || blocked || !catalog?.has_catalog}
            onClick={() => void handlePlace()}
          >
            {submitting ? 'Prescribing…' : 'Add prescriptions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formularyRxPlaceNotice(result: FormularyRxPlaceResult): { message: string; variant: 'success' | 'info' } {
  const count = result.prescription_count ?? result.prescription_ids?.length ?? 0;
  if (count === 1) {
    return { message: '1 prescription added to this encounter.', variant: 'success' };
  }

  return {
    message: `${count} prescriptions added to this encounter.`,
    variant: 'success',
  };
}
