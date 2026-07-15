import { useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { SegmentedControl } from '@components/SegmentedControl';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import type {
  CashierChargeLine,
  CashierCoverageLine,
  CashierDrugChargeLine,
  CashierPaymentMethod,
  CashierScheme,
  CashierVisit,
  PatientPreview,
} from '@core/types';
import { formatMoney, parseCashInput } from './cashierUtils';

interface SchemeSplitModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  charges: CashierChargeLine[];
  drugCharges: CashierDrugChargeLine[];
  momoEnabled: boolean;
  ajaxUrl: string;
  csrfToken: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (
    schemeId: number,
    membership: string,
    coverageLines: CashierCoverageLine[],
    amountReceived: number,
    method: CashierPaymentMethod,
    momoReference: string,
  ) => void;
}

function lineKey(source: string, id: number): string {
  return `${source}:${id}`;
}

/** CBILL-3 — mark each charge scheme-covered vs patient-pay; collect the patient portion. */
export function SchemeSplitModal({
  open,
  preview,
  visit,
  charges,
  drugCharges,
  momoEnabled,
  ajaxUrl,
  csrfToken,
  submitting,
  error,
  onClose,
  onConfirm,
}: SchemeSplitModalProps) {
  const [schemes, setSchemes] = useState<CashierScheme[]>([]);
  const [schemeId, setSchemeId] = useState(0);
  const [membership, setMembership] = useState('');
  const [covered, setCovered] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<CashierPaymentMethod>('cash');
  const [momoReference, setMomoReference] = useState('');
  const [amount, setAmount] = useState('');

  const lines: CashierCoverageLine[] = useMemo(() => [
    ...charges.map((c) => ({ source: 'billing' as const, source_id: c.id, description: c.description, amount: c.amount })),
    ...drugCharges.map((d) => ({ source: 'drug' as const, source_id: d.sale_id, description: d.description, amount: d.amount })),
  ].map((l) => ({ ...l, covered: covered.has(lineKey(l.source, l.source_id)) })), [charges, drugCharges, covered]);

  const schemeOwed = lines.reduce((sum, l) => (l.covered ? sum + l.amount : sum), 0);
  const patientPay = lines.reduce((sum, l) => (l.covered ? sum : sum + l.amount), 0);

  useEffect(() => {
    if (!open) return;
    setSchemeId(0);
    setMembership('');
    setCovered(new Set());
    setMethod('cash');
    setMomoReference('');
    setAmount('');
    void oeFetch<{ schemes: CashierScheme[] }>('cashier.scheme.list', { ajaxUrl, csrfToken })
      .then((d) => setSchemes(d.schemes ?? []))
      .catch(() => setSchemes([]));
  }, [open, ajaxUrl, csrfToken]);

  useEffect(() => {
    setAmount(patientPay > 0 ? patientPay.toFixed(2) : '0.00');
  }, [patientPay]);

  if (!preview || !visit) return null;

  const isMomo = momoEnabled && method === 'momo';
  const paid = isMomo ? patientPay : parseCashInput(amount);
  const toggle = (key: string) => setCovered((prev) => {
    const next = new Set(prev);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    return next;
  });

  const confirmDisabled =
    schemeId <= 0
    || membership.trim() === ''
    || (patientPay > 0 && paid + 0.001 < patientPay)
    || (isMomo && momoReference.trim() === '');

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Insurance scheme-split"
      confirmLabel="Take scheme payment"
      confirmVariant="primary"
      confirmDisabled={confirmDisabled}
      submitting={submitting}
      submittingLabel="Recording…"
      onConfirm={() => onConfirm(schemeId, membership.trim(), lines, paid, isMomo ? 'momo' : 'cash', momoReference.trim())}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={preview.identity.display_name}
          pubpid={preview.identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      <div className="grid gap-3 mb-3">
        <div className="grid gap-2">
          <Label htmlFor="nc-cashier-scheme" className="normal-case font-normal">Scheme</Label>
          <select
            id="nc-cashier-scheme"
            className="nc-cashier-select"
            value={schemeId}
            onChange={(e) => setSchemeId(Number(e.target.value))}
          >
            <option value={0}>Select a scheme…</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nc-cashier-membership" className="normal-case font-normal">Membership number</Label>
          <Input
            id="nc-cashier-membership"
            type="text"
            maxLength={64}
            value={membership}
            onChange={(e) => setMembership(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-1">Tick each charge the scheme covers:</p>
      <ul className="nc-cashier-coverage mb-3">
        {lines.map((l) => {
          const key = lineKey(l.source, l.source_id);
          return (
            <li key={key} className="nc-cashier-coverage__row">
              <label className="nc-cashier-coverage__label">
                <input type="checkbox" checked={l.covered} onChange={() => toggle(key)} />
                <span>{l.description}{l.source === 'drug' ? ' (medicine)' : ''}</span>
              </label>
              <span className="nc-cashier-coverage__amount">{formatMoney(l.amount)}</span>
            </li>
          );
        })}
      </ul>

      <div className="nc-cashier-scheme-totals mb-3">
        <div><span>Scheme owes</span><strong>{formatMoney(schemeOwed)}</strong></div>
        <div><span>Patient pays</span><strong>{formatMoney(patientPay)}</strong></div>
      </div>

      {momoEnabled && (
        <div className="nc-cashier-payment-method mb-3">
          <span className="nc-cashier-payment-method__label">Payment method</span>
          <SegmentedControl
            ariaLabel="Payment method"
            value={method}
            onChange={(id) => setMethod(id as CashierPaymentMethod)}
            segments={[{ id: 'cash', label: 'Cash' }, { id: 'momo', label: 'MoMo' }]}
          />
        </div>
      )}

      <div className="grid gap-2 mb-0">
        {isMomo ? (
          <>
            <Label htmlFor="nc-cashier-scheme-momo" className="normal-case font-normal">MoMo transaction reference</Label>
            <Input id="nc-cashier-scheme-momo" type="text" maxLength={255} value={momoReference} onChange={(e) => setMomoReference(e.target.value)} />
          </>
        ) : (
          <>
            <Label htmlFor="nc-cashier-scheme-amount" className="normal-case font-normal">Amount received (patient)</Label>
            <Input id="nc-cashier-scheme-amount" type="number" step={0.01} min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </>
        )}
      </div>

      {error && (
        <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} role="alert">{error}</div>
      )}
    </ConfirmModal>
  );
}
