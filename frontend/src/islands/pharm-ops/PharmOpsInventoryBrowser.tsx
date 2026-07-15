import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch, OeFetchError } from '@core/oeFetch';
import { formatMoney } from '@core/formatMoney';
import { ConfirmModal } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import type { PharmStockBrowser, PharmStockRow, PharmStockSummary } from './pharmOpsTypes';

// A count that swings on-hand by this many units, or by at least half the
// current on-hand, is treated as "large" and asks for a second confirmation —
// a fat-fingered stock-take shouldn't silently rewrite the shelf.
const LARGE_VARIANCE_ABS = 100;

function isLargeVariance(counted: number, onHand: number): boolean {
  const delta = Math.abs(counted - onHand);
  if (delta >= LARGE_VARIANCE_ABS) return true;
  return onHand > 0 && delta >= onHand * 0.5;
}

interface PendingConfirm {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => void;
}

// INV-3: roll the flat lot list up into one group per drug (lots kept in FEFO order from the API).
interface DrugGroup {
  drug_id: number;
  drug_name: string;
  lots: PharmStockRow[];
  totalOnHand: number;
  totalValue: number | null;
  worstStatus: 'expired' | 'expiring' | 'ok';
  avgPerDay: number;
  /** INV-7: supplier of the drug's latest purchase (same value on every lot row of the drug). */
  supplierName: string | null;
}

function groupLots(rows: PharmStockRow[]): DrugGroup[] {
  const byId = new Map<number, DrugGroup>();
  const order: number[] = [];
  for (const r of rows) {
    let g = byId.get(r.drug_id);
    if (!g) {
      g = {
        drug_id: r.drug_id,
        drug_name: r.drug_name,
        lots: [],
        totalOnHand: 0,
        totalValue: null,
        worstStatus: 'ok',
        avgPerDay: r.avg_per_day ?? 0,
        supplierName: r.supplier_name ?? null,
      };
      byId.set(r.drug_id, g);
      order.push(r.drug_id);
    }
    g.lots.push(r);
    g.totalOnHand += r.on_hand;
    if (r.value != null) g.totalValue = (g.totalValue ?? 0) + r.value;
    if (r.expiry_status === 'expired') g.worstStatus = 'expired';
    else if (r.expiry_status === 'expiring' && g.worstStatus !== 'expired') g.worstStatus = 'expiring';
  }
  return order.map((id) => byId.get(id) as DrugGroup);
}

// INV-6: near-expiry triage — three forward-looking horizons, most urgent first, each clickable
// to filter the lot list to that window. Complements the KPI strip's single 90-day "at risk" tile.
function ExpiryBreakdown({
  summary,
  currencySymbol,
  expiry,
  onExpiryFilter,
}: {
  summary: PharmStockSummary;
  currencySymbol: string;
  expiry: string;
  onExpiryFilter: (value: string) => void;
}) {
  const money = (n?: number) => formatMoney(n ?? 0, { currency_symbol: currencySymbol });
  const tiers: Array<{ filter: string; label: string; count: number; value: number; tone: 'danger' | 'warning' | 'neutral' }> = [
    { filter: '30', label: '≤ 30 days', count: summary.expiring_30 ?? 0, value: summary.value_expiring_30 ?? 0, tone: 'danger' },
    { filter: '60', label: '≤ 60 days', count: summary.expiring_60 ?? 0, value: summary.value_expiring_60 ?? 0, tone: 'warning' },
    { filter: 'expiring', label: '≤ 90 days', count: summary.expiring ?? 0, value: summary.value_expiring ?? 0, tone: 'neutral' },
  ];

  return (
    <div className="nc-pharmops-inv-expiry-breakdown mb-3">
      <div className="nc-pharmops-inv-expiry-breakdown-head">
        <strong>Near-expiry triage</strong>
        <span className="text-(--oe-nc-text-muted) text-sm">
          {' '}— dispense the earliest-expiring lot first (FEFO); expand a drug below to see its lots in that order.
        </span>
      </div>
      <div className="nc-pharmops-inv-expiry-tiers" role="group" aria-label="Expiry horizons">
        {tiers.map((t) => {
          const active = expiry === t.filter;
          const color = t.tone === 'danger'
            ? 'var(--oe-nc-danger)'
            : t.tone === 'warning'
              ? 'var(--oe-nc-warning, #b45309)'
              : undefined;
          return (
            <button
              key={t.filter}
              type="button"
              className={`nc-pharmops-inv-expiry-tier${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onExpiryFilter(active ? 'all' : t.filter)}
            >
              <span className="nc-pharmops-inv-expiry-tier-count tabular-nums" style={color ? { color } : undefined}>
                {t.count}
              </span>
              <span className="nc-pharmops-inv-expiry-tier-label">{t.label}</span>
              <span className="nc-pharmops-inv-expiry-tier-value tabular-nums">{money(t.value)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Days of stock left at the current consumption rate, and a health tone for it (INV-4). */
function supplyInfo(group: DrugGroup): { days: number | null; tone?: 'danger' | 'warning' | 'muted' } {
  if (group.avgPerDay <= 0) {
    return { days: null };
  }
  const days = Math.round(group.totalOnHand / group.avgPerDay);
  if (days <= 7) return { days, tone: 'danger' };
  if (days <= 30) return { days, tone: 'warning' };
  if (days > 120) return { days, tone: 'muted' };
  return { days };
}

interface PharmOpsInventoryBrowserProps {
  ajaxUrl: string;
  csrfToken: string;
  canReceive?: boolean;
  canDestroy?: boolean;
  onReceive?: (drugId: number, drugName: string) => void;
  onDestroy?: (drugId: number, inventoryId: number, drugName: string, lotNumber: string) => void;
  /** Bumped by the hub after a receive/destroy drawer saves, to force a reload. */
  refreshToken?: number;
}

// Inline alignment: the BS4-colliding alignment utilities are pinned by the
// bs:check ratchet, so we set textAlign via style instead of class names.
const RIGHT = { textAlign: 'right' as const };
const LEFT = { textAlign: 'left' as const };

const EXPIRY_FILTERS = [
  { value: 'all', label: 'All lots' },
  { value: '30', label: 'Expiring ≤ 30 days' },
  { value: '60', label: 'Expiring ≤ 60 days' },
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

interface SummaryStat {
  label: string;
  value: string;
  tone?: 'danger' | 'warning';
  /** When set, the tile is a button that filters the browser to that expiry slice. */
  filter?: 'expiring' | 'expired';
}

function StockSummaryStrip({
  summary,
  currencySymbol,
  expiry,
  onExpiryFilter,
}: {
  summary: PharmStockSummary;
  currencySymbol: string;
  expiry: string;
  onExpiryFilter: (value: string) => void;
}) {
  const money = (n?: number) => formatMoney(n ?? 0, { currency_symbol: currencySymbol });
  const valueAtRisk = (summary.value_expiring ?? 0) + (summary.value_expired ?? 0);

  const stats: SummaryStat[] = [
    { label: 'Stock value', value: money(summary.total_value) },
    { label: 'Value at risk', value: money(valueAtRisk), tone: valueAtRisk > 0 ? 'warning' : undefined, filter: 'expiring' },
    { label: 'Wastage rate', value: `${summary.wastage_rate_pct ?? 0}%`, tone: (summary.wastage_rate_pct ?? 0) >= 5 ? 'danger' : undefined, filter: 'expired' },
    { label: 'In-stock SKUs', value: String(summary.sku_count) },
    { label: 'Out of stock', value: String(summary.out_of_stock), tone: summary.out_of_stock > 0 ? 'danger' : undefined },
    { label: 'At reorder', value: String(summary.at_reorder), tone: summary.at_reorder > 0 ? 'warning' : undefined },
    { label: 'Expiring ≤ 90d', value: String(summary.expiring), filter: 'expiring' },
    { label: 'Expired lots', value: String(summary.expired), tone: summary.expired > 0 ? 'danger' : undefined, filter: 'expired' },
  ];

  return (
    <div className="nc-pharmops-inv-summary mb-3" role="group" aria-label="Stockroom health">
      {stats.map((s) => {
        const active = s.filter !== undefined && expiry === s.filter;
        const valueStyle = s.tone === 'danger'
          ? { color: 'var(--oe-nc-danger)' }
          : s.tone === 'warning'
            ? { color: 'var(--oe-nc-warning, #b45309)' }
            : undefined;
        const inner = (
          <>
            <span className="nc-pharmops-inv-summary-value tabular-nums" style={valueStyle}>{s.value}</span>
            <span className="nc-pharmops-inv-summary-label">{s.label}</span>
          </>
        );
        if (s.filter !== undefined) {
          return (
            <button
              key={s.label}
              type="button"
              className={`nc-pharmops-inv-summary-stat${active ? ' is-active' : ''}`}
              aria-pressed={active}
              title={active ? 'Clear filter' : `Show ${s.label.toLowerCase()}`}
              onClick={() => onExpiryFilter(active ? 'all' : s.filter as string)}
            >
              {inner}
            </button>
          );
        }
        return (
          <div key={s.label} className="nc-pharmops-inv-summary-stat">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function PharmOpsInventoryBrowser({
  ajaxUrl,
  csrfToken,
  canReceive = false,
  canDestroy = false,
  onReceive,
  onDestroy,
  refreshToken = 0,
}: PharmOpsInventoryBrowserProps) {
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [expiry, setExpiry] = useState('all');
  const [rows, setRows] = useState<PharmStockRow[]>([]);
  const [summary, setSummary] = useState<PharmStockSummary | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline single-lot adjust.
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);
  // On-hand the row showed when Adjust was opened — sent as the optimistic-
  // concurrency guard so a dispense that landed since then can't be overwritten.
  const [adjustExpected, setAdjustExpected] = useState<number | null>(null);

  // Stock-take (physical count) mode.
  const [stocktake, setStocktake] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [applying, setApplying] = useState(false);

  // Large-variance second confirmation (adjust or stock-take).
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const canAdjust = canReceive;
  const showActions = (canReceive || canDestroy || canAdjust) && !stocktake;

  // Drug-grouped view (INV-3): collapse lots under a per-drug row that rolls up on-hand + value.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleGroup = useCallback((drugId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(drugId)) {
        next.delete(drugId);
      } else {
        next.add(drugId);
      }
      return next;
    });
  }, []);

  const groups = useMemo(() => groupLots(rows), [rows]);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const fetchPage = useCallback(
    (offset: number) =>
      oeFetch<PharmStockBrowser>('pharm_ops.inventory.stock_list', {
        ...fetchOptions,
        params: { search, show_empty: showEmpty ? 1 : 0, expiry, offset },
      }),
    [fetchOptions, search, showEmpty, expiry],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAdjustId(null);
    try {
      const res = await fetchPage(0);
      setRows(res.items ?? []);
      setSummary(res.summary ?? null);
      setCurrencySymbol(res.currency_symbol ?? '');
      setHasMore(!!res.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
      setRows([]);
      setSummary(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload when the hub signals a receive/destroy happened — but never mid
  // stock-take, or the reload would wipe counts the user has already entered.
  useEffect(() => {
    if (refreshToken > 0 && !stocktake) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

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

  const openAdjust = useCallback((row: PharmStockRow) => {
    setAdjustId(row.inventory_id);
    setAdjustValue(String(row.on_hand));
    setAdjustExpected(row.on_hand);
    setAdjustReason('');
  }, []);

  const doAdjust = useCallback(
    async (inventoryId: number, counted: number, expected: number) => {
      setAdjustBusy(true);
      try {
        await oeFetch('pharm_ops.inventory.adjust', {
          ...fetchOptions,
          method: 'POST',
          json: {
            inventory_id: inventoryId,
            counted_on_hand: counted,
            reason: adjustReason,
            expected_on_hand: expected,
          },
        });
        showDeskToast('Stock adjusted', 'success');
        setAdjustId(null);
        await load();
      } catch (err) {
        showDeskToast(err instanceof Error ? err.message : 'Adjust failed', 'danger');
      } finally {
        setAdjustBusy(false);
      }
    },
    [adjustReason, fetchOptions, load],
  );

  const applyAdjust = useCallback(
    (inventoryId: number) => {
      const counted = Number(adjustValue);
      if (!Number.isFinite(counted) || counted < 0) {
        showDeskToast('Enter a valid count', 'danger');
        return;
      }
      const expected = adjustExpected ?? counted;
      if (isLargeVariance(counted, expected)) {
        setConfirm({
          title: 'Large stock change',
          body: `This changes on-hand from ${expected} to ${counted} (a difference of ${counted - expected}). Apply this adjustment?`,
          confirmLabel: 'Apply adjustment',
          run: () => {
            void doAdjust(inventoryId, counted, expected);
          },
        });
        return;
      }
      void doAdjust(inventoryId, counted, expected);
    },
    [adjustValue, adjustExpected, doAdjust],
  );

  const startStocktake = useCallback(() => {
    const initial: Record<number, string> = {};
    rows.forEach((r) => {
      initial[r.inventory_id] = String(r.on_hand);
    });
    setCounts(initial);
    setAdjustId(null);
    setStocktake(true);
  }, [rows]);

  const cancelStocktake = useCallback(() => {
    setStocktake(false);
    setCounts({});
  }, []);

  const changedCounts = useMemo(
    () =>
      rows.filter((r) => {
        const raw = counts[r.inventory_id];
        const n = Number(raw);
        return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 && n !== r.on_hand;
      }),
    [rows, counts],
  );

  const doStocktake = useCallback(async () => {
    setApplying(true);
    const results = await Promise.allSettled(
      changedCounts.map((r) =>
        oeFetch('pharm_ops.inventory.adjust', {
          ...fetchOptions,
          method: 'POST',
          json: {
            inventory_id: r.inventory_id,
            counted_on_hand: Number(counts[r.inventory_id]),
            reason: 'Stock-take',
            expected_on_hand: r.on_hand,
          },
        }),
      ),
    );
    const rejected = results.filter((x) => x.status === 'rejected');
    const conflicts = rejected.filter(
      (x) => x.reason instanceof OeFetchError && x.reason.status === 409,
    ).length;
    const otherFailed = rejected.length - conflicts;
    const ok = changedCounts.length - rejected.length;
    setApplying(false);
    setStocktake(false);
    setCounts({});
    if (rejected.length === 0) {
      showDeskToast(`${ok} lot(s) adjusted`, 'success');
    } else {
      const parts = [`${ok} adjusted`];
      if (conflicts > 0) parts.push(`${conflicts} changed mid-count — recount`);
      if (otherFailed > 0) parts.push(`${otherFailed} failed`);
      showDeskToast(parts.join(', '), 'warning');
    }
    await load();
  }, [changedCounts, counts, fetchOptions, load]);

  const applyStocktake = useCallback(() => {
    if (changedCounts.length === 0) {
      cancelStocktake();
      return;
    }
    const big = changedCounts.filter((r) => isLargeVariance(Number(counts[r.inventory_id]), r.on_hand));
    if (big.length > 0) {
      setConfirm({
        title: 'Large stock changes',
        body: `${big.length} of ${changedCounts.length} lot(s) change by a large amount. Apply all ${changedCounts.length} counts anyway?`,
        confirmLabel: `Apply ${changedCounts.length} counts`,
        run: () => {
          void doStocktake();
        },
      });
      return;
    }
    void doStocktake();
  }, [changedCounts, counts, cancelStocktake, doStocktake]);

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

      {canAdjust && rows.length > 0 && !loading && !error ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {stocktake ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={applying}
                onClick={() => {
                  void applyStocktake();
                }}
              >
                {applying ? 'Applying…' : `Apply counts (${changedCounts.length})`}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={applying} onClick={cancelStocktake}>
                Cancel
              </Button>
              <span className="text-sm text-(--oe-nc-text-muted)">
                Enter the counted quantity for each lot — changed rows show the variance.
              </span>
            </>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={startStocktake}>
              Start stock-take
            </Button>
          )}
        </div>
      ) : null}

      {summary ? (
        <StockSummaryStrip
          summary={summary}
          currencySymbol={currencySymbol}
          expiry={expiry}
          onExpiryFilter={setExpiry}
        />
      ) : null}

      {summary ? (
        <ExpiryBreakdown
          summary={summary}
          currencySymbol={currencySymbol}
          expiry={expiry}
          onExpiryFilter={setExpiry}
        />
      ) : null}

      {loading ? (
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading inventory…</div>
      ) : error ? (
        <div className={deskCalloutClass('warn')} role="alert">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="nc-pharmops-empty-card">
          <div className="nc-pharmops-empty-card-title">No stock</div>
          <div className="nc-pharmops-empty-card-body">No lots match the current filters.</div>
        </div>
      ) : (
        <>
          <div className="nc-pharmops-report-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="nc-pharmops-report-table w-full">
              <thead>
                <tr>
                  <th style={LEFT}>Drug</th>
                  <th style={LEFT}>Lot</th>
                  <th style={RIGHT}>On hand</th>
                  <th style={RIGHT}>Value</th>
                  <th style={RIGHT}>Days left</th>
                  <th style={LEFT}>Expiry</th>
                  <th style={LEFT}>Status</th>
                  {showActions ? <th style={RIGHT}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const open = stocktake || expanded.has(g.drug_id) || g.lots.some((l) => l.inventory_id === adjustId);
                  return (
                    <Fragment key={g.drug_id}>
                      <tr className="nc-pharmops-inv-drug-row">
                        <td style={LEFT}>
                          <button
                            type="button"
                            className="nc-pharmops-inv-toggle"
                            aria-expanded={open}
                            onClick={() => toggleGroup(g.drug_id)}
                          >
                            <span className="nc-pharmops-inv-caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                            <strong>{g.drug_name}</strong>
                            <span className="text-(--oe-nc-text-muted)"> · {g.lots.length} lot{g.lots.length === 1 ? '' : 's'}</span>
                          </button>
                          <div className="nc-pharmops-inv-supplier text-(--oe-nc-text-muted) text-sm">
                            {g.supplierName ? `Supplier: ${g.supplierName}` : 'Supplier: —'}
                          </div>
                        </td>
                        <td style={LEFT} className="text-(--oe-nc-text-muted)">—</td>
                        <td style={RIGHT} className="tabular-nums">{g.totalOnHand}</td>
                        <td style={RIGHT} className="tabular-nums">
                          {g.totalValue != null
                            ? formatMoney(g.totalValue, { currency_symbol: currencySymbol })
                            : <span className="text-(--oe-nc-text-muted)">—</span>}
                        </td>
                        <td style={RIGHT} className="tabular-nums">
                          {(() => {
                            const s = supplyInfo(g);
                            if (s.days == null) {
                              return <span className="text-(--oe-nc-text-muted)">—</span>;
                            }
                            const color = s.tone === 'danger'
                              ? 'var(--oe-nc-danger)'
                              : s.tone === 'warning'
                                ? 'var(--oe-nc-warning, #b45309)'
                                : s.tone === 'muted'
                                  ? 'var(--oe-nc-text-muted)'
                                  : undefined;
                            return <span style={color ? { color } : undefined} title={`~${g.avgPerDay}/day`}>{s.days}d</span>;
                          })()}
                        </td>
                        <td style={LEFT} className="text-(--oe-nc-text-muted)">—</td>
                        <td style={LEFT}>
                          {g.worstStatus === 'ok'
                            ? <span className="text-(--oe-nc-text-muted)">OK</span>
                            : <Badge variant={expiryVariant(g.worstStatus)}>{expiryText(g.worstStatus)}</Badge>}
                        </td>
                        {showActions ? (
                          <td style={RIGHT}>
                            {canReceive && onReceive ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => onReceive(g.drug_id, g.drug_name)}>
                                Receive
                              </Button>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                      {open ? g.lots.map((row) => (
                  <tr key={row.inventory_id} className="nc-pharmops-inv-lot-row">
                    <td style={LEFT} className="nc-pharmops-inv-lot-indent" />
                    <td style={LEFT}>{row.lot_number || '—'}</td>
                    <td style={RIGHT} className="tabular-nums">
                      {stocktake ? (
                        (() => {
                          const raw = counts[row.inventory_id] ?? '';
                          const n = Number(raw);
                          const variance = raw !== '' && Number.isFinite(n) ? n - row.on_hand : 0;
                          return (
                            <span className="inline-flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                min={0}
                                className="h-7 w-20 inline-block"
                                value={raw}
                                onChange={(e) => setCounts((prev) => ({ ...prev, [row.inventory_id]: e.target.value }))}
                                aria-label={`Counted ${row.drug_name} ${row.lot_number}`}
                              />
                              <span
                                style={{ color: variance === 0 ? 'var(--oe-nc-text-muted)' : variance < 0 ? 'var(--oe-nc-danger)' : 'var(--oe-nc-cta)' }}
                              >
                                {variance === 0 ? `was ${row.on_hand}` : variance > 0 ? `+${variance}` : variance}
                              </span>
                            </span>
                          );
                        })()
                      ) : adjustId === row.inventory_id ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-7 w-20 inline-block"
                          value={adjustValue}
                          onChange={(e) => setAdjustValue(e.target.value)}
                          aria-label="Counted on hand"
                        />
                      ) : (
                        row.on_hand
                      )}
                    </td>
                    <td style={RIGHT} className="tabular-nums">
                      {row.value != null
                        ? formatMoney(row.value, { currency_symbol: currencySymbol })
                        : <span className="text-(--oe-nc-text-muted)">—</span>}
                    </td>
                    <td style={RIGHT} aria-hidden />
                    <td style={LEFT} className="tabular-nums">{ddmmyyyy(row.expiration)}</td>
                    <td style={LEFT}>
                      {row.expiry_status === 'ok' ? (
                        <span className="text-(--oe-nc-text-muted)">OK</span>
                      ) : (
                        <Badge variant={expiryVariant(row.expiry_status)}>{expiryText(row.expiry_status)}</Badge>
                      )}
                    </td>
                    {showActions ? (
                      <td style={RIGHT}>
                        {adjustId === row.inventory_id ? (
                          <span className="inline-flex flex-wrap items-center justify-end gap-1">
                            <Input
                              type="text"
                              className="h-7 w-32 inline-block"
                              placeholder="Reason"
                              value={adjustReason}
                              onChange={(e) => setAdjustReason(e.target.value)}
                              aria-label="Adjustment reason"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={adjustBusy}
                              onClick={() => {
                                void applyAdjust(row.inventory_id);
                              }}
                            >
                              {adjustBusy ? 'Saving…' : 'Apply'}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" disabled={adjustBusy} onClick={() => setAdjustId(null)}>
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <span className="inline-flex flex-wrap items-center justify-end gap-1">
                            {canAdjust ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => openAdjust(row)}>
                                Adjust
                              </Button>
                            ) : null}
                            {canDestroy && onDestroy && row.on_hand > 0 ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onDestroy(row.drug_id, row.inventory_id, row.drug_name, row.lot_number)}
                              >
                                Destroy
                              </Button>
                            ) : null}
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                      )) : null}
                    </Fragment>
                  );
                })}
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

      {confirm ? (
        <ConfirmModal
          open
          title={confirm.title}
          confirmLabel={confirm.confirmLabel}
          confirmVariant="warning"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const run = confirm.run;
            setConfirm(null);
            run();
          }}
        >
          <p className="text-sm text-(--oe-nc-text)">{confirm.body}</p>
        </ConfirmModal>
      ) : null}
    </div>
  );
}
