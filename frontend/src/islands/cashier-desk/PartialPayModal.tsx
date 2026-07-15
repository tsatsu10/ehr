import { useEffect, useState } from 'react';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { SegmentedControl } from '@components/SegmentedControl';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import type { CashierPaymentMethod, CashierVisit, PatientPreview } from '@core/types';
import { formatMoney, parseCashInput } from './cashierUtils';

interface PartialPayModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  total: number;
  momoEnabled: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (amount: number, reason: string, method: CashierPaymentMethod, momoReference: string) => void;
}

/** CBILL-2 — take a partial payment: amount < total, reason required, remainder becomes owed. */
export function PartialPayModal({
  open,
  preview,
  visit,
  total,
  momoEnabled,
  submitting,
  error,
  onClose,
  onConfirm,
}: PartialPayModalProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<CashierPaymentMethod>('cash');
  const [momoReference, setMomoReference] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setMethod('cash');
      setMomoReference('');
    }
  }, [open]);

  if (!preview || !visit) return null;

  const identity = preview.identity;
  const paid = parseCashInput(amount);
  const balance = Math.max(0, total - paid);
  const trimmedReason = reason.trim();
  const isMomo = momoEnabled && method === 'momo';
  const amountValid = paid > 0 && paid + 0.001 < total;
  const confirmDisabled =
    !amountValid || trimmedReason === '' || (isMomo && momoReference.trim() === '');

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Partial payment"
      confirmLabel="Take partial payment"
      confirmVariant="warning"
      confirmDisabled={confirmDisabled}
      submitting={submitting}
      submittingLabel="Recording…"
      onConfirm={() => onConfirm(paid, trimmedReason, isMomo ? 'momo' : 'cash', momoReference.trim())}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      <p className="mb-3">
        Accept less than the full total. The visit completes and the remaining
        {' '}<strong>{formatMoney(balance)}</strong> is recorded as owed.
      </p>

      {momoEnabled && (
        <div className="nc-cashier-payment-method mb-3">
          <span className="nc-cashier-payment-method__label">Payment method</span>
          <SegmentedControl
            ariaLabel="Payment method"
            value={method}
            onChange={(id) => setMethod(id as CashierPaymentMethod)}
            segments={[
              { id: 'cash', label: 'Cash' },
              { id: 'momo', label: 'MoMo' },
            ]}
          />
        </div>
      )}

      <div className="grid gap-3 mb-0">
        <div className="grid gap-2">
          <Label htmlFor="nc-cashier-partial-total" className="normal-case font-normal">Total due</Label>
          <Input id="nc-cashier-partial-total" type="text" readOnly value={formatMoney(total)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nc-cashier-partial-amount" className="normal-case font-normal">Amount received</Label>
          <Input
            id="nc-cashier-partial-amount"
            type="number"
            step={0.01}
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nc-cashier-partial-balance" className="normal-case font-normal">Balance owed</Label>
          <Input id="nc-cashier-partial-balance" type="text" readOnly value={formatMoney(balance)} />
        </div>
        {isMomo && (
          <div className="grid gap-2">
            <Label htmlFor="nc-cashier-partial-momo" className="normal-case font-normal">MoMo transaction reference</Label>
            <Input
              id="nc-cashier-partial-momo"
              type="text"
              maxLength={255}
              value={momoReference}
              onChange={(e) => setMomoReference(e.target.value)}
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="nc-cashier-partial-reason" className="normal-case font-normal">Reason (required)</Label>
          <Textarea
            id="nc-cashier-partial-reason"
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} role="alert">
          {error}
        </div>
      )}
    </ConfirmModal>
  );
}
