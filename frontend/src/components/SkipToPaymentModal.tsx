import { useState } from 'react';
import type { PatientPreview } from '@core/types';
import { useModalDismiss } from './useModalDismiss';

interface SkipToPaymentModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: { id: number } | null;
  deskLabel: 'lab' | 'pharmacy';
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

interface SkipToPaymentModalBodyProps {
  preview: PatientPreview;
  deskLabel: 'lab' | 'pharmacy';
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function SkipToPaymentModalBody({
  preview,
  deskLabel,
  submitting,
  error,
  onClose,
  onConfirm,
}: SkipToPaymentModalBodyProps) {
  const [reason, setReason] = useState('');
  const prefix = `nc-${deskLabel}-skip`;
  const identity = preview.identity;
  const title = deskLabel === 'lab' ? 'Skip lab queue' : 'Skip pharmacy queue';
  const bypassLabel = deskLabel === 'lab' ? 'lab' : 'pharmacy';

  return (
    <>
      <div
        className="modal fade show d-block"
        id={`${prefix}-modal`}
        tabIndex={-1}
        role="dialog"
        aria-labelledby={`${prefix}-title`}
        aria-modal="true"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={`${prefix}-title`}>{title}</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <p id={`${prefix}-patient`} className="mb-2">
                {identity.display_name} · MRN {identity.pubpid}
              </p>
              <p className="text-muted small">Sends visit to payment, bypassing {bypassLabel}.</p>
              <div className="form-group mb-0">
                <label htmlFor={`${prefix}-reason`}>Reason (required)</label>
                <textarea
                  className="form-control"
                  id={`${prefix}-reason`}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {error && (
                <div className="alert alert-danger mt-2 mb-0" id={`${prefix}-error`}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-warning"
                id={`${prefix}-confirm`}
                disabled={submitting || reason.trim() === ''}
                onClick={() => onConfirm(reason.trim())}
              >
                {submitting ? 'Skipping…' : 'Skip to payment'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        id={`nc-${deskLabel}-modal-backdrop`}
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}

export function SkipToPaymentModal({
  open,
  preview,
  visit,
  deskLabel,
  submitting,
  error,
  onClose,
  onConfirm,
}: SkipToPaymentModalProps) {
  useModalDismiss(open, onClose);

  if (!open || !preview || !visit) return null;

  return (
    <SkipToPaymentModalBody
      key={`${deskLabel}-${visit.id}`}
      preview={preview}
      deskLabel={deskLabel}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
