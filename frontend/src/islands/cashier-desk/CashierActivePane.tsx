import { useEffect, useState } from 'react';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { CompletionScorePill } from '@components/CompletionScorePill';
import { SegmentedControl } from '@components/SegmentedControl';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import type {
  CashierPaymentMethod,
  CashierSelectData,
  CashierSignMeta,
  CashierStagedLine,
  PatientPreview,
} from '@core/types';
import { ChargePicker } from './ChargePicker';
import { ChargesTable } from './ChargesTable';
import { formatMoney, parseCashInput, toCashInputValue } from './cashierUtils';

export type CashierActiveMode = 'idle' | 'loading' | 'checkout' | 'error';

interface CashierActivePaneProps {
  mode: CashierActiveMode;
  data: CashierSelectData | null;
  staged: CashierStagedLine[];
  signMeta: CashierSignMeta | null;
  visitBoardUrl?: string;
  canMarkUnpaid?: boolean;
  esignOverrideAllowed?: boolean;
  blocked: boolean;
  posting: boolean;
  paneError: string | null;
  onStagedChange: (lines: CashierStagedLine[]) => void;
  onPostCharges: () => void;
  onTakePayment: (
    amountReceived: number,
    receiptNote: string,
    paymentMethod: CashierPaymentMethod,
    momoReference: string,
  ) => void;
  onEsignOverride: (
    amountReceived: number,
    receiptNote: string,
    paymentMethod: CashierPaymentMethod,
    momoReference: string,
  ) => void;
  onMarkUnpaid: () => void;
  onCloseZero: () => void;
}

function CompletionBlock({
  preview,
  completionBlocked,
  canSkipCompletion,
}: {
  preview: PatientPreview;
  completionBlocked: boolean;
  canSkipCompletion: boolean;
}) {
  const completion = preview.completion;
  const missing = completion.missing_labels ?? [];
  const blocked = completionBlocked && completion.score < completion.billing_threshold;

  if (!blocked) {
    return (
      <div className="mb-2">
        <CompletionScorePill score={completion.score} threshold={completion.billing_threshold} />
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <CompletionScorePill score={completion.score} threshold={completion.billing_threshold} />
        {!canSkipCompletion && (
          <span className="text-sm text-red-600">Payment blocked</span>
        )}
      </div>
      <div className={deskCalloutClass('warn', 'mb-2 text-sm')}>
        Profile {completion.score}% complete ({completion.billing_threshold}% required).
        {canSkipCompletion
          ? ' You may proceed with supervisor override.'
          : ' Payment is blocked until the profile is updated.'}
        {completion.chart_url && (
          <>
            {' '}
            <a href={completion.chart_url} className="font-medium underline">
              Complete profile
            </a>
          </>
        )}
        {missing.length > 0 && (
          <ul className="mb-0 mt-1 list-disc pl-5 text-sm">
            {missing.slice(0, 4).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function CashierActivePane({
  mode,
  data,
  staged,
  signMeta,
  visitBoardUrl,
  canMarkUnpaid = false,
  esignOverrideAllowed = false,
  blocked,
  posting,
  paneError,
  onStagedChange,
  onPostCharges,
  onTakePayment,
  onEsignOverride,
  onMarkUnpaid,
  onCloseZero,
}: CashierActivePaneProps) {
  const [cashReceived, setCashReceived] = useState('0.00');
  const [receiptNote, setReceiptNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CashierPaymentMethod>('cash');
  const [momoReference, setMomoReference] = useState('');

  useEffect(() => {
    if (data) {
      setCashReceived(toCashInputValue(data.charges_total));
      setReceiptNote('');
      setPaymentMethod('cash');
      setMomoReference('');
    }
  }, [data]);

  if (mode === 'idle') {
    return (
      <div id="nc-cashier-active-pane">
        <Card>
          <CardContent className="text-[var(--oe-nc-text-muted)] text-center py-5">
            <em>Select a visit from the payment queue.</em>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-cashier-active-pane">
        <Card>
          <CardContent><em>Loading visit…</em></CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'error' || !data || !signMeta) {
    return (
      <div id="nc-cashier-active-pane">
        <div className={deskCalloutClass('error', 'm-0 text-sm')} role="alert">
          Failed to load visit.
        </div>
      </div>
    );
  }

  const { visit, preview, charges, charges_total: total } = data;
  const unsigned = !signMeta.encounter_signed;
  const zeroCharge = total <= 0;
  const payBlockReason =
    blocked
      ? 'Return to the queue before taking payment (shared device).'
      : total <= 0
        ? 'Post charges first, or use Close without charge.'
        : data.completion_blocked && !data.can_skip_completion
          ? 'Complete the patient profile before payment.'
          : unsigned && !esignOverrideAllowed
            ? 'Documentation must be signed before payment.'
            : null;
  const payDisabled = payBlockReason !== null
    || (paymentMethod === 'momo' && momoReference.trim() === '');
  const showEsignPay = unsigned && esignOverrideAllowed && !zeroCharge;
  const momoEnabled = !!data.enable_momo_payment;
  const isMomo = momoEnabled && paymentMethod === 'momo';
  const tenderedAmount = isMomo ? total : parseCashInput(cashReceived);
  const change = isMomo ? 0 : Math.max(0, tenderedAmount - total);

  return (
    <div id="nc-cashier-active-pane">
      <Card>
        <CardContent>
          <PatientContextBanner
            identity={preview.identity}
            layout="compact"
            completion={preview.completion}
            safety={preview.safety}
            {...bannerPropsFromPreview(preview)}
            aside={<Badge variant="neutral">Queue #{visit.queue_number}</Badge>}
          >
            <div className="text-sm mt-1 text-[var(--oe-nc-text-muted)]">
              {visit.visit_type_label || 'Payment checkout'}
            </div>
          </PatientContextBanner>

          <CompletionBlock
            preview={preview}
            completionBlocked={data.completion_blocked}
            canSkipCompletion={data.can_skip_completion}
          />

          {unsigned && (
            <div className={deskCalloutClass('warn', 'mb-2 text-sm')}>
              {signMeta.unsigned_message || 'Documentation not signed'}
              {signMeta.encounter_url && (
                <>
                  {' '}
                  <a href={signMeta.encounter_url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                    Open encounter
                  </a>
                </>
              )}
            </div>
          )}

          <ChargePicker
            feeSchedule={data.fee_schedule}
            staged={staged}
            allowDiscount={!!data.can_apply_discount}
            blocked={blocked}
            posting={posting}
            onStagedChange={onStagedChange}
            onPostCharges={onPostCharges}
          />

          <h5>Posted charges</h5>
          <ChargesTable charges={charges} total={total} />

          <div className="mt-2 mb-3 flex flex-wrap gap-2">
            {(data.advanced_billing_url || data.fee_sheet_url) && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={data.advanced_billing_url || data.fee_sheet_url}
                  target={data.advanced_billing_external === false ? '_top' : '_blank'}
                  rel={data.advanced_billing_external === false ? undefined : 'noopener noreferrer'}
                >
                  {data.advanced_billing_label || 'Open fee sheet'}
                </a>
              </Button>
            )}
            {data.front_payment_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={data.front_payment_url} target="_blank" rel="noopener noreferrer">
                  Open payments (core)
                </a>
              </Button>
            )}
          </div>

          {zeroCharge ? (
            <div className={deskCalloutClass('info', 'text-sm')}>No charges on this visit.</div>
          ) : (
            <>
              <h5>Take payment</h5>
              {momoEnabled && (
                <div className="mb-3">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                    Payment method
                  </span>
                  <div className={blocked ? 'pointer-events-none opacity-50' : undefined}>
                    <SegmentedControl
                      ariaLabel="Payment method"
                      value={paymentMethod}
                      onChange={(id) => setPaymentMethod(id as CashierPaymentMethod)}
                      segments={[
                        { id: 'cash', label: 'Cash' },
                        { id: 'momo', label: 'MoMo' },
                      ]}
                    />
                  </div>
                </div>
              )}
              <div className="mb-3 grid grid-cols-1 items-end gap-4 md:grid-cols-12">
                <div className="space-y-1.5 md:col-span-4">
                  <Label className="normal-case font-normal">Total due</Label>
                  <Input type="text" readOnly value={formatMoney(total)} />
                </div>
                {!isMomo ? (
                  <>
                    <div className="space-y-1.5 md:col-span-4">
                      <Label htmlFor="nc-cash-received" className="normal-case font-normal">Cash received</Label>
                      <Input
                        type="number"
                        step={0.01}
                        min={0}
                        id="nc-cash-received"
                        value={cashReceived}
                        disabled={blocked}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-4">
                      <Label htmlFor="nc-cash-change" className="normal-case font-normal">Change</Label>
                      <Input
                        type="text"
                        id="nc-cash-change"
                        readOnly
                        value={formatMoney(change)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1.5 md:col-span-8">
                    <Label htmlFor="nc-momo-reference" className="normal-case font-normal">MoMo transaction reference</Label>
                    <Input
                      type="text"
                      id="nc-momo-reference"
                      maxLength={255}
                      value={momoReference}
                      disabled={blocked}
                      onChange={(e) => setMomoReference(e.target.value)}
                      placeholder="e.g. provider reference or sender name"
                    />
                  </div>
                )}
              </div>
              {!isMomo && (
                <div className="mb-3 space-y-1.5">
                  <Label htmlFor="nc-receipt-note" className="normal-case font-normal">Receipt note (optional)</Label>
                  <Input
                    type="text"
                    id="nc-receipt-note"
                    maxLength={255}
                    value={receiptNote}
                    disabled={blocked}
                    onChange={(e) => setReceiptNote(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {paneError && (
            <div className={deskCalloutClass('error', 'text-sm')} id="nc-cashier-error" role="alert">
              {paneError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {zeroCharge && data.can_close_without_charge ? (
              <Button
                type="button"
                variant="cta"
                id="nc-cashier-close-zero-btn"
                disabled={blocked}
                onClick={onCloseZero}
              >
                Close without charge
              </Button>
            ) : showEsignPay ? (
              <Button
                type="button"
                variant="warning"
                id="nc-cashier-esign-override-btn"
                disabled={blocked}
                onClick={() => onEsignOverride(
                  tenderedAmount,
                  receiptNote.trim(),
                  isMomo ? 'momo' : 'cash',
                  momoReference.trim(),
                )}
              >
                Pay with E-Sign override
              </Button>
            ) : (
              <Button
                type="button"
                variant="cta"
                id="nc-cashier-pay-btn"
                disabled={payDisabled}
                title={payBlockReason ?? undefined}
                aria-disabled={payDisabled}
                onClick={() => onTakePayment(
                  tenderedAmount,
                  receiptNote.trim(),
                  isMomo ? 'momo' : 'cash',
                  momoReference.trim(),
                )}
              >
                Take payment
              </Button>
            )}
            {canMarkUnpaid && (
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                id="nc-cashier-unpaid-btn"
                disabled={blocked}
                onClick={onMarkUnpaid}
              >
                Mark left unpaid
              </Button>
            )}
            {visitBoardUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={visitBoardUrl} target="_top">
                  Visit Board
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
