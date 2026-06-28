import { useState } from 'react';
import type { PatientPreview } from '@core/types';
import { useModalDismiss } from './useModalDismiss';

interface EsignOverrideModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: { queue_number?: number | string } | null;
  title?: string;
  confirmLabel?: string;
  reasonFieldId?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

interface EsignOverrideModalBodyProps {
  preview: PatientPreview;
  visit: { queue_number?: number | string };
  title: string;
  confirmLabel: string;
  reasonFieldId: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function EsignOverrideModalBody({
  preview,
  visit,
  title,
  confirmLabel,
  reasonFieldId,
  onClose,
  onConfirm,
}: EsignOverrideModalBodyProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const identity = preview.identity;

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed === '') {
      setError('Reason is required');
      return;
    }
    onConfirm(trimmed);
  };

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
              <div className="nc-patient-context-banner p-3 border rounded bg-light mb-3">
                <strong>{identity.display_name}</strong> · MRN {identity.pubpid}
                {visit.queue_number !== undefined && (
                  <> · Queue #{visit.queue_number}</>
                )}
              </div>
              <p className="small text-muted">Supervisor override — reason is recorded in the audit log.</p>
              <div className="form-group mb-0">
                <label htmlFor={reasonFieldId}>Reason</label>
                <textarea
                  className="form-control"
                  id={reasonFieldId}
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
              <button type="button" className="btn btn-warning" onClick={handleConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}

export function EsignOverrideModal({
  open,
  preview,
  visit,
  title = 'E-Sign override',
  confirmLabel = 'Confirm with override',
  reasonFieldId = 'nc-esign-override-reason',
  onClose,
  onConfirm,
}: EsignOverrideModalProps) {
  useModalDismiss(open, onClose);

  if (!open || !preview || !visit) return null;

  return (
    <EsignOverrideModalBody
      key={`${visit.queue_number ?? 'visit'}-${preview.identity.pid}`}
      preview={preview}
      visit={visit}
      title={title}
      confirmLabel={confirmLabel}
      reasonFieldId={reasonFieldId}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
