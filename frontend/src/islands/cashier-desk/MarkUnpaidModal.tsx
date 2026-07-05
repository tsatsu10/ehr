import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { useEffect, useState } from 'react';
import type { CashierVisit, PatientPreview } from '@core/types';

interface MarkUnpaidModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function MarkUnpaidModal({
  open,
  preview,
  visit,
  submitting,
  error,
  onClose,
  onConfirm,
}: MarkUnpaidModalProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!preview || !visit) return null;

  const identity = preview.identity;
  const trimmedReason = reason.trim();

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Mark left unpaid"
      confirmLabel="Mark left unpaid"
      confirmVariant="warning"
      confirmDisabled={trimmedReason === ''}
      submitting={submitting}
      submittingLabel="Saving…"
      onConfirm={() => onConfirm(trimmedReason)}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      <p className="mb-2">Record that this patient left without paying. Reason is required.</p>
      <div className="grid gap-2 mb-0">
        <Label htmlFor="nc-cashier-terminal-reason">Reason</Label>
        <Textarea
          id="nc-cashier-terminal-reason"
          rows={3}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && (
        <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} role="alert">
          {error}
        </div>
      )}
    </ConfirmModal>
  );
}
