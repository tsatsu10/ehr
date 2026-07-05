import { useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
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
      <div className="space-y-1.5 mb-0">
        <Label htmlFor="nc-rx-allergy-override-reason" className="normal-case">Override reason (required)</Label>
        <Textarea
          id="nc-rx-allergy-override-reason"
          rows={2}
          value={reason}
          disabled={submitting}
          onChange={(event) => setReason(event.target.value)}
        />
        {reasonError && <div className="text-[var(--oe-nc-danger,#dc2626)] text-sm mt-1">{reasonError}</div>}
      </div>
      {error && <div className={deskCalloutClass('error', 'mt-3 mb-0 py-2 text-sm')}>{error}</div>}
    </ConfirmModal>
  );
}
