import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Input } from '@components/ui/input';
import type { PharmActivityReport } from './pharmOpsTypes';

interface PharmOpsActivityReportProps {
  ajaxUrl: string;
  csrfToken: string;
  /** Stock inventory_activity.php link — kept as the full-accounting fallback. */
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

export function PharmOpsActivityReport({ ajaxUrl, csrfToken, fallbackUrl }: PharmOpsActivityReportProps) {
  const [from, setFrom] = useState<string>(() => isoDaysAgo(30));
  const [to, setTo] = useState<string>(() => todayIso());
  const [data, setData] = useState<PharmActivityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await oeFetch<PharmActivityReport>('pharm_ops.inventory.activity', {
        ...fetchOptions,
        params: { from, to },
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory activity');
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
    <div className="nc-pharmops-activity">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-activity-from">From</label>
          <Input
            id="nc-activity-from"
            type="date"
            className="h-8 w-auto"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-activity-to">To</label>
          <Input
            id="nc-activity-to"
            type="date"
            className="h-8 w-auto"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading inventory activity…</div>
      ) : error ? (
        <div className={deskCalloutClass('warn')} role="alert">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="nc-pharmops-empty-card">
          <div className="nc-pharmops-empty-card-title">No stock movement</div>
          <div className="nc-pharmops-empty-card-body">
            Nothing moved in or out over the selected date range.
          </div>
        </div>
      ) : (
        <div className="nc-pharmops-reorder-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="nc-pharmops-reorder-table w-full">
            <thead>
              <tr>
                <th style={LEFT}>Product</th>
                <th style={RIGHT}>Sales</th>
                <th style={RIGHT}>Purchases</th>
                <th style={RIGHT}>Transfers</th>
                <th style={RIGHT}>Distributions</th>
                <th style={RIGHT}>Adjustments</th>
                <th style={RIGHT}>On hand</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.drug_id}>
                  <td style={LEFT}>{row.drug_name}</td>
                  <td style={RIGHT} className="tabular-nums">{row.sales}</td>
                  <td style={RIGHT} className="tabular-nums">{row.purchases}</td>
                  <td style={RIGHT} className="tabular-nums">{row.transfers}</td>
                  <td style={RIGHT} className="tabular-nums">{row.distributions}</td>
                  <td style={RIGHT} className="tabular-nums">{row.adjustments}</td>
                  <td style={RIGHT} className="tabular-nums font-semibold">{row.on_hand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 mb-0 text-sm text-(--oe-nc-text-muted)">
        Movement totals only (out = negative). {fallbackUrl ? (
          <>
            For start/end balances,{' '}
            <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="underline">
              open the stock report
            </a>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
