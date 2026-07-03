import { useEffect, useState } from 'react';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import type { PendingVisitAction } from './reportsTypes';

interface ReasonModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  confirmVariant: 'warning' | 'danger';
  patientLabel: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function ReasonModal({
  open,
  title,
  confirmLabel,
  confirmVariant,
  patientLabel,
  submitting,
  error,
  onClose,
  onConfirm,
}: ReasonModalProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  const [displayName, ...rest] = patientLabel.split(' · MRN ');
  const pubpid = rest[0]?.trim();

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title={title}
      cancelLabel="Close"
      confirmLabel={confirmLabel}
      confirmVariant={confirmVariant}
      confirmDisabled={reason.trim() === ''}
      submitting={submitting}
      onConfirm={() => onConfirm(reason.trim())}
      identityBanner={(
        <IdentityConfirmBanner displayName={displayName} pubpid={pubpid} />
      )}
    >
      <div className="form-group mb-0">
        <label htmlFor="nc-reports-action-reason">Reason (required)</label>
        <textarea
          id="nc-reports-action-reason"
          className="form-control"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && <div className="alert alert-danger mt-2 mb-0">{error}</div>}
    </ConfirmModal>
  );
}

interface ReportsActionModalsProps {
  cancelTarget: PendingVisitAction | null;
  markUnpaidTarget: PendingVisitAction | null;
  submitting: boolean;
  cancelError: string | null;
  markUnpaidError: string | null;
  onCloseCancel: () => void;
  onCloseMarkUnpaid: () => void;
  onConfirmCancel: (reason: string) => void;
  onConfirmMarkUnpaid: (reason: string) => void;
}

function patientLabel(action: PendingVisitAction): string {
  return `${action.displayName} · MRN ${action.pubpid}`;
}

export function ReportsActionModals({
  cancelTarget,
  markUnpaidTarget,
  submitting,
  cancelError,
  markUnpaidError,
  onCloseCancel,
  onCloseMarkUnpaid,
  onConfirmCancel,
  onConfirmMarkUnpaid,
}: ReportsActionModalsProps) {
  return (
    <>
      <ReasonModal
        open={cancelTarget !== null}
        title="Cancel visit"
        confirmLabel="Cancel visit"
        confirmVariant="danger"
        patientLabel={cancelTarget ? patientLabel(cancelTarget) : ''}
        submitting={submitting}
        error={cancelError}
        onClose={onCloseCancel}
        onConfirm={onConfirmCancel}
      />
      <ReasonModal
        open={markUnpaidTarget !== null}
        title="Mark visit unpaid"
        confirmLabel="Mark unpaid"
        confirmVariant="warning"
        patientLabel={markUnpaidTarget ? patientLabel(markUnpaidTarget) : ''}
        submitting={submitting}
        error={markUnpaidError}
        onClose={onCloseMarkUnpaid}
        onConfirm={onConfirmMarkUnpaid}
      />
    </>
  );
}
