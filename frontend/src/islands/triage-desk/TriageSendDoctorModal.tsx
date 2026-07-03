import { useState } from 'react';
import { ConfirmModal } from '@components/ConfirmModal';
import type { AssignableDoctor } from '@core/types';
import { HardAssignDoctorSelect } from '@components/HardAssignDoctorSelect';

interface TriageSendDoctorModalProps {
  open: boolean;
  doctors: AssignableDoctor[];
  submitting: boolean;
  onClose: () => void;
  onConfirm: (hardAssignedProviderId: number | null) => void;
}

export function TriageSendDoctorModal({
  open,
  doctors,
  submitting,
  onClose,
  onConfirm,
}: TriageSendDoctorModalProps) {
  const [doctorId, setDoctorId] = useState('');

  if (!open) return null;

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Send to doctor"
      confirmLabel="Send to doctor pool"
      submitting={submitting}
      submittingLabel="Sending…"
      onConfirm={() => {
        const parsed = doctorId ? Number.parseInt(doctorId, 10) : 0;
        onConfirm(parsed > 0 ? parsed : null);
      }}
    >
      <p className="mb-2 text-muted small">
        Optionally assign a specific doctor before the visit enters the consult queue.
      </p>
      <div className="form-group mb-0">
        <label htmlFor="nc-triage-hard-assign-doctor">Assign doctor (optional)</label>
        <HardAssignDoctorSelect
          id="nc-triage-hard-assign-doctor"
          doctors={doctors}
          value={doctorId}
          onChange={setDoctorId}
        />
      </div>
    </ConfirmModal>
  );
}
