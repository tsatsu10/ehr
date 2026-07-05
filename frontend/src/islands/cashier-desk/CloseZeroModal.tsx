import { ConfirmModal } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { useEffect, useState } from 'react';

interface CloseZeroModalProps {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CloseZeroModal({
  open,
  submitting,
  error,
  onClose,
  onConfirm,
}: CloseZeroModalProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmedReason = reason.trim();

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Close without charge"
      confirmLabel="Confirm"
      confirmVariant="success"
      confirmDisabled={trimmedReason === ''}
      submitting={submitting}
      submittingLabel="Closing…"
      onConfirm={() => onConfirm(trimmedReason)}
    >
      <p className="mb-2">Close this visit with no charges. Reason is required.</p>
      <div className="grid gap-2 mb-0">
        <Label htmlFor="nc-cashier-close-zero-reason">Reason</Label>
        <Textarea
          id="nc-cashier-close-zero-reason"
          rows={3}
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
