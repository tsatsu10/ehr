import { useEffect, useState } from 'react';
import type { CashierVisit, PatientPreview } from '@core/types';

interface MarkUnpaidModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function MarkUnpaidModal({
  open,
  preview,
  visit,
  submitting,
  error,
  onClose,
  onConfirm,
}: MarkUnpaidModalProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open || !preview || !visit) return null;

  const identity = preview.identity;

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Mark left unpaid</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="nc-patient-context-banner p-3 border rounded bg-light mb-3">
                <strong>{identity.display_name}</strong> · MRN {identity.pubpid} · Queue #{visit.queue_number}
              </div>
              <p className="mb-2">Record that this patient left without paying. Reason is required.</p>
              <div className="form-group mb-0">
                <label htmlFor="nc-cashier-terminal-reason">Reason</label>
                <textarea
                  className="form-control"
                  id="nc-cashier-terminal-reason"
                  rows={3}
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {error && <div className="alert alert-danger mt-2 mb-0">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-warning"
                disabled={submitting || reason.trim() === ''}
                onClick={() => onConfirm(reason.trim())}
              >
                {submitting ? 'Saving…' : 'Mark left unpaid'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
