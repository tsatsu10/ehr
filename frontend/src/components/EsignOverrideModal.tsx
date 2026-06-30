import { useState } from 'react';
import type { PatientPreview } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from './ConfirmModal';

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
    <ConfirmModal
      open
      onClose={onClose}
      title={title}
      confirmLabel={confirmLabel}
      confirmVariant="warning"
      onConfirm={handleConfirm}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
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
    </ConfirmModal>
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
