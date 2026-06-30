import type { CashierVisit, PatientPreview } from '@core/types';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { formatMoney } from './cashierUtils';

interface PayConfirmModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  total: number;
  amountReceived: number;
  completionBlocked: boolean;
  canSkipCompletion: boolean;
  esignOverride?: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PayConfirmModal({
  open,
  preview,
  visit,
  total,
  amountReceived,
  completionBlocked,
  canSkipCompletion,
  esignOverride = false,
  submitting,
  onClose,
  onConfirm,
}: PayConfirmModalProps) {
  if (!open || !preview || !visit) return null;

  const identity = preview.identity;
  const change = Math.max(0, amountReceived - total);

  return (
    <ConfirmModal
      open
      modalId="nc-cashier-pay-confirm-modal"
      titleId="nc-cashier-pay-confirm-title"
      onClose={onClose}
      title="Confirm payment"
      confirmLabel={submitting ? 'Processing…' : 'Confirm payment'}
      confirmVariant="success"
      submitting={submitting}
      onConfirm={onConfirm}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      {completionBlocked && canSkipCompletion && (
        <div className="alert alert-warning py-2 mb-3">
          Profile completion override — payment will proceed despite incomplete profile (
          {preview.completion.score}% vs {preview.completion.billing_threshold}% required).
        </div>
      )}
      {esignOverride && (
        <div className="alert alert-warning py-2 mb-3">
          E-Sign supervisor override — unsigned documentation will be recorded in the audit log.
        </div>
      )}
      <dl className="row mb-0" id="nc-cashier-pay-confirm-body">
        <dt className="col-sm-5">Total due</dt>
        <dd className="col-sm-7"><strong>{formatMoney(total)}</strong></dd>
        <dt className="col-sm-5">Cash received</dt>
        <dd className="col-sm-7">{formatMoney(amountReceived)}</dd>
        <dt className="col-sm-5">Change</dt>
        <dd className="col-sm-7">{formatMoney(change)}</dd>
      </dl>
      <p className="small text-muted mb-0 mt-3">Confirm patient identity before posting payment.</p>
    </ConfirmModal>
  );
}
