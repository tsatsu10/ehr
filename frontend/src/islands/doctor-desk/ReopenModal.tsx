/**
 * ReopenModal — reopen a completed consult for new lab/Rx orders.
 */

import { useEffect, useState } from 'react';
import type { DoctorReopenableRow, DoctorConsultPayload } from '@core/types';
import { postDoctorAction } from './postDoctorAction';

interface ReopenModalProps {
  open: boolean;
  target: DoctorReopenableRow | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onReopened: (payload: DoctorConsultPayload) => void;
  onConflict: (message: string) => void;
}

export function ReopenModal({
  open,
  target,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onReopened,
  onConflict,
}: ReopenModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
  }, [open, target?.id]);

  if (!open || !target) return null;

  const handleConfirm = async () => {
    if (blocked || submitting) return;

    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setError('Please enter a reason of at least 10 characters');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await postDoctorAction<DoctorConsultPayload>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'doctor.reopen',
      body: {
        visit_id: target.id,
        row_version: target.row_version ?? 0,
        reason: trimmed,
      },
    });

    setSubmitting(false);

    if (!result.ok) {
      const msg = result.message.toLowerCase();
      if (msg.includes('stale') || msg.includes('updated elsewhere') || msg.includes('not takeable')) {
        onConflict(result.message);
        onClose();
        return;
      }
      setError(result.message || 'Reopen failed');
      return;
    }

    onReopened(result.data);
  };

  return (
    <>
      <div
        className="modal fade show d-block"
        id="nc-doctor-reopen-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-doctor-reopen-title"
        aria-modal="true"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-doctor-reopen-title">Reopen consult</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <p id="nc-reopen-patient" className="mb-2">
                {target.display_name} · MRN {target.pubpid}
              </p>
              <p className="text-muted small">
                Return this visit to your desk for new lab or Rx orders. Signed documentation stays locked.
              </p>
              <div className="form-group">
                <label htmlFor="nc-reopen-reason">Reason (required, min 10 characters)</label>
                <textarea
                  className="form-control"
                  id="nc-reopen-reason"
                  rows={3}
                  minLength={10}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {error && (
                <div className="alert alert-danger mt-2" id="nc-reopen-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-warning"
                id="nc-reopen-confirm"
                disabled={submitting || blocked}
                onClick={() => void handleConfirm()}
              >
                {submitting ? 'Reopening…' : 'Reopen consult'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" id="nc-doctor-modal-backdrop" />
    </>
  );
}
