import { useEffect, useState } from 'react';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';

interface CancelVisitModalProps {
  open: boolean;
  displayName: string;
  pubpid?: string;
  queueNumber?: number | string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  suggestWrongVisitType?: boolean;
}

export function CancelVisitModal({
  open,
  displayName,
  pubpid,
  queueNumber,
  submitting,
  error,
  onClose,
  onConfirm,
  suggestWrongVisitType = false,
}: CancelVisitModalProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setReason(suggestWrongVisitType ? 'wrong_visit_type' : '');
    }
  }, [open, suggestWrongVisitType]);

  if (!open) return null;

  return (
    <ConfirmModal
      open
      onClose={onClose}
      title="Cancel visit"
      modalId="nc-cancel-visit-modal"
      cancelLabel="Close"
      confirmLabel="Cancel visit"
      confirmVariant="danger"
      confirmDisabled={reason.trim() === ''}
      submitting={submitting}
      onConfirm={() => onConfirm(reason.trim())}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={displayName}
          pubpid={pubpid}
          queueNumber={queueNumber}
        />
      )}
    >
      <div className="form-group mb-0">
        <label htmlFor="nc-cancel-visit-reason">Reason (required)</label>
        {suggestWrongVisitType && (
          <p className="small text-muted mb-2">
            This visit is still waiting in queue. Use reason &quot;wrong_visit_type&quot; when reception
            started the wrong visit type; then start a new visit with the correct type.
          </p>
        )}
        <textarea
          id="nc-cancel-visit-reason"
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
