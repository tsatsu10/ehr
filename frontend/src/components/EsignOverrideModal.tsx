import { useState } from 'react';
import type { PatientPreview } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from './ConfirmModal';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface EsignOverrideModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: { queue_number?: number | string } | null;
  title?: string;
  confirmLabel?: string;
  reasonFieldId?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

interface EsignOverrideModalBodyProps {
  open: boolean;
  preview: PatientPreview;
  visit: { queue_number?: number | string };
  title: string;
  confirmLabel: string;
  reasonFieldId: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function EsignOverrideModalBody({
  open,
  preview,
  visit,
  title,
  confirmLabel,
  reasonFieldId,
  onClose,
  onConfirm,
}: EsignOverrideModalBodyProps) {
  const [reason, setReason] = useState('');
  const identity = preview.identity;
  const trimmedReason = reason.trim();

  function handleClose() {
    setReason('');
    onClose();
  }

  return (
    <ConfirmModal
      open={open}
      onClose={handleClose}
      title={title}
      titleId="nc-esign-override-title"
      confirmLabel={confirmLabel}
      confirmVariant="warning"
      confirmDisabled={trimmedReason === ''}
      onConfirm={() => { onConfirm(trimmedReason); setReason(''); }}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
        Supervisor override — reason is recorded in the audit log.
      </p>
      <div className="grid gap-2">
        <Label htmlFor={reasonFieldId}>Reason</Label>
        <Textarea
          id={reasonFieldId}
          rows={3}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </ConfirmModal>
  );
}

export function EsignOverrideModal({
  open,
  preview,
  visit,
  title = 'E-Sign override',
  confirmLabel = 'Confirm with override',
  reasonFieldId = 'nc-esign-override-reason',
  onClose,
  onConfirm,
}: EsignOverrideModalProps) {
  if (!preview || !visit) return null;

  return (
    <EsignOverrideModalBody
      key={`${visit.queue_number ?? 'visit'}-${preview.identity.pid}`}
      open={open}
      preview={preview}
      visit={visit}
      title={title}
      confirmLabel={confirmLabel}
      reasonFieldId={reasonFieldId}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
