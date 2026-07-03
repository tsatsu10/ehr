import { useState } from 'react';
import type { PatientPreview } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from './ConfirmModal';

const MIN_REASON_LENGTH = 10;

interface ExternalRxIncompleteModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: { queue_number?: number | string } | null;
  missing?: string[];
  canOverride?: boolean;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onOpenPharmacyService: () => void;
  onOverrideComplete: (reason: string) => void;
}

export function ExternalRxIncompleteModal({
  open,
  preview,
  visit,
  missing = [],
  canOverride = false,
  submitting = false,
  error = null,
  onClose,
  onOpenPharmacyService,
  onOverrideComplete,
}: ExternalRxIncompleteModalProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!open || !preview || !visit) {
    return null;
  }

  const identity = preview.identity;
  const missingLabel = missing.length > 0
    ? `Missing or invalid: ${missing.join(', ')}`
    : 'External Rx metadata is incomplete on the pharmacy service note.';

  const handleOverride = () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setReasonError(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
      return;
    }
    setReasonError(null);
    onOverrideComplete(trimmed);
  };

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="External Rx metadata incomplete"
      confirmLabel={canOverride ? 'Override & complete' : 'Close'}
      confirmVariant={canOverride ? 'warning' : 'secondary'}
      submitting={submitting}
      submittingLabel="Completing…"
      onConfirm={canOverride ? handleOverride : onClose}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      <p className="mb-3">{missingLabel}</p>
      <p className="small text-muted mb-3">
        Enter prescriber name, registration/ID, and Rx date on the pharmacy service note, or use a
        supervisor override when the paper Rx cannot be verified.
      </p>
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={submitting}
          onClick={onOpenPharmacyService}
        >
          Open pharmacy service note
        </button>
      </div>
      {canOverride && (
        <div className="form-group mb-0">
          <label htmlFor="nc-pharm-external-rx-override-reason">Override reason (required)</label>
          <textarea
            className="form-control"
            id="nc-pharm-external-rx-override-reason"
            rows={2}
            value={reason}
            disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
          />
          {reasonError && <div className="text-danger small mt-1">{reasonError}</div>}
        </div>
      )}
      {error && <div className="alert alert-danger mt-3 mb-0 py-2 small">{error}</div>}
    </ConfirmModal>
  );
}
