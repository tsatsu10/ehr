import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { NativeSelect } from '@components/ui/native-select';
import type { PharmReorderReport, PharmReorderRow } from './pharmOpsTypes';

interface PharmOpsReorderReportProps {
  ajaxUrl: string;
  csrfToken: string;
}

const WINDOWS = [30, 60, 90] as const;

// Inline alignment: the BS4-colliding alignment utilities are pinned by the
// bs:check ratchet, so we set textAlign via style instead of class names.
const RIGHT = { textAlign: 'right' as const };
const LEFT = { textAlign: 'left' as const };

function statusVariant(status: PharmReorderRow['stock_status']): 'danger' | 'warning' | 'neutral' {
  if (status === 'out_of_stock') return 'danger';
  if (status === 'low') return 'warning';
  return 'neutral';
}

export function PharmOpsReorderReport({ ajaxUrl, csrfToken }: PharmOpsReorderReportProps) {
  const [windowDays, setWindowDays] = useState<number>(90);
  const [data, setData] = useState<PharmReorderReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await oeFetch<PharmReorderReport>('pharm_ops.inventory.reorder', {
        ...fetchOptions,
        params: { window_days: windowDays },
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reorder report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];

  return (
    <div className="nc-pharmops-reorder">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-reorder-window">
          Sales window
        </label>
        <NativeSelect
          id="nc-reorder-window"
          className="h-8 w-auto"
          value={String(windowDays)}
          onChange={(event) => setWindowDays(Number(event.target.value))}
        >
          {WINDOWS.map((w) => (
            <option key={w} value={w}>{`Last ${w} days`}</option>
          ))}
        </NativeSelect>
      </div>

      {loading ? (
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading reorder report…</div>
      ) : error ? (
        <div className={deskCalloutClass('warn')} role="alert">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="nc-pharmops-empty-card">
          <div className="nc-pharmops-empty-card-title">All stock healthy</div>
          <div className="nc-pharmops-empty-card-body">
            Nothing is at or below its reorder point over the last {data?.window_days ?? windowDays} days.
          </div>
        </div>
      ) : (
        <div className="nc-pharmops-report-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="nc-pharmops-report-table w-full">
            <thead>
              <tr>
                <th style={LEFT}>Product</th>
                <th style={RIGHT}>QOH</th>
                <th style={RIGHT}>Reorder pt</th>
                <th style={RIGHT}>Sold</th>
                <th style={RIGHT}>Avg/day</th>
                <th style={RIGHT}>Days left</th>
                <th style={RIGHT}>Suggested</th>
                <th style={LEFT}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.drug_id}>
                  <td style={LEFT}>{row.drug_name}</td>
                  <td style={RIGHT} className="tabular-nums">{row.on_hand}</td>
                  <td style={RIGHT} className="tabular-nums">{row.reorder_point || '—'}</td>
                  <td style={RIGHT} className="tabular-nums">{row.sold_qty}</td>
                  <td style={RIGHT} className="tabular-nums">{row.avg_per_day}</td>
                  <td style={RIGHT} className="tabular-nums">{row.days_of_supply ?? '—'}</td>
                  <td style={RIGHT} className="tabular-nums font-semibold">{row.suggested_order_qty}</td>
                  <td style={LEFT}>
                    <Badge variant={statusVariant(row.stock_status)}>{row.status_label}</Badge>
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
