import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import type { CashierPaymentMethod, CashierVisit, PatientPreview } from '@core/types';
import { formatMoney } from './cashierUtils';

interface PayConfirmModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  total: number;
  amountReceived: number;
  paymentMethod?: CashierPaymentMethod;
  momoReference?: string;
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
  paymentMethod = 'cash',
  momoReference = '',
  completionBlocked,
  canSkipCompletion,
  esignOverride = false,
  submitting,
  onClose,
  onConfirm,
}: PayConfirmModalProps) {
  if (!preview || !visit) return null;

  const identity = preview.identity;
  const change = paymentMethod === 'momo' ? 0 : Math.max(0, amountReceived - total);

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Confirm payment"
      titleId="nc-cashier-pay-confirm-title"
      modalId="nc-cashier-pay-confirm-modal"
      confirmLabel="Confirm payment"
      confirmVariant="success"
      submitting={submitting}
      submittingLabel="Processing…"
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
        <div className={deskCalloutClass('warn', 'text-sm mb-3')}>
          Profile completion override — payment will proceed despite incomplete profile (
          {preview.completion.score}% vs {preview.completion.billing_threshold}% required).
        </div>
      )}
      {esignOverride && (
        <div className={deskCalloutClass('warn', 'text-sm mb-3')}>
          E-Sign supervisor override — unsigned documentation will be recorded in the audit log.
        </div>
      )}
      <dl className="grid grid-cols-12 gap-3 mb-0">
        <dt className="col-span-12 sm:col-span-5">Payment method</dt>
        <dd className="col-span-12 sm:col-span-7">{paymentMethod === 'momo' ? 'MoMo' : 'Cash'}</dd>
        <dt className="col-span-12 sm:col-span-5">Total due</dt>
        <dd className="col-span-12 sm:col-span-7"><strong>{formatMoney(total)}</strong></dd>
        {paymentMethod === 'momo' ? (
          <>
            <dt className="col-span-12 sm:col-span-5">MoMo reference</dt>
            <dd className="col-span-12 sm:col-span-7">{momoReference}</dd>
          </>
        ) : (
          <>
            <dt className="col-span-12 sm:col-span-5">Cash received</dt>
            <dd className="col-span-12 sm:col-span-7">{formatMoney(amountReceived)}</dd>
            <dt className="col-span-12 sm:col-span-5">Change</dt>
            <dd className="col-span-12 sm:col-span-7">{formatMoney(change)}</dd>
          </>
        )}
      </dl>
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0 mt-3">Confirm patient identity before posting payment.</p>
    </ConfirmModal>
  );
}
