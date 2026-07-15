import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import type { PharmTransactionLedger, PharmTransactionRow } from './pharmOpsTypes';

interface PharmOpsTransactionsReportProps {
  ajaxUrl: string;
  csrfToken: string;
  /** Stock inventory_transactions.php link — kept as a fallback. */
  fallbackUrl?: string;
}

// Inline alignment: the BS4-colliding alignment utilities are pinned by the
// bs:check ratchet, so we set textAlign via style instead of class names.
const RIGHT = { textAlign: 'right' as const };
const LEFT = { textAlign: 'left' as const };

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'sale', label: 'Sale' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'adjustment', label: 'Adjustment' },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ddmmyyyy(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function PharmOpsTransactionsReport({ ajaxUrl, csrfToken, fallbackUrl }: PharmOpsTransactionsReportProps) {
  const [from, setFrom] = useState<string>(() => isoDaysAgo(30));
  const [to, setTo] = useState<string>(() => todayIso());
  const [type, setType] = useState<string>('');
  const [rows, setRows] = useState<PharmTransactionRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const fetchPage = useCallback(
    async (offset: number) => {
      return oeFetch<PharmTransactionLedger>('pharm_ops.inventory.transactions', {
        ...fetchOptions,
        params: { from, to, type, offset },
      });
    },
    [fetchOptions, from, to, type],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPage(0);
      setRows(res.items ?? []);
      setHasMore(!!res.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
      setRows([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetchPage(rows.length);
      setRows((prev) => [...prev, ...(res.items ?? [])]);
      setHasMore(!!res.has_more);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, rows.length]);

  return (
    <div className="nc-pharmops-transactions">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-tx-from">From</label>
          <Input id="nc-tx-from" type="date" className="h-8 w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-tx-to">To</label>
          <Input id="nc-tx-to" type="date" className="h-8 w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-tx-type">Type</label>
          <NativeSelect id="nc-tx-type" className="h-8 w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value || 'all'} value={t.value}>{t.label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {loading ? (
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading transactions…</div>
      ) : error ? (
        <div className={deskCalloutClass('warn')} role="alert">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="nc-pharmops-empty-card">
          <div className="nc-pharmops-empty-card-title">No transactions</div>
          <div className="nc-pharmops-empty-card-body">
            No stock transactions match the selected range and type.
          </div>
        </div>
      ) : (
        <>
          <div className="nc-pharmops-reorder-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="nc-pharmops-reorder-table w-full">
              <thead>
                <tr>
                  <th style={LEFT}>Date</th>
                  <th style={LEFT}>Type</th>
                  <th style={LEFT}>Product</th>
                  <th style={LEFT}>Lot</th>
                  <th style={LEFT}>Who</th>
                  <th style={RIGHT}>Qty</th>
                  <th style={RIGHT}>Amount</th>
                  <th style={LEFT}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sale_id}>
                    <td style={LEFT} className="tabular-nums">{ddmmyyyy(row.date)}</td>
                    <td style={LEFT}>{row.type_label}</td>
                    <td style={LEFT}>{row.drug_name}</td>
                    <td style={LEFT}>{row.lot_number || '—'}</td>
                    <td style={LEFT}>{row.who || '—'}</td>
                    <td style={RIGHT} className="tabular-nums">{row.quantity}</td>
                    <td style={RIGHT} className="tabular-nums">{row.amount.toFixed(2)}</td>
                    <td style={LEFT}>{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={loadingMore}
              onClick={() => {
                void loadMore();
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </>
      )}

      {fallbackUrl ? (
        <p className="mt-3 mb-0 text-sm text-(--oe-nc-text-muted)">
          Amounts are unformatted;{' '}
          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="underline">
            open the stock report
          </a>{' '}
          for the full accounting view.
        </p>
      ) : null}
    </div>
  );
}
