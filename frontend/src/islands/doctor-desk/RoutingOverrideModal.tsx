import { useState } from 'react';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { ConfirmModal } from '@components/ConfirmModal';
import type { DoctorQueueCard } from '@core/types';

interface RoutingOverrideModalProps {
  card: DoctorQueueCard | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RoutingOverrideModal({
  card,
  submitting,
  onClose,
  onConfirm,
}: RoutingOverrideModalProps) {
  const [reason, setReason] = useState('');

  if (!card) return null;

  const suggested = card.routing_suggested_provider_name ?? 'another doctor';

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Take patient suggested for another doctor?"
      confirmLabel="Take anyway"
      confirmVariant="warning"
      confirmDisabled={reason.trim().length < 3}
      submitting={submitting}
      submittingLabel="Taking…"
      onConfirm={() => onConfirm(reason.trim())}
    >
      <p className="mb-2">
        Routing suggests <strong>{suggested}</strong> for this visit. You can still take the patient — advisory routing never blocks Take patient.
      </p>
      <div className="space-y-1.5 mb-0">
        <Label htmlFor="nc-routing-override-reason" className="normal-case">Reason (required)</Label>
        <Textarea
          id="nc-routing-override-reason"
          rows={3}
          maxLength={200}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </ConfirmModal>
  );
}
