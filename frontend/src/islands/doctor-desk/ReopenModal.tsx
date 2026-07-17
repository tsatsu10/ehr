/**
 * ReopenModal — reopen a completed consult for new lab/Rx orders.
 */

import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { useEffect, useState } from 'react';
import { t } from '@core/i18n';
import type { DoctorReopenableRow, DoctorConsultPayload } from '@core/types';
import { postDoctorAction } from './postDoctorAction';

interface ReopenModalProps {
  open: boolean;
  target: DoctorReopenableRow | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onReopened: (payload: DoctorConsultPayload) => void;
  onConflict: (message: string) => void;
}

export function ReopenModal({
  open,
  target,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onReopened,
  onConflict,
}: ReopenModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
  }, [open, target?.id]);

  if (!target) return null;

  const trimmedReason = reason.trim();

  const handleConfirm = async () => {
    if (blocked || submitting) return;

    if (trimmedReason.length < 10) {
      setError(t('Please enter a reason of at least 10 characters'));
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await postDoctorAction<DoctorConsultPayload>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'doctor.reopen',
      body: {
        visit_id: target.id,
        row_version: target.row_version ?? 0,
        reason: trimmedReason,
      },
    });

    setSubmitting(false);

    if (!result.ok) {
      const msg = result.message.toLowerCase();
      if (msg.includes('stale') || msg.includes('updated elsewhere') || msg.includes('not takeable')) {
        onConflict(result.message);
        onClose();
        return;
      }
      setError(result.message || t('Reopen failed'));
      return;
    }

    onReopened(result.data);
  };

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title={t('Reopen consult')}
      titleId="nc-doctor-reopen-title"
      modalId="nc-doctor-reopen-modal"
      confirmLabel={t('Reopen consult')}
      confirmVariant="warning"
      confirmDisabled={blocked || trimmedReason.length < 10}
      submitting={submitting}
      submittingLabel={t('Reopening…')}
      onConfirm={() => void handleConfirm()}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={target.display_name}
          pubpid={target.pubpid}
          queueNumber={target.queue_number}
        />
      )}
    >
      <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3">
        {t('Return this visit to your desk for new lab or Rx orders. Signed documentation stays locked.')}
      </p>
      <div className="grid gap-2">
        <Label htmlFor="nc-reopen-reason">{t('Reason (required, min 10 characters)')}</Label>
        <Textarea
          id="nc-reopen-reason"
          rows={3}
          minLength={10}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && (
        <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} id="nc-reopen-error" role="alert">
          {error}
        </div>
      )}
    </ConfirmModal>
  );
}
