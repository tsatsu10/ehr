import { useEffect, useState } from 'react';

interface CloseZeroModalProps {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CloseZeroModal({ open, submitting, error, onClose, onConfirm }: CloseZeroModalProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Close without charge</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-2">Close this visit with no charges. Reason is required.</p>
              <div className="form-group mb-0">
                <label htmlFor="nc-cashier-close-zero-reason">Reason</label>
                <textarea
                  className="form-control"
                  id="nc-cashier-close-zero-reason"
                  rows={3}
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
                className="btn btn-success"
                disabled={submitting || reason.trim() === ''}
                onClick={() => onConfirm(reason.trim())}
              >
                {submitting ? 'Closing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
