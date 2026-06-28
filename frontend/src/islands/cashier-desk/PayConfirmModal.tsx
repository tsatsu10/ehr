import type { CashierVisit, PatientPreview } from '@core/types';
import { formatMoney } from './cashierUtils';

interface PayConfirmModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  total: number;
  amountReceived: number;
  completionBlocked: boolean;
  canSkipCompletion: boolean;
  esignOverride?: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PayConfirmModal({
  open,
  preview,
  visit,
  total,
  amountReceived,
  completionBlocked,
  canSkipCompletion,
  esignOverride = false,
  submitting,
  onClose,
  onConfirm,
}: PayConfirmModalProps) {
  if (!open || !preview || !visit) return null;

  const identity = preview.identity;
  const change = Math.max(0, amountReceived - total);

  return (
    <>
      <div
        className="modal fade show d-block"
        id="nc-cashier-pay-confirm-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-cashier-pay-confirm-title"
        aria-modal="true"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-cashier-pay-confirm-title">Confirm payment</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body" id="nc-cashier-pay-confirm-body">
              <div className="nc-patient-context-banner p-3 border rounded bg-light mb-3">
                <div>
                  <strong>Patient:</strong> {identity.display_name} · MRN {identity.pubpid} · Queue #{visit.queue_number}
                </div>
              </div>
              {completionBlocked && canSkipCompletion && (
                <div className="alert alert-warning py-2 mb-3">
                  Profile completion override — payment will proceed despite incomplete profile (
                  {preview.completion.score}% vs {preview.completion.billing_threshold}% required).
                </div>
              )}
              {esignOverride && (
                <div className="alert alert-warning py-2 mb-3">
                  E-Sign supervisor override — unsigned documentation will be recorded in the audit log.
                </div>
              )}
              <dl className="row mb-0">
                <dt className="col-sm-5">Total due</dt>
                <dd className="col-sm-7"><strong>{formatMoney(total)}</strong></dd>
                <dt className="col-sm-5">Cash received</dt>
                <dd className="col-sm-7">{formatMoney(amountReceived)}</dd>
                <dt className="col-sm-5">Change</dt>
                <dd className="col-sm-7">{formatMoney(change)}</dd>
              </dl>
              <p className="small text-muted mb-0 mt-3">Confirm patient identity before posting payment.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-success"
                id="nc-cashier-pay-confirm-btn"
                disabled={submitting}
                onClick={onConfirm}
              >
                {submitting ? 'Processing…' : 'Confirm payment'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" id="nc-cashier-pay-confirm-backdrop" />
    </>
  );
}
