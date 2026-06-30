import { useState } from 'react';
import type { PatientPreview } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from './ConfirmModal';

interface SkipToPaymentModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: { id: number } | null;
  deskLabel: 'lab' | 'pharmacy';
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

interface SkipToPaymentModalBodyProps {
  preview: PatientPreview;
  deskLabel: 'lab' | 'pharmacy';
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function SkipToPaymentModalBody({
  preview,
  deskLabel,
  submitting,
  error,
  onClose,
  onConfirm,
}: SkipToPaymentModalBodyProps) {
  const [reason, setReason] = useState('');
  const prefix = `nc-${deskLabel}-skip`;
  const identity = preview.identity;
  const title = deskLabel === 'lab' ? 'Skip lab queue' : 'Skip pharmacy queue';
  const bypassLabel = deskLabel === 'lab' ? 'lab' : 'pharmacy';

  return (
    <ConfirmModal
      open
      modalId={`${prefix}-modal`}
      titleId={`${prefix}-title`}
      onClose={onClose}
      title={title}
      confirmLabel={submitting ? 'Skipping…' : 'Skip to payment'}
      confirmVariant="warning"
      confirmDisabled={reason.trim() === ''}
      submitting={submitting}
      onConfirm={() => onConfirm(reason.trim())}
      identityBanner={(
        <IdentityConfirmBanner displayName={identity.display_name} pubpid={identity.pubpid} />
      )}
    >
      <p className="text-muted small">Sends visit to payment, bypassing {bypassLabel}.</p>
      <div className="form-group mb-0">
        <label htmlFor={`${prefix}-reason`}>Reason (required)</label>
        <textarea
          className="form-control"
          id={`${prefix}-reason`}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && (
        <div className="alert alert-danger mt-2 mb-0" id={`${prefix}-error`}>
          {error}
        </div>
      )}
    </ConfirmModal>
  );
}

export function SkipToPaymentModal({
  open,
  preview,
  visit,
  deskLabel,
  submitting,
  error,
  onClose,
  onConfirm,
}: SkipToPaymentModalProps) {
  if (!open || !preview || !visit) return null;

  return (
    <SkipToPaymentModalBody
      key={`${deskLabel}-${visit.id}`}
      preview={preview}
      deskLabel={deskLabel}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
