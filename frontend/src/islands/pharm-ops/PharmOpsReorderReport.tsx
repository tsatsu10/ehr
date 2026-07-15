import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { formatMoney } from '@core/formatMoney';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { downloadCsv, reorderToCsv } from './pharmOpsReorderExport';
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
  // Purchase-order quantities (INV-5), keyed by drug_id — starts at the suggested quantity,
  // editable per row before printing/exporting the order.
  const [orderQty, setOrderQty] = useState<Record<number, number>>({});

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
      const nextQty: Record<number, number> = {};
      for (const row of res.items ?? []) {
        nextQty[row.drug_id] = row.suggested_order_qty;
      }
      setOrderQty(nextQty);
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
  const currencySymbol = data?.currency_symbol ?? '';

  const totals = useMemo(() => {
    let orderUnits = 0;
    let cost = 0;
    let costKnown = true;
    for (const row of items) {
      const qty = orderQty[row.drug_id] ?? row.suggested_order_qty;
      orderUnits += qty;
      if (row.unit_cost != null) {
        cost += row.unit_cost * qty;
      } else if (qty > 0) {
        costKnown = false;
      }
    }
    return { orderUnits, cost: Math.round(cost * 100) / 100, costKnown };
  }, [items, orderQty]);

  const handleExport = useCallback(() => {
    const csv = reorderToCsv(items, orderQty, currencySymbol);
    downloadCsv(`purchase-order-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [items, orderQty, currencySymbol]);

  return (
    <div className="nc-pharmops-reorder">
      <div className="nc-pharmops-reorder-toolbar mb-3 flex flex-wrap items-center gap-2">
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
        {items.length > 0 ? (
          <span className="inline-flex gap-2 ml-auto">
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              Export CSV
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              Print purchase order
            </Button>
          </span>
        ) : null}
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
                <th style={RIGHT}>Order qty</th>
                <th style={RIGHT}>Unit cost</th>
                <th style={RIGHT}>Est. cost</th>
                <th style={LEFT}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const qty = orderQty[row.drug_id] ?? row.suggested_order_qty;
                const estCost = row.unit_cost != null ? Math.round(row.unit_cost * qty * 100) / 100 : null;
                return (
                  <tr key={row.drug_id}>
                    <td style={LEFT}>{row.drug_name}</td>
                    <td style={RIGHT} className="tabular-nums">{row.on_hand}</td>
                    <td style={RIGHT} className="tabular-nums">{row.reorder_point || '—'}</td>
                    <td style={RIGHT} className="tabular-nums">{row.sold_qty}</td>
                    <td style={RIGHT} className="tabular-nums">{row.avg_per_day}</td>
                    <td style={RIGHT} className="tabular-nums">{row.days_of_supply ?? '—'}</td>
                    <td style={RIGHT} className="tabular-nums">{row.suggested_order_qty}</td>
                    <td style={RIGHT} className="nc-pharmops-reorder-qty-cell">
                      <Input
                        type="number"
                        min={0}
                        className="h-7 w-16 inline-block tabular-nums"
                        value={qty}
                        aria-label={`Order quantity for ${row.drug_name}`}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setOrderQty((prev) => ({ ...prev, [row.drug_id]: Number.isFinite(n) && n >= 0 ? n : 0 }));
                        }}
                      />
                    </td>
                    <td style={RIGHT} className="tabular-nums">
                      {row.unit_cost != null
                        ? formatMoney(row.unit_cost, { currency_symbol: currencySymbol })
                        : <span className="text-(--oe-nc-text-muted)">—</span>}
                    </td>
                    <td style={RIGHT} className="tabular-nums font-semibold">
                      {estCost != null
                        ? formatMoney(estCost, { currency_symbol: currencySymbol })
                        : <span className="text-(--oe-nc-text-muted)">—</span>}
                    </td>
                    <td style={LEFT}>
                      <Badge variant={statusVariant(row.stock_status)}>{row.status_label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={LEFT} colSpan={6} className="font-semibold">Total</td>
                <td style={RIGHT} className="tabular-nums font-semibold">{totals.orderUnits}</td>
                <td style={RIGHT} />
                <td style={RIGHT} className="tabular-nums font-semibold">
                  {formatMoney(totals.cost, { currency_symbol: currencySymbol })}
                  {!totals.costKnown ? <span className="text-(--oe-nc-text-muted)"> *</span> : null}
                </td>
                <td style={LEFT} />
              </tr>
              {!totals.costKnown ? (
                <tr>
                  <td colSpan={9} className="text-(--oe-nc-text-muted) text-sm">
                    * Partial — some products have no purchase cost on record.
                  </td>
                </tr>
              ) : null}
            </tfoot>
          </table>
        </div>
      )}

    </div>
  );
}
