/**
 * LabPanelModal — quick lab order panel (M4-F36 / V1.1-LAB-ORD).
 *
 * Mirrors openLabPanelModal() + placeLabPanelOrder() from doctor.js.
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
  LabPanelCatalogData,
  LabPanelCatalogTest,
  LabPanelPlaceResult,
  RoutingChips,
} from '@core/types';
import { postDoctorAction } from './postDoctorAction';
import { formatDoctorMoney } from './doctorDeskUtils';

interface LabPanelModalProps {
  open: boolean;
  visit: DoctorVisit | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onPlaced: (result: LabPanelPlaceResult) => void;
  onFullLabForm: () => void;
}

export function LabPanelModal({
  open,
  visit,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onPlaced,
  onFullLabForm,
}: LabPanelModalProps) {
  useModalDismiss(open, onClose);

  const [catalog, setCatalog] = useState<LabPanelCatalogData | null>(null);
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

    void oeFetch<LabPanelCatalogData>('doctor.lab_panel_catalog', {
      ajaxUrl,
      csrfToken,
      params: facilityParams,
    })
      .then(setCatalog)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load catalog');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit?.id, ajaxUrl, csrfToken, facilityId]);

  const estimatedTotal = useMemo(() => {
    if (!catalog?.tests) return null;
    const tests = catalog.tests ?? [];
    let total = 0;
    let hasFee = false;
    for (const test of tests) {
      if (selected.has(test.procedure_type_id) && test.fee_amount != null && !Number.isNaN(test.fee_amount)) {
        total += test.fee_amount;
        hasFee = true;
      }
    }
    return hasFee ? total : null;
  }, [catalog, selected]);

  const toggleTest = useCallback((testId: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(testId);
      else next.delete(testId);
      return next;
    });
  }, []);

  const applyStarterPanel = useCallback(() => {
    if (!catalog?.tests?.length) return;
    setSelected(new Set((catalog.tests ?? []).filter((t) => t.is_starter).map((t) => t.procedure_type_id)));
  }, [catalog]);

  const handlePlace = async () => {
    if (!visit || blocked || submitting) return;

    const ids = [...selected];
    if (ids.length === 0) {
      setError('Select at least one test.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await postDoctorAction<LabPanelPlaceResult>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'doctor.lab_panel_place',
      body: { visit_id: visit.id, procedure_type_ids: ids },
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message || 'Order failed');
      return;
    }

    onPlaced(result.data);
  };

  const tests = catalog?.tests ?? [];

  if (!visit) return null;

  const hintParts: string[] = [];
  if (catalog?.provider_name) hintParts.push(`From ${catalog.provider_name}`);
  if (catalog?.auto_bill_on_order) hintParts.push('Mapped tests auto-add cashier charges');

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-doctor-lab-panel-modal"
        className={dialogContentSizeClass.lg}
        aria-labelledby="nc-doctor-lab-panel-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-doctor-lab-panel-title">Quick lab order</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          {hintParts.length > 0 && (
            <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3" id="nc-lab-panel-hint">
              {hintParts.join(' — ')}.
            </p>
          )}

          <div id="nc-lab-panel-tests" className="nc-catalog-picker">
            {loading && <p className="text-[var(--oe-nc-text-muted)] text-sm mb-0">Loading tests…</p>}
            {!loading && catalog && !catalog.has_catalog && (
              <p className={deskCalloutClass('warn', 'text-sm mb-0')}>
                Lab catalog is not ready. Use Full lab form or complete Lab Operations setup.
              </p>
            )}
            {!loading && catalog?.has_catalog && tests.map((test: LabPanelCatalogTest) => (
              <div className="flex items-start gap-2 mb-2" key={test.procedure_type_id}>
                <Checkbox
                  className="nc-lab-panel-test mt-0.5"
                  id={`nc-lab-panel-test-${test.procedure_type_id}`}
                  checked={selected.has(test.procedure_type_id)}
                  onCheckedChange={(checked) => toggleTest(test.procedure_type_id, checked === true)}
                />
                <Label
                  htmlFor={`nc-lab-panel-test-${test.procedure_type_id}`}
                  className="font-normal leading-snug cursor-pointer"
                >
                  {test.name}
                  {test.code && (
                    <span className="text-[var(--oe-nc-text-muted)]"> ({test.code})</span>
                  )}
                  {test.has_fee ? (
                    <span className="text-[var(--oe-nc-text-muted)]">
                      {' '}
                      {formatDoctorMoney(test.fee_amount)}
                    </span>
                  ) : (
                    <span className="text-[var(--oe-nc-text-muted)]"> (no fee mapped)</span>
                  )}
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
                id="nc-lab-panel-starter"
                onClick={applyStarterPanel}
              >
                Starter panel
              </Button>
              <span className="text-[var(--oe-nc-text-muted)] text-sm" id="nc-lab-panel-total">
                {estimatedTotal != null
                  ? `Estimated: ${formatDoctorMoney(estimatedTotal)}`
                  : ''}
              </span>
            </div>
          )}

          {error && (
            <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} id="nc-lab-panel-error" role="alert">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter className="justify-between sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="nc-lab-panel-full-form mr-auto"
            onClick={onFullLabForm}
          >
            Full lab form
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            id="nc-lab-panel-place"
            disabled={submitting || blocked || !catalog?.has_catalog}
            onClick={() => void handlePlace()}
          >
            {submitting ? 'Placing order…' : 'Place order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Build user-facing notice after a lab panel order is placed. */
export function labPanelPlaceNotice(result: LabPanelPlaceResult): { message: string; variant: 'info' | 'success' } {
  const billing = result.billing ?? {};
  if ((billing.posted_count ?? 0) > 0) {
    return {
      message: `${billing.posted_count} lab charge(s) posted to encounter (${formatDoctorMoney(
        billing.charges_total,
      )}).`,
      variant: 'info',
    };
  }
  if ((billing.unmapped_codes ?? []).length > 0) {
    return {
      message: 'Lab order placed. Map fees in Lab Ops setup to auto-post charges.',
      variant: 'info',
    };
  }
  return { message: 'Lab order placed for this visit.', variant: 'success' };
}

/** Notice after returning from full lab form shortcut (pageshow). */
export function labReturnNotice(chips: RoutingChips | undefined): { message: string; variant: 'warning' | 'success' } | null {
  if (!chips?.lab_ordered) return null;
  if (chips.lab_order_incomplete) {
    return {
      message: 'Lab order saved but no tests were added. Open Order lab again and add at least one test line.',
      variant: 'warning',
    };
  }
  return {
    message: 'Lab order saved for this visit. Continue the consult or route to lab when finished.',
    variant: 'success',
  };
}
