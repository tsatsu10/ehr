import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import type { PharmStockBrowser, PharmStockRow } from './pharmOpsTypes';

interface PharmOpsInventoryBrowserProps {
  ajaxUrl: string;
  csrfToken: string;
}

// Inline alignment: the BS4-colliding alignment utilities are pinned by the
// bs:check ratchet, so we set textAlign via style instead of class names.
const RIGHT = { textAlign: 'right' as const };
const LEFT = { textAlign: 'left' as const };

const EXPIRY_FILTERS = [
  { value: 'all', label: 'All lots' },
  { value: 'expiring', label: 'Expiring ≤ 90 days' },
  { value: 'expired', label: 'Expired' },
];

function ddmmyyyy(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function expiryVariant(status: PharmStockRow['expiry_status']): 'danger' | 'warning' | 'neutral' {
  if (status === 'expired') return 'danger';
  if (status === 'expiring') return 'warning';
  return 'neutral';
}

function expiryText(status: PharmStockRow['expiry_status']): string {
  if (status === 'expired') return 'Expired';
  if (status === 'expiring') return 'Expiring';
  return 'OK';
}

export function PharmOpsInventoryBrowser({ ajaxUrl, csrfToken }: PharmOpsInventoryBrowserProps) {
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [expiry, setExpiry] = useState('all');
  const [data, setData] = useState<PharmStockBrowser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await oeFetch<PharmStockBrowser>('pharm_ops.inventory.stock_list', {
        ...fetchOptions,
        params: { search, show_empty: showEmpty ? 1 : 0, expiry },
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions, search, showEmpty, expiry]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];

  return (
    <div className="nc-pharmops-inventory">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-inv-search">Search</label>
          <Input
            id="nc-inv-search"
            type="search"
            className="h-8 w-auto"
            placeholder="Drug name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-inv-expiry">Expiry</label>
          <NativeSelect id="nc-inv-expiry" className="h-8 w-auto" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            {EXPIRY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex items-center gap-2 text-sm text-(--oe-nc-text-muted)">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
          Show empty lots
        </label>
      </div>

      {loading ? (
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading inventory…</div>
      ) : error ? (
        <div className={deskCalloutClass('warn')} role="alert">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="nc-pharmops-empty-card">
          <div className="nc-pharmops-empty-card-title">No stock</div>
          <div className="nc-pharmops-empty-card-body">No lots match the current filters.</div>
        </div>
      ) : (
        <div className="nc-pharmops-report-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="nc-pharmops-report-table w-full">
            <thead>
              <tr>
                <th style={LEFT}>Drug</th>
                <th style={LEFT}>Lot</th>
                <th style={RIGHT}>On hand</th>
                <th style={LEFT}>Expiry</th>
                <th style={LEFT}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.inventory_id}>
                  <td style={LEFT}>{row.drug_name}</td>
                  <td style={LEFT}>{row.lot_number || '—'}</td>
                  <td style={RIGHT} className="tabular-nums">{row.on_hand}</td>
                  <td style={LEFT} className="tabular-nums">{ddmmyyyy(row.expiration)}</td>
                  <td style={LEFT}>
                    {row.expiry_status === 'ok' ? (
                      <span className="text-(--oe-nc-text-muted)">OK</span>
                    ) : (
                      <Badge variant={expiryVariant(row.expiry_status)}>{expiryText(row.expiry_status)}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
