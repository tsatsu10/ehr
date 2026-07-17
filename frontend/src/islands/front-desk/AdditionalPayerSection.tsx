import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';

interface PatientPayer {
  id: number;
  rank: string;
  payer_type: string;
  insurance_company_id: number | null;
  scheme_name: string;
  membership_number: string;
  expiry_date: string | null;
}

interface AdditionalPayerSectionProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  /** CBILL-4c — hidden entirely unless payer-aware billing is on for this facility. */
  enabled: boolean;
}

const emptyForm = {
  payerType: 'nhis',
  insuranceCompanyId: 0,
  membershipNumber: '',
  expiryDate: '',
};

/** CBILL-4c — a patient's NHIS/private payer beyond their primary one, captured earlier in
 *  registration. Purely additive: does not touch the primary payer fields. */
export function AdditionalPayerSection({ ajaxUrl, csrfToken, pid, enabled }: AdditionalPayerSectionProps) {
  const [payers, setPayers] = useState<PatientPayer[]>([]);
  const [schemes, setSchemes] = useState<{ id: number; name: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await oeFetch<{ enabled: boolean; payers: PatientPayer[] }>(
        'patients.registration.payer_list',
        { ajaxUrl, csrfToken, params: { pid } },
      );
      setPayers(data.payers ?? []);
    } catch {
      // Non-fatal — the section just stays empty; adding a payer still works.
    }
  }, [ajaxUrl, csrfToken, pid]);

  useEffect(() => {
    if (!enabled || pid <= 0) return;
    void load();
  }, [load, enabled, pid]);

  const startAdding = useCallback(() => {
    setForm(emptyForm);
    setError(null);
    setAdding(true);
    if (schemes.length === 0) {
      void oeFetch<{ schemes: { id: number; name: string }[] }>('cashier.scheme.list', { ajaxUrl, csrfToken })
        .then((d) => setSchemes(d.schemes ?? []))
        .catch(() => setSchemes([]));
    }
  }, [ajaxUrl, csrfToken, schemes.length]);

  const savePayer = async () => {
    if (form.payerType === 'private' && form.insuranceCompanyId <= 0) {
      setError('Pick an insurer for a private payer');
      return;
    }
    if (form.membershipNumber.trim() === '') {
      setError('Membership number is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await oeFetch('patients.registration.payer_add', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          pid,
          rank: payers.length === 0 ? 'secondary' : 'tertiary',
          payer_type: form.payerType,
          insurance_company_id: form.payerType === 'private' ? form.insuranceCompanyId : null,
          membership_number: form.membershipNumber.trim(),
          expiry_date: form.expiryDate || null,
        },
      });
      setAdding(false);
      await load();
    } catch {
      setError('Could not save the payer');
    } finally {
      setSaving(false);
    }
  };

  const removePayer = async (id: number) => {
    setBusyId(id);
    try {
      await oeFetch('patients.registration.payer_remove', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { pid, id },
      });
      await load();
    } catch {
      setError('Could not remove the payer');
    } finally {
      setBusyId(0);
    }
  };

  if (!enabled || pid <= 0) return null;

  return (
    <div className="nc-reg-additional-payer mt-4" id="nc-reg-additional-payer">
      <h3 className="text-sm font-semibold mb-1">Additional payer</h3>
      <p className="text-xs text-[var(--oe-nc-text-muted)] mb-2">
        If this patient has a second payer besides the one above — e.g. NHIS plus a private
        top-up scheme — add it here. The cashier can then split a bill across both.
      </p>

      {payers.length === 0 && !adding && (
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">No additional payer on file.</p>
      )}

      {payers.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm mb-2 py-1">
          <span>
            {p.payer_type === 'nhis' ? 'NHIS' : (p.scheme_name || 'Private')}
            {' · '}
            {p.membership_number}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busyId === p.id}
            onClick={() => void removePayer(p.id)}
          >
            Remove
          </Button>
        </div>
      ))}

      {error && <div className={deskCalloutClass('warn', 'py-2 mb-2')}>{error}</div>}

      {!adding && payers.length < 2 && (
        <Button type="button" variant="outline" size="sm" onClick={startAdding}>
          Add a second payer
        </Button>
      )}

      {adding && (
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-12 sm:col-span-3">
            <Label htmlFor="nc-reg-payer-type" className="text-xs">Type</Label>
            <NativeSelect
              id="nc-reg-payer-type"
              className="h-8"
              value={form.payerType}
              onChange={(e) => setForm((f) => ({ ...f, payerType: e.target.value }))}
            >
              <option value="nhis">NHIS</option>
              <option value="private">Private</option>
            </NativeSelect>
          </div>
          {form.payerType === 'private' && (
            <div className="col-span-12 sm:col-span-3">
              <Label htmlFor="nc-reg-payer-insurer" className="text-xs">Insurer</Label>
              <select
                id="nc-reg-payer-insurer"
                className="nc-cashier-select h-8"
                value={form.insuranceCompanyId}
                onChange={(e) => setForm((f) => ({ ...f, insuranceCompanyId: Number(e.target.value) }))}
              >
                <option value={0}>Select…</option>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-12 sm:col-span-3">
            <Label htmlFor="nc-reg-payer-membership" className="text-xs">Membership number</Label>
            <Input
              id="nc-reg-payer-membership"
              className="h-8"
              value={form.membershipNumber}
              onChange={(e) => setForm((f) => ({ ...f, membershipNumber: e.target.value }))}
            />
          </div>
          <div className="col-span-12 sm:col-span-2">
            <Label htmlFor="nc-reg-payer-expiry" className="text-xs">Expiry (optional)</Label>
            <Input
              id="nc-reg-payer-expiry"
              type="date"
              className="h-8"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
            />
          </div>
          <div className="col-span-6 sm:col-span-1">
            <Button type="button" size="sm" className="w-full" disabled={saving} onClick={() => void savePayer()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <div className="col-span-6 sm:col-span-12 sm:mt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
