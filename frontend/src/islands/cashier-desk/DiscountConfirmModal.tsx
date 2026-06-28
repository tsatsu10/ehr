import type { CashierDiscountLine, CashierVisit, PatientPreview } from '@core/types';
import { formatMoney } from './cashierUtils';

interface DiscountConfirmModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  lines: CashierDiscountLine[];
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DiscountConfirmModal({
  open,
  preview,
  visit,
  lines,
  submitting,
  onClose,
  onConfirm,
}: DiscountConfirmModalProps) {
  if (!open || !preview || !visit) return null;

  const identity = preview.identity;

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Confirm discounted charges</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="nc-patient-context-banner p-3 border rounded bg-light mb-3">
                <strong>{identity.display_name}</strong> · MRN {identity.pubpid} · Queue #{visit.queue_number}
              </div>
              {lines.length === 0 ? (
                <p className="mb-0">Post discounted charges to this visit?</p>
              ) : (
                <>
                  <p className="mb-2">The following lines are below the standard fee schedule price:</p>
                  <table className="table table-sm table-bordered mb-2">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th className="text-right">Standard</th>
                        <th className="text-right">Posted</th>
                        <th className="text-right">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.name}>
                          <td>{line.name}</td>
                          <td className="text-right">{formatMoney(line.standard)}</td>
                          <td className="text-right">{formatMoney(line.posted)}</td>
                          <td className="text-right text-danger">-{formatMoney(line.discount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <p className="small text-muted mb-0">Confirm patient identity before posting discounted charges.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={onConfirm}>
                {submitting ? 'Posting…' : 'Post charges'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
