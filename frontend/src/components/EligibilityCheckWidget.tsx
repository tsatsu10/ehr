import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal } from './ConfirmModal';
import { deskCalloutClass } from './deskCalloutStyles';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface EligibilityScheme {
  id: number;
  name: string;
}

interface EligibilityCheck {
  id: number;
  insurance_company_id: number;
  scheme_name: string;
  membership_number: string;
  method: string;
  result: 'eligible' | 'not_eligible' | 'unknown' | string;
  reference_code: string;
  note: string;
  checked_at: string;
}

interface EligibilityCheckWidgetProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  visitId?: number;
  /** Hidden entirely unless payer-aware billing (CBILL-4b) is on for this facility. */
  enabled: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  ussd: 'USSD (e.g. *842#)',
  phone: 'Phone call',
  portal: 'Payer portal',
  card: 'Physical card',
  other: 'Other',
};

const RESULT_LABELS: Record<string, string> = {
  eligible: 'Eligible',
  not_eligible: 'Not eligible',
  unknown: 'Unknown',
};

function resultBadgeVariant(result: string): 'success' | 'danger' | 'neutral' {
  if (result === 'eligible') return 'success';
  if (result === 'not_eligible') return 'danger';
  return 'neutral';
}

const emptyForm = {
  schemeId: 0,
  membershipNumber: '',
  method: 'ussd',
  result: 'eligible',
  referenceCode: '',
  note: '',
};

/** CBILL-4b — logs a manual insurance eligibility check (e.g. NHIS *842# USSD). Shared by
 *  Front Desk and Cashier; the system never performs the check itself. */
export function EligibilityCheckWidget({ ajaxUrl, csrfToken, pid, visitId, enabled }: EligibilityCheckWidgetProps) {
  const [checks, setChecks] = useState<EligibilityCheck[]>([]);
  const [schemes, setSchemes] = useState<EligibilityScheme[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadChecks = useCallback(async () => {
    try {
      const data = await oeFetch<{ checks: EligibilityCheck[] }>('cashier.eligibility_status', {
        ajaxUrl,
        csrfToken,
        params: { pid },
      });
      setChecks(data.checks ?? []);
    } catch {
      // Non-fatal — the badge just stays empty; the "Check eligibility" action still works.
    }
  }, [ajaxUrl, csrfToken, pid]);

  useEffect(() => {
    if (!enabled || pid <= 0) return;
    // react-hooks/set-state-in-effect flags this even though setChecks only runs after the
    // await inside loadChecks resolves — the same known false positive the project already
    // exempts island files for (see eslint.config.js). This is the standard fetch-on-mount
    // pattern; there's no synchronous setState here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadChecks();
  }, [loadChecks, enabled, pid]);

  const openForm = useCallback(() => {
    setForm(emptyForm);
    setError(null);
    setOpen(true);
    if (schemes.length === 0) {
      void oeFetch<{ schemes: EligibilityScheme[] }>('cashier.scheme.list', { ajaxUrl, csrfToken })
        .then((d) => setSchemes(d.schemes ?? []))
        .catch(() => setSchemes([]));
    }
  }, [ajaxUrl, csrfToken, schemes.length]);

  const submit = async () => {
    if (form.schemeId <= 0) {
      setError('Pick a payer');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await oeFetch('cashier.eligibility_check', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          pid,
          visit_id: visitId,
          insurance_company_id: form.schemeId,
          membership_number: form.membershipNumber.trim(),
          method: form.method,
          result: form.result,
          reference_code: form.referenceCode.trim(),
          note: form.note.trim(),
        },
      });
      setOpen(false);
      await loadChecks();
    } catch {
      setError('Could not save the check');
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled || pid <= 0) return null;

  return (
    <div className="nc-eligibility-widget flex flex-wrap items-center gap-2">
      {checks.map((c) => (
        <Badge
          key={c.id}
          variant={resultBadgeVariant(c.result)}
          title={`${c.scheme_name || 'Payer'} · ${RESULT_LABELS[c.result] ?? c.result} · checked ${c.checked_at}`}
        >
          {c.scheme_name || 'Payer'}: {RESULT_LABELS[c.result] ?? c.result}
        </Badge>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={openForm}>
        Check eligibility
      </Button>

      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        title="Log an eligibility check"
        confirmLabel="Save"
        submitting={submitting}
        submittingLabel="Saving…"
        confirmDisabled={form.schemeId <= 0}
        onConfirm={() => void submit()}
      >
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
          Record a check you already performed yourself (e.g. dialled the payer&#39;s USSD code
          or called them) — this does not contact any payer.
        </p>
        <div className="grid gap-2 mb-3">
          <Label htmlFor="nc-elig-scheme" className="normal-case font-normal">Payer</Label>
          <select
            id="nc-elig-scheme"
            className="nc-cashier-select"
            value={form.schemeId}
            onChange={(e) => setForm((f) => ({ ...f, schemeId: Number(e.target.value) }))}
          >
            <option value={0}>Select a payer…</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-2 mb-3">
          <Label htmlFor="nc-elig-membership" className="normal-case font-normal">Membership number</Label>
          <Input
            id="nc-elig-membership"
            type="text"
            maxLength={64}
            value={form.membershipNumber}
            onChange={(e) => setForm((f) => ({ ...f, membershipNumber: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="grid gap-2">
            <Label htmlFor="nc-elig-method" className="normal-case font-normal">How checked</Label>
            <select
              id="nc-elig-method"
              className="nc-cashier-select"
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
            >
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nc-elig-result" className="normal-case font-normal">Result</Label>
            <select
              id="nc-elig-result"
              className="nc-cashier-select"
              value={form.result}
              onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
            >
              {Object.entries(RESULT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-2 mb-3">
          <Label htmlFor="nc-elig-reference" className="normal-case font-normal">Reference code (optional)</Label>
          <Input
            id="nc-elig-reference"
            type="text"
            maxLength={64}
            value={form.referenceCode}
            onChange={(e) => setForm((f) => ({ ...f, referenceCode: e.target.value }))}
            placeholder="e.g. the USSD Claims Check Code"
          />
        </div>
        <div className="grid gap-2 mb-0">
          <Label htmlFor="nc-elig-note" className="normal-case font-normal">Note (optional)</Label>
          <Input
            id="nc-elig-note"
            type="text"
            maxLength={255}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
        {error && (
          <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} role="alert">{error}</div>
        )}
      </ConfirmModal>
    </div>
  );
}
