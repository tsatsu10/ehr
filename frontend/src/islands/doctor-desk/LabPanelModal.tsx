/**
 * LabPanelModal — quick lab order panel (M4-F36 / V1.1-LAB-ORD).
 *
 * Mirrors openLabPanelModal() + placeLabPanelOrder() from doctor.js.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type {
  DoctorVisit,
  LabPanelCatalogData,
  LabPanelCatalogTest,
  LabPanelPlaceResult,
  RoutingChips,
} from '@core/types';
import { postDoctorAction } from './postDoctorAction';

function formatLabMoney(symbol: string, amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '';
  return `${symbol}${Number(amount).toFixed(2)}`;
}

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
    if (!catalog) return null;
    let total = 0;
    let hasFee = false;
    for (const test of catalog.tests) {
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
    if (!catalog) return;
    setSelected(new Set(catalog.tests.filter((t) => t.is_starter).map((t) => t.procedure_type_id)));
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

  if (!open || !visit) return null;

  const hintParts: string[] = [];
  if (catalog?.provider_name) hintParts.push(`From ${catalog.provider_name}`);
  if (catalog?.auto_bill_on_order) hintParts.push('Mapped tests auto-add cashier charges');

  return (
    <>
      <div
        className="modal fade show d-block"
        id="nc-doctor-lab-panel-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-doctor-lab-panel-title"
        aria-modal="true"
      >
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-doctor-lab-panel-title">Quick lab order</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              {hintParts.length > 0 && (
                <p className="text-muted small" id="nc-lab-panel-hint">
                  {hintParts.join(' — ')}.
                </p>
              )}

              <div id="nc-lab-panel-tests">
                {loading && <p className="text-muted small mb-0">Loading tests…</p>}
                {!loading && catalog && !catalog.has_catalog && (
                  <p className="text-warning mb-0">
                    Lab catalog is not ready. Use Full lab form or complete Lab Operations setup.
                  </p>
                )}
                {!loading && catalog?.has_catalog && catalog.tests.map((test: LabPanelCatalogTest) => (
                  <div className="form-check" key={test.procedure_type_id}>
                    <input
                      className="form-check-input nc-lab-panel-test"
                      type="checkbox"
                      id={`nc-lab-panel-test-${test.procedure_type_id}`}
                      checked={selected.has(test.procedure_type_id)}
                      onChange={(e) => toggleTest(test.procedure_type_id, e.target.checked)}
                    />
                    <label
                      className="form-check-label"
                      htmlFor={`nc-lab-panel-test-${test.procedure_type_id}`}
                    >
                      {test.name}
                      {test.code && (
                        <span className="text-muted"> ({test.code})</span>
                      )}
                      {test.has_fee ? (
                        <span className="text-muted">
                          {' '}
                          {formatLabMoney(catalog.currency_symbol, test.fee_amount)}
                        </span>
                      ) : (
                        <span className="text-muted"> (no fee mapped)</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>

              {catalog?.has_catalog && (
                <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    id="nc-lab-panel-starter"
                    onClick={applyStarterPanel}
                  >
                    Starter panel
                  </button>
                  <span className="text-muted small" id="nc-lab-panel-total">
                    {estimatedTotal != null
                      ? `Estimated: ${formatLabMoney(catalog.currency_symbol, estimatedTotal)}`
                      : ''}
                  </span>
                </div>
              )}

              {error && (
                <div className="alert alert-danger mt-2 mb-0" id="nc-lab-panel-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary nc-lab-panel-full-form" onClick={onFullLabForm}>
                Full lab form
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                id="nc-lab-panel-place"
                disabled={submitting || blocked || !catalog?.has_catalog}
                onClick={() => void handlePlace()}
              >
                {submitting ? 'Placing order…' : 'Place order'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" id="nc-doctor-modal-backdrop" />
    </>
  );
}

/** Build user-facing notice after a lab panel order is placed. */
export function labPanelPlaceNotice(result: LabPanelPlaceResult): { message: string; variant: 'info' | 'success' } {
  const billing = result.billing ?? {};
  if ((billing.posted_count ?? 0) > 0) {
    return {
      message: `${billing.posted_count} lab charge(s) posted to encounter (${formatLabMoney(
        billing.currency_symbol ?? '',
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
