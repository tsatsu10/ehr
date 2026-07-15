import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Input } from '@components/ui/input';
import type { PharmDestroyedReport } from './pharmOpsTypes';

interface PharmOpsDestroyedReportProps {
  ajaxUrl: string;
  csrfToken: string;
  /** Stock destroyed_drugs_report.php link, kept as a fallback. */
  fallbackUrl?: string;
}

// Inline alignment: the BS4-colliding alignment utilities are pinned by the
// bs:check ratchet, so we set textAlign via style instead of class names.
const RIGHT = { textAlign: 'right' as const };
const LEFT = { textAlign: 'left' as const };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Regional DD/MM/YYYY display for a YYYY-MM-DD value. */
function ddmmyyyy(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function PharmOpsDestroyedReport({ ajaxUrl, csrfToken, fallbackUrl }: PharmOpsDestroyedReportProps) {
  const [from, setFrom] = useState<string>(() => isoDaysAgo(365));
  const [to, setTo] = useState<string>(() => todayIso());
  const [data, setData] = useState<PharmDestroyedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await oeFetch<PharmDestroyedReport>('pharm_ops.inventory.destroyed', {
        ...fetchOptions,
        params: { from, to },
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load destroyed drugs report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];

  return (
    <div className="nc-pharmops-destroyed">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-destroyed-from">From</label>
          <Input
            id="nc-destroyed-from"
            type="date"
            className="h-8 w-auto"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-destroyed-to">To</label>
          <Input
            id="nc-destroyed-to"
            type="date"
            className="h-8 w-auto"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading destroyed drugs…</div>
      ) : error ? (
        <div className={deskCalloutClass('warn')} role="alert">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="nc-pharmops-empty-card">
          <div className="nc-pharmops-empty-card-title">No destroyed lots</div>
          <div className="nc-pharmops-empty-card-body">
            Nothing was written off in the selected date range.
          </div>
        </div>
      ) : (
        <div className="nc-pharmops-report-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="nc-pharmops-report-table w-full">
            <thead>
              <tr>
                <th style={LEFT}>Product</th>
                <th style={LEFT}>Lot</th>
                <th style={RIGHT}>Qty</th>
                <th style={LEFT}>Destroyed on</th>
                <th style={LEFT}>Method</th>
                <th style={LEFT}>Witness</th>
                <th style={LEFT}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.inventory_id}>
                  <td style={LEFT}>{row.drug_name}</td>
                  <td style={LEFT}>{row.lot_number || '—'}</td>
                  <td style={RIGHT} className="tabular-nums">{row.quantity}</td>
                  <td style={LEFT} className="tabular-nums">{ddmmyyyy(row.destroy_date)}</td>
                  <td style={LEFT}>{row.method || '—'}</td>
                  <td style={LEFT}>{row.witness || '—'}</td>
                  <td style={LEFT}>{row.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fallbackUrl ? (
        <p className="mt-3 mb-0 text-sm text-(--oe-nc-text-muted)">
          Need the stock report?{' '}
          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Open the stock version
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
