import { ConfirmModal } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';

/**
 * D-LAB-CRIT — capture the critical-value notification (who was told, how, and read-back) when a
 * result with a panic value is released (SLIPTA/ISO 15189 critical-value indicator). Release still
 * proceeds — the urgent result is valid — but the notification must be recorded and traceable.
 */
export interface CriticalNotification {
  notified_name: string;
  notified_role: string;
  method: string;
  read_back_confirmed: boolean;
  note: string;
}

interface CriticalNotificationModalProps {
  open: boolean;
  criticals: string[];
  value: CriticalNotification;
  submitting: boolean;
  onChange: (patch: Partial<CriticalNotification>) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const METHODS = [
  { id: 'phone', label: 'Phone call' },
  { id: 'in_person', label: 'In person' },
  { id: 'message', label: 'Secure message' },
  { id: 'other', label: 'Other' },
];

export function CriticalNotificationModal({
  open,
  criticals,
  value,
  submitting,
  onChange,
  onConfirm,
  onClose,
}: CriticalNotificationModalProps) {
  const canConfirm = value.notified_name.trim() !== '';

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Record critical-value notification"
      titleId="nc-labops-crit-title"
      confirmLabel="Record & release"
      confirmVariant="primary"
      confirmDisabled={!canConfirm}
      submitting={submitting}
      submittingLabel="Releasing…"
      onConfirm={onConfirm}
    >
      <div className="grid gap-2">
        <div className={deskCalloutClass('error', 'py-2 px-3 mb-1')} role="alert">
          <strong className="block mb-1">Critical result — notify the clinician now</strong>
          {criticals.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
        <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">
          Record who you told and confirm they read the value back. The result is released either way.
        </p>
        <Label htmlFor="nc-labops-crit-name">Clinician notified</Label>
        <Input
          id="nc-labops-crit-name"
          type="text"
          autoComplete="off"
          value={value.notified_name}
          onChange={(e) => onChange({ notified_name: e.target.value })}
          placeholder="Name of the doctor or nurse told"
        />
        <Label htmlFor="nc-labops-crit-role">Role (optional)</Label>
        <Input
          id="nc-labops-crit-role"
          type="text"
          autoComplete="off"
          value={value.notified_role}
          onChange={(e) => onChange({ notified_role: e.target.value })}
          placeholder="e.g. Attending doctor"
        />
        <Label htmlFor="nc-labops-crit-method">How</Label>
        <NativeSelect
          id="nc-labops-crit-method"
          value={value.method}
          onChange={(e) => onChange({ method: e.target.value })}
        >
          <option value="">Choose a method</option>
          {METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm mt-1">
          <input
            type="checkbox"
            checked={value.read_back_confirmed}
            onChange={(e) => onChange({ read_back_confirmed: e.target.checked })}
          />
          Clinician read the value back to confirm
        </label>
        <Label htmlFor="nc-labops-crit-note">Note (optional)</Label>
        <Input
          id="nc-labops-crit-note"
          type="text"
          autoComplete="off"
          value={value.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="e.g. paged on-call, awaiting callback"
        />
      </div>
    </ConfirmModal>
  );
}
