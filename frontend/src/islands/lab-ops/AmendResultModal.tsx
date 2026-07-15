import { ConfirmModal } from '@components/ConfirmModal';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

/**
 * D-LAB-AMEND — correcting a released result (ISO 15189 corrected report). A reason is required;
 * the original values are kept and the report is marked corrected when re-released.
 */
interface AmendResultModalProps {
  open: boolean;
  reason: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AmendResultModal({
  open,
  reason,
  submitting,
  onReasonChange,
  onConfirm,
  onClose,
}: AmendResultModalProps) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Amend released result"
      titleId="nc-labops-amend-title"
      confirmLabel="Start amendment"
      confirmVariant="warning"
      confirmDisabled={reason.trim() === ''}
      submitting={submitting}
      onConfirm={onConfirm}
    >
      <div className="grid gap-2">
        <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">
          The original result is kept. Give a reason, then edit and release the corrected result.
        </p>
        <Label htmlFor="nc-labops-amend-reason">Reason for correction</Label>
        <Input
          id="nc-labops-amend-reason"
          type="text"
          autoComplete="off"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="e.g. transcription error — wrong tube read"
        />
      </div>
    </ConfirmModal>
  );
}
