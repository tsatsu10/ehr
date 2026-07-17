import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { PatientSearchPanel } from './PatientSearchPanel';

interface OtherPaymentContext {
  pid: number;
  patient_label: string;
  payable_visits: {
    visit_id: number;
    visit_date: string;
    queue_number: number;
    state: string;
    owed: number;
  }[];
  momo_enabled: boolean;
  currency_symbol: string;
}

interface OtherPaymentResult {
  receipt_number: string;
  type: string;
  amount: number;
  method: string;
}

interface OtherPaymentModalProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
}

function ddmmyyyy(iso: string): string {
  const [y, m, d] = (iso || '').split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/**
 * CP-2 — "Record other payment": a deposit (no visit) or money still owed on a
 * past visit. Replaces the stock front-payment escape for these two shapes.
 */
export function OtherPaymentModal({ open, onClose, ajaxUrl, csrfToken }: OtherPaymentModalProps) {
  const [context, setContext] = useState<OtherPaymentContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [type, setType] = useState<'deposit' | 'visit'>('deposit');
  const [visitId, setVisitId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OtherPaymentResult | null>(null);

  const reset = useCallback(() => {
    setContext(null);
    setType('deposit');
    setVisitId('');
    setAmount('');
    setMethod('cash');
    setReference('');
    setNote('');
    setError(null);
    setResult(null);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const loadContext = useCallback(
    async (pid: number) => {
      setLoadingContext(true);
      setError(null);
      try {
        const data = await oeFetch<OtherPaymentContext>('cashier.other_payment.context', {
          ajaxUrl,
          csrfToken,
          params: { pid },
        });
        setContext(data);
        // Default to settling a visit when one is owing, else deposit.
        if ((data.payable_visits ?? []).length > 0) {
          setType('visit');
          setVisitId(String(data.payable_visits[0].visit_id));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load patient details.');
      } finally {
        setLoadingContext(false);
      }
    },
    [ajaxUrl, csrfToken],
  );

  const selectedVisit = context?.payable_visits.find((v) => String(v.visit_id) === visitId) ?? null;
  const amountNumber = Number(amount);
  const amountInvalid = !Number.isFinite(amountNumber) || amountNumber <= 0;
  const overOwed = type === 'visit' && selectedVisit !== null && amountNumber > selectedVisit.owed + 0.001;
  const momoMissingRef = method === 'momo' && reference.trim() === '';
  const postDisabled =
    posting || amountInvalid || overOwed || momoMissingRef || (type === 'visit' && !selectedVisit);

  const post = useCallback(async () => {
    if (!context || postDisabled) return;
    setPosting(true);
    setError(null);
    try {
      const posted = await oeFetch<OtherPaymentResult>('cashier.other_payment.post', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          pid: context.pid,
          type,
          visit_id: type === 'visit' ? Number(visitId) : undefined,
          amount: amountNumber,
          method,
          reference,
          note,
        },
      });
      setResult(posted);
      showDeskToast('Payment recorded', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment.');
    } finally {
      setPosting(false);
    }
  }, [context, postDisabled, ajaxUrl, csrfToken, type, visitId, amountNumber, method, reference, note]);

  const symbol = context?.currency_symbol ?? '';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-cashier-other-payment"
        className={dialogContentSizeClass.confirm}
        aria-labelledby="nc-cashier-other-payment-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-cashier-other-payment-title">Record other payment</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          {error && <div className={deskCalloutClass('error', 'mb-3 py-2 text-sm')}>{error}</div>}

          {result ? (
            <div className="space-y-3">
              <div className={deskCalloutClass('success', 'py-2 text-sm')}>
                Receipt <strong>{result.receipt_number}</strong> issued —{' '}
                {symbol}{result.amount.toFixed(2)} ({result.method === 'momo' ? 'MoMo' : 'Cash'}
                {result.type === 'deposit' ? ' · deposit' : ' · balance payment'}).
              </div>
              <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">
                It appears in the patient&apos;s payment history and in Billing back office,
                where it can be reprinted or reversed.
              </p>
              <div className="flex justify-end">
                <Button type="button" onClick={onClose}>Done</Button>
              </div>
            </div>
          ) : !context ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--oe-nc-text-muted)]">
                Find the patient this money belongs to.
              </p>
              <PatientSearchPanel
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                blocked={loadingContext}
                hint={null}
                onSelectPatient={(pid) => {
                  void loadContext(pid);
                }}
              />
              {loadingContext && (
                <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading patient…</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="mb-0 text-sm font-medium">{context.patient_label}</p>

              <div className="space-y-1.5">
                <Label htmlFor="nc-otherpay-type">What is this money for?</Label>
                <NativeSelect
                  id="nc-otherpay-type"
                  value={type}
                  onChange={(e) => setType(e.target.value === 'visit' ? 'visit' : 'deposit')}
                >
                  <option value="deposit">Deposit / advance (no visit)</option>
                  <option value="visit" disabled={context.payable_visits.length === 0}>
                    Balance owed on a past visit
                  </option>
                </NativeSelect>
              </div>

              {type === 'visit' && (
                <div className="space-y-1.5">
                  <Label htmlFor="nc-otherpay-visit">Visit</Label>
                  <NativeSelect
                    id="nc-otherpay-visit"
                    value={visitId}
                    onChange={(e) => setVisitId(e.target.value)}
                  >
                    {context.payable_visits.map((v) => (
                      <option key={v.visit_id} value={String(v.visit_id)}>
                        {ddmmyyyy(v.visit_date)} · Queue #{v.queue_number} · owes {symbol}{v.owed.toFixed(2)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nc-otherpay-amount">Amount</Label>
                <Input
                  id="nc-otherpay-amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={amount !== '' && (amountInvalid || overOwed) ? true : undefined}
                />
                {amount !== '' && amountInvalid && (
                  <p className="m-0 text-xs text-[var(--oe-nc-danger)]">Enter an amount above zero.</p>
                )}
                {overOwed && selectedVisit && (
                  <p className="m-0 text-xs text-[var(--oe-nc-danger)]">
                    This visit only owes {symbol}{selectedVisit.owed.toFixed(2)} — record the extra as a deposit.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nc-otherpay-method">Method</Label>
                <NativeSelect
                  id="nc-otherpay-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  {context.momo_enabled && <option value="momo">MoMo</option>}
                </NativeSelect>
              </div>

              {method === 'momo' && (
                <div className="space-y-1.5">
                  <Label htmlFor="nc-otherpay-ref">MoMo reference</Label>
                  <Input
                    id="nc-otherpay-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    aria-invalid={momoMissingRef ? true : undefined}
                  />
                  {momoMissingRef && (
                    <p className="m-0 text-xs text-[var(--oe-nc-danger)]">Required for MoMo.</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nc-otherpay-note">Note (shows on the receipt)</Label>
                <Input
                  id="nc-otherpay-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose} disabled={posting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void post();
                  }}
                  disabled={postDisabled}
                >
                  {posting ? 'Recording…' : 'Record payment'}
                </Button>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
