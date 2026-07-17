import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { formatBillMoney } from './billOpsFormatters';
import type { PayerPricesData } from './billOpsTypes';

interface PayerPricesPanelProps {
  ajaxUrl: string;
  csrfToken: string;
}

const emptyForm = { itemCode: '', itemName: '', priceAmount: '' };

/** CBILL-4a — per-payer price overrides (e.g. NHIS G-DRG tariff). Admin only. */
export function PayerPricesPanel({ ajaxUrl, csrfToken }: PayerPricesPanelProps) {
  const [schemeId, setSchemeId] = useState(0);
  const [data, setData] = useState<PayerPricesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(0);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async (forSchemeId: number) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<PayerPricesData>('bill_ops.payer_prices', {
        ajaxUrl,
        csrfToken,
        json: { insurance_company_id: forSchemeId },
      });
      setData(payload);
      if (forSchemeId === 0 && payload.schemes.length > 0) {
        setSchemeId(payload.schemes[0].id);
      }
    } catch {
      setError('Could not load payer prices');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken]);

  useEffect(() => {
    void load(schemeId);
  }, [schemeId, load]);

  if (data && !data.enabled) return null;

  const saveOverride = async () => {
    if (schemeId <= 0 || form.itemCode.trim() === '') {
      setError('Pick a payer and enter an item code');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await oeFetch('bill_ops.payer_price_upsert', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          insurance_company_id: schemeId,
          item_code: form.itemCode.trim(),
          item_name: form.itemName.trim(),
          price_amount: Number(form.priceAmount) || 0,
        },
      });
      setForm(emptyForm);
      await load(schemeId);
    } catch {
      setError('Could not save the price');
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await oeFetch('bill_ops.payer_price_delete', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { id },
      });
      await load(schemeId);
    } catch {
      setError('Could not remove the price');
    } finally {
      setBusyId(0);
    }
  };

  return (
    <div className="nc-billops-payer-prices mt-4">
      <h3 className="text-sm font-semibold mb-1">Payer prices</h3>
      <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3">
        Set a different price for a payer (e.g. the NHIS tariff for a service or medicine).
        Items with no price here bill the scheme at the clinic&#39;s normal price.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <NativeSelect
          className="h-8 w-auto"
          value={schemeId}
          onChange={(e) => setSchemeId(Number(e.target.value))}
          aria-label="Payer"
        >
          <option value={0}>Select a payer…</option>
          {(data?.schemes ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" size="sm" onClick={() => void load(schemeId)} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <div className={deskCalloutClass('warn', 'py-2')}>{error}</div>}

      {schemeId > 0 && (
        <>
          {data && data.rows.length === 0 && (
            <p className="text-[var(--oe-nc-text-muted)] text-sm">
              No price overrides yet — lines bill at the clinic&#39;s normal price.
            </p>
          )}

          {data && data.rows.length > 0 && (
            <Table className={ncShadcnTableClass({ hover: true, className: 'mb-3' })}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Item code</TableHead>
                  <TableHead scope="col">Item name</TableHead>
                  <TableHead scope="col" className="text-right">Price</TableHead>
                  <TableHead scope="col" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.item_code}</TableCell>
                    <TableCell>{row.item_name || '—'}</TableCell>
                    <TableCell className="text-right">{formatBillMoney(row.price_amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => void removeOverride(row.id)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 sm:col-span-3">
              <label className="block text-sm mb-1" htmlFor="nc-payer-price-code">Item code</label>
              <Input
                id="nc-payer-price-code"
                className="h-8"
                value={form.itemCode}
                onChange={(e) => setForm((f) => ({ ...f, itemCode: e.target.value }))}
                placeholder="e.g. billing code or drug:123"
              />
            </div>
            <div className="col-span-12 sm:col-span-4">
              <label className="block text-sm mb-1" htmlFor="nc-payer-price-name">Item name</label>
              <Input
                id="nc-payer-price-name"
                className="h-8"
                value={form.itemName}
                onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                placeholder="Optional label"
              />
            </div>
            <div className="col-span-8 sm:col-span-3">
              <label className="block text-sm mb-1" htmlFor="nc-payer-price-amount">Price</label>
              <Input
                id="nc-payer-price-amount"
                type="number"
                step="0.01"
                min={0}
                className="h-8"
                value={form.priceAmount}
                onChange={(e) => setForm((f) => ({ ...f, priceAmount: e.target.value }))}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Button type="button" size="sm" className="w-full" disabled={saving} onClick={() => void saveOverride()}>
                {saving ? 'Saving…' : 'Add / update'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
