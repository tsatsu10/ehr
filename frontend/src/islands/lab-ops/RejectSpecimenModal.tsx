import { ConfirmModal } from '@components/ConfirmModal';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import type { RejectionReasonOption } from './labOpsTypes';

/**
 * D-LAB-REJECT — reject a collected specimen with a standard reason (SLIPTA sample-rejection
 * indicator). The order returns to "not collected" so a fresh specimen is taken.
 */
interface RejectSpecimenModalProps {
  open: boolean;
  reasons: RejectionReasonOption[];
  reason: string;
  note: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function RejectSpecimenModal({
  open,
  reasons,
  reason,
  note,
  submitting,
  onReasonChange,
  onNoteChange,
  onConfirm,
  onClose,
}: RejectSpecimenModalProps) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Reject specimen"
      titleId="nc-labops-reject-title"
      confirmLabel="Reject specimen"
      confirmVariant="danger"
      submitting={submitting}
      onConfirm={onConfirm}
    >
      <div className="grid gap-2">
        <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">
          The specimen returns to &ldquo;not collected&rdquo; so a fresh sample can be taken.
        </p>
        <Label htmlFor="nc-labops-reject-reason">Reason</Label>
        <NativeSelect
          id="nc-labops-reject-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        >
          <option value="">Choose a reason</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </NativeSelect>
        <Label htmlFor="nc-labops-reject-note">Note (optional)</Label>
        <Input
          id="nc-labops-reject-note"
          type="text"
          autoComplete="off"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="e.g. clot in EDTA tube"
        />
      </div>
    </ConfirmModal>
  );
}
