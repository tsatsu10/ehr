import { useEffect, useState } from 'react';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { DeskAlert } from '@components/DeskAlert';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

const SKIP_REASON_PRESETS = [
  { id: 'returning_followup', label: 'Returning follow-up' },
  { id: 'refused_triage', label: 'Patient refused triage' },
  { id: 'minimal_mode', label: 'Clinic minimal mode' },
  { id: 'other', label: 'Other' },
] as const;

interface SkipTriageModalProps {
  open: boolean;
  displayName: string;
  pubpid?: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function SkipTriageModal({
  open,
  displayName,
  pubpid,
  submitting,
  error,
  onClose,
  onConfirm,
}: SkipTriageModalProps) {
  const [preset, setPreset] = useState<string>(SKIP_REASON_PRESETS[0].id);
  const [otherReason, setOtherReason] = useState('');

  useEffect(() => {
    if (open) {
      setPreset(SKIP_REASON_PRESETS[0].id);
      setOtherReason('');
    }
  }, [open]);

  if (!open) return null;

  const reason = preset === 'other'
    ? otherReason.trim()
    : SKIP_REASON_PRESETS.find((item) => item.id === preset)?.label ?? '';

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Skip triage"
      modalId="nc-skip-triage-modal"
      titleId="nc-skip-triage-modal-title"
      cancelLabel="Cancel"
      confirmLabel="Skip"
      confirmVariant="warning"
      confirmDisabled={preset === 'other' && otherReason.trim() === ''}
      submitting={submitting}
      onConfirm={() => onConfirm(reason)}
      identityBanner={(
        <IdentityConfirmBanner displayName={displayName} pubpid={pubpid} />
      )}
    >
      <p className="mb-3">Sends visit straight to the doctor queue.</p>
      <fieldset className="mb-2 space-y-1 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">Reason (optional)</legend>
        {SKIP_REASON_PRESETS.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm mb-1">
            <input
              type="radio"
              name="nc-skip-triage-reason"
              className="h-4 w-4 accent-[var(--oe-nc-primary)]"
              checked={preset === item.id}
              onChange={() => setPreset(item.id)}
            />
            {item.label}
          </label>
        ))}
      </fieldset>
      {preset === 'other' && (
        <div className="space-y-2">
          <Label htmlFor="nc-skip-triage-other">Describe reason</Label>
          <Input
            id="nc-skip-triage-other"
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            placeholder="Describe reason"
          />
        </div>
      )}
      {error && (
        <DeskAlert tone="error" className="mt-2 text-sm" role="alert">
          {error}
        </DeskAlert>
      )}
    </ConfirmModal>
  );
}
