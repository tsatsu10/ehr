import { useState } from 'react';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { ConfirmModal } from '@components/ConfirmModal';
import type { DoctorQueueCard } from '@core/types';

interface HardAssignOverrideModalProps {
  card: DoctorQueueCard | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function HardAssignOverrideModal({
  card,
  submitting,
  onClose,
  onConfirm,
}: HardAssignOverrideModalProps) {
  const [reason, setReason] = useState('');

  if (!card) return null;

  const assigned = card.hard_assigned_provider_name ?? 'another doctor';

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Take patient assigned to another doctor?"
      confirmLabel="Take with override"
      confirmVariant="warning"
      confirmDisabled={reason.trim().length < 3}
      submitting={submitting}
      submittingLabel="Taking…"
      onConfirm={() => onConfirm(reason.trim())}
    >
      <p className="mb-2">
        This visit is hard-assigned to <strong>{assigned}</strong>. Taking it requires an override reason.
      </p>
      <div className="space-y-1.5 mb-0">
        <Label htmlFor="nc-hard-assign-override-reason" className="normal-case">Reason (required)</Label>
        <Textarea
          id="nc-hard-assign-override-reason"
          rows={3}
          maxLength={200}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </ConfirmModal>
  );
}
