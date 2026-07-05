import { useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { PatientPreview } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from './ConfirmModal';

const MIN_REASON_LENGTH = 10;

interface UndispensedRxModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: { queue_number?: number | string } | null;
  undispensedCount?: number;
  canOverride?: boolean;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onOpenDispense: () => void;
  onOverrideComplete: (reason: string) => void;
}

export function UndispensedRxModal({
  open,
  preview,
  visit,
  undispensedCount = 1,
  canOverride = false,
  submitting = false,
  error = null,
  onClose,
  onOpenDispense,
  onOverrideComplete,
}: UndispensedRxModalProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!open || !preview || !visit) {
    return null;
  }

  const identity = preview.identity;
  const countLabel = undispensedCount === 1
    ? '1 prescription on this visit has not been dispensed.'
    : `${undispensedCount} prescriptions on this visit have not been dispensed.`;

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
      title="Undispensed prescriptions"
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
      <p className="mb-3">{countLabel}</p>
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
        Dispense all prescriptions before completing pharmacy, or use Skip to payment with a reason.
      </p>
      <div className="mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={onOpenDispense}
        >
          Open dispense
        </Button>
      </div>
      {canOverride ? (
        <div className="space-y-1.5 mb-0">
          <Label htmlFor="nc-pharmacy-undispensed-reason" className="normal-case">Override reason</Label>
          <Textarea
            id="nc-pharmacy-undispensed-reason"
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0 mt-1">
            Supervisor override — reason is recorded in the audit log.
          </p>
        </div>
      ) : null}
      {reasonError ? <div className={deskCalloutClass('error', 'mt-2 mb-0 py-2')}>{reasonError}</div> : null}
      {error ? <div className={deskCalloutClass('error', 'mt-2 mb-0 py-2')}>{error}</div> : null}
    </ConfirmModal>
  );
}
