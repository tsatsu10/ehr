import { useState } from 'react';
import type { PatientPreview } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from './ConfirmModal';

const MIN_REASON_LENGTH = 10;

interface RxAllergyOverrideModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: { queue_number?: number | string } | null;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RxAllergyOverrideModal({
  open,
  preview,
  visit,
  submitting = false,
  error = null,
  onClose,
  onConfirm,
}: RxAllergyOverrideModalProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!open || !preview || !visit) {
    return null;
  }

  const identity = preview.identity;

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setReasonError(`Reason must be at least ${MIN_REASON_LENGTH} characters`);
      return;
    }
    setReasonError(null);
    onConfirm(trimmed);
  };

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Prescribe without allergy documentation"
      confirmLabel="Override & prescribe"
      confirmVariant="warning"
      submitting={submitting}
      submittingLabel="Opening Rx…"
      onConfirm={handleConfirm}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      <p className="mb-3">
        Allergies are not documented for this patient. Document allergies in the chart first,
        or use an emergency supervisor override with a recorded reason.
      </p>
      <div className="form-group mb-0">
        <label htmlFor="nc-rx-allergy-override-reason">Override reason (required)</label>
        <textarea
          className="form-control"
          id="nc-rx-allergy-override-reason"
          rows={2}
          value={reason}
          disabled={submitting}
          onChange={(event) => setReason(event.target.value)}
        />
        {reasonError && <div className="text-danger small mt-1">{reasonError}</div>}
      </div>
      {error && <div className="alert alert-danger mt-3 mb-0 py-2 small">{error}</div>}
    </ConfirmModal>
  );
}
