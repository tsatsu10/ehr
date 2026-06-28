import { useEffect, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import type { PendingVisitAction } from './reportsTypes';

interface ReasonModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  confirmClass: string;
  patientLabel: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function ReasonModal({
  open,
  title,
  confirmLabel,
  confirmClass,
  patientLabel,
  submitting,
  error,
  onClose,
  onConfirm,
}: ReasonModalProps) {
  const [reason, setReason] = useState('');
  useModalDismiss(open, onClose);

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
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-2">{patientLabel}</p>
              <div className="form-group mb-0">
                <label htmlFor="nc-reports-action-reason">Reason (required)</label>
                <textarea
                  id="nc-reports-action-reason"
                  className="form-control"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {error && <div className="alert alert-danger mt-2 mb-0">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
              <button
                type="button"
                className={`btn ${confirmClass}`}
                disabled={submitting || reason.trim() === ''}
                onClick={() => onConfirm(reason.trim())}
              >
                {submitting ? 'Saving…' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

interface ReportsActionModalsProps {
  cancelTarget: PendingVisitAction | null;
  markUnpaidTarget: PendingVisitAction | null;
  submitting: boolean;
  cancelError: string | null;
  markUnpaidError: string | null;
  onCloseCancel: () => void;
  onCloseMarkUnpaid: () => void;
  onConfirmCancel: (reason: string) => void;
  onConfirmMarkUnpaid: (reason: string) => void;
}

function patientLabel(action: PendingVisitAction): string {
  return `${action.displayName} · MRN ${action.pubpid}`;
}

export function ReportsActionModals({
  cancelTarget,
  markUnpaidTarget,
  submitting,
  cancelError,
  markUnpaidError,
  onCloseCancel,
  onCloseMarkUnpaid,
  onConfirmCancel,
  onConfirmMarkUnpaid,
}: ReportsActionModalsProps) {
  return (
    <>
      <ReasonModal
        open={cancelTarget !== null}
        title="Cancel visit"
        confirmLabel="Cancel visit"
        confirmClass="btn-danger"
        patientLabel={cancelTarget ? patientLabel(cancelTarget) : ''}
        submitting={submitting}
        error={cancelError}
        onClose={onCloseCancel}
        onConfirm={onConfirmCancel}
      />
      <ReasonModal
        open={markUnpaidTarget !== null}
        title="Mark visit unpaid"
        confirmLabel="Mark unpaid"
        confirmClass="btn-warning"
        patientLabel={markUnpaidTarget ? patientLabel(markUnpaidTarget) : ''}
        submitting={submitting}
        error={markUnpaidError}
        onClose={onCloseMarkUnpaid}
        onConfirm={onConfirmMarkUnpaid}
      />
    </>
  );
}
