import { useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
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
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
        Enter prescriber name, registration/ID, and Rx date on the pharmacy service note, or use a
        supervisor override when the paper Rx cannot be verified.
      </p>
      <div className="mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={onOpenPharmacyService}
        >
          Open pharmacy service note
        </Button>
      </div>
      {canOverride && (
        <div className="space-y-1.5 mb-0">
          <Label htmlFor="nc-pharm-external-rx-override-reason" className="normal-case">Override reason (required)</Label>
          <Textarea
            id="nc-pharm-external-rx-override-reason"
            rows={2}
            value={reason}
            disabled={submitting}
            onChange={(event) => setReason(event.target.value)}
          />
          {reasonError && <div className="text-[var(--oe-nc-danger,#dc2626)] text-sm mt-1">{reasonError}</div>}
        </div>
      )}
      {error && <div className={deskCalloutClass('error', 'mt-3 mb-0 py-2 text-sm')}>{error}</div>}
    </ConfirmModal>
  );
}
