import { useEffect, useState } from 'react';
import type {
  CashierSelectData,
  CashierSignMeta,
  CashierStagedLine,
  PatientPreview,
} from '@core/types';
import { ChargePicker } from './ChargePicker';
import { ChargesTable } from './ChargesTable';
import { formatMoney } from './cashierUtils';

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
  onTakePayment: (amountReceived: number, receiptNote: string) => void;
  onEsignOverride: (amountReceived: number, receiptNote: string) => void;
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
        <span className="badge badge-success">{completion.score}% complete</span>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2">
        <span className="badge badge-warning">{completion.score}% complete</span>
        {!canSkipCompletion && <span className="text-danger small ml-2">Payment blocked</span>}
      </div>
      <div className="alert alert-warning py-2 mb-2">
        Profile {completion.score}% complete ({completion.billing_threshold}% required).
        {canSkipCompletion
          ? ' You may proceed with supervisor override.'
          : ' Payment is blocked until the profile is updated.'}
        {completion.chart_url && (
          <>
            {' '}
            <a href={completion.chart_url}>Complete profile</a>
          </>
        )}
        {missing.length > 0 && (
          <ul className="mb-0 pl-3 small mt-1">
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

  useEffect(() => {
    if (data) {
      setCashReceived(formatMoney(data.charges_total));
      setReceiptNote('');
    }
  }, [data]);

  if (mode === 'idle') {
    return (
      <div id="nc-cashier-active-pane">
        <div className="card">
          <div className="card-body text-muted text-center py-5">
            <em>Select a visit from the payment queue.</em>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'loading') {
    return (
      <div id="nc-cashier-active-pane">
        <div className="card">
          <div className="card-body"><em>Loading visit…</em></div>
        </div>
      </div>
    );
  }

  if (mode === 'error' || !data || !signMeta) {
    return (
      <div id="nc-cashier-active-pane">
        <div className="alert alert-danger m-0">Failed to load visit.</div>
      </div>
    );
  }

  const { visit, preview, charges, charges_total: total } = data;
  const identity = preview.identity;
  const unsigned = !signMeta.encounter_signed;
  const zeroCharge = total <= 0;
  const payDisabled =
    blocked ||
    total <= 0 ||
    (data.completion_blocked && !data.can_skip_completion) ||
    (unsigned && !esignOverrideAllowed);
  const showEsignPay = unsigned && esignOverrideAllowed && !zeroCharge;
  const change = Math.max(0, (Number.parseFloat(cashReceived) || 0) - total);

  return (
    <div id="nc-cashier-active-pane">
      <div className="card">
        <div className="card-body">
          <div className="nc-patient-context-banner mb-3 p-3 border rounded bg-light">
            <strong>{identity.display_name}</strong> · MRN {identity.pubpid} · Queue #{visit.queue_number}
          </div>

          <CompletionBlock
            preview={preview}
            completionBlocked={data.completion_blocked}
            canSkipCompletion={data.can_skip_completion}
          />

          {unsigned && (
            <div className="alert alert-warning py-2 mb-2">
              {signMeta.unsigned_message || 'Documentation not signed'}
              {signMeta.encounter_url && (
                <>
                  {' '}
                  <a href={signMeta.encounter_url} target="_blank" rel="noopener noreferrer">
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

          <div className="d-flex flex-wrap mt-2 mb-3">
            {(data.advanced_billing_url || data.fee_sheet_url) && (
              <a
                className="btn btn-outline-secondary btn-sm mr-2"
                href={data.advanced_billing_url || data.fee_sheet_url}
                target={data.advanced_billing_external === false ? '_top' : '_blank'}
                rel={data.advanced_billing_external === false ? undefined : 'noopener noreferrer'}
              >
                {data.advanced_billing_label || 'Open fee sheet'}
              </a>
            )}
            {data.front_payment_url && (
              <a className="btn btn-outline-secondary btn-sm mr-2" href={data.front_payment_url} target="_blank" rel="noopener noreferrer">
                Open payments (core)
              </a>
            )}
          </div>

          {zeroCharge ? (
            <div className="alert alert-info py-2">No charges on this visit.</div>
          ) : (
            <>
              <h5>Take payment</h5>
              <div className="form-row align-items-end">
                <div className="form-group col-md-4">
                  <label>Total due</label>
                  <input type="text" className="form-control" readOnly value={formatMoney(total)} />
                </div>
                <div className="form-group col-md-4">
                  <label htmlFor="nc-cash-received">Cash received</label>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    className="form-control"
                    id="nc-cash-received"
                    value={cashReceived}
                    disabled={blocked}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                </div>
                <div className="form-group col-md-4">
                  <label htmlFor="nc-cash-change">Change</label>
                  <input
                    type="text"
                    className="form-control"
                    id="nc-cash-change"
                    readOnly
                    value={formatMoney(change)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="nc-receipt-note">Receipt note (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  id="nc-receipt-note"
                  maxLength={255}
                  value={receiptNote}
                  disabled={blocked}
                  onChange={(e) => setReceiptNote(e.target.value)}
                />
              </div>
            </>
          )}

          {paneError && (
            <div className="alert alert-danger" id="nc-cashier-error" role="alert">
              {paneError}
            </div>
          )}

          <div className="d-flex flex-wrap">
            {zeroCharge && data.can_close_without_charge ? (
              <button
                type="button"
                className="btn btn-success mr-2"
                id="nc-cashier-close-zero-btn"
                disabled={blocked}
                onClick={onCloseZero}
              >
                Close without charge
              </button>
            ) : showEsignPay ? (
              <button
                type="button"
                className="btn btn-warning mr-2"
                id="nc-cashier-esign-override-btn"
                disabled={blocked}
                onClick={() => onEsignOverride(Number.parseFloat(cashReceived) || 0, receiptNote.trim())}
              >
                Pay with E-Sign override
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-success mr-2"
                id="nc-cashier-pay-btn"
                disabled={payDisabled}
                onClick={() => onTakePayment(Number.parseFloat(cashReceived) || 0, receiptNote.trim())}
              >
                Take payment
              </button>
            )}
            {canMarkUnpaid && (
              <button
                type="button"
                className="btn btn-outline-danger mr-2"
                id="nc-cashier-unpaid-btn"
                disabled={blocked}
                onClick={onMarkUnpaid}
              >
                Mark left unpaid
              </button>
            )}
            {visitBoardUrl && (
              <a className="btn btn-outline-secondary btn-sm" href={visitBoardUrl} target="_top">
                Visit Board
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
