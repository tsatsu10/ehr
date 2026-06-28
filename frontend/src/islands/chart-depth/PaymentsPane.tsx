import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type {
  PaymentHistoryFilter,
  PaymentHistoryRow,
  PaymentHistorySummary,
  PaymentsListData,
  ReceiptReprintPayload,
} from './chartDepthTypes';
import { ReprintReceiptModal } from './ReprintReceiptModal';

interface PaymentsPaneProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  visitId?: number;
}

function formatMoney(symbol: string, amount: number | undefined): string {
  return `${symbol}${Number(amount ?? 0).toFixed(2)}`;
}

function typeLabel(type: PaymentHistoryRow['type']): string {
  if (type === 'charge') return 'Charge';
  if (type === 'adjustment') return 'Adjustment';
  return 'Payment';
}

function SummaryCard({
  summary,
  symbol,
}: {
  summary: PaymentHistorySummary;
  symbol: string;
}) {
  const last = summary.last_receipt;

  return (
    <div className="border rounded p-3 mb-3 bg-light" id="nc-payments-summary">
      <div className="row small">
        <div className="col-sm-4">
          <strong>Charges</strong>
          <div>{formatMoney(symbol, summary.charges_amount)}</div>
        </div>
        <div className="col-sm-4">
          <strong>Paid</strong>
          <div>{formatMoney(symbol, summary.paid_amount)}</div>
        </div>
        <div className="col-sm-4">
          <strong>Balance</strong>
          <div>{formatMoney(symbol, summary.balance_amount)}</div>
        </div>
      </div>
      {last?.receipt_number && (
        <div className="small text-muted mt-2">
          Receipt #{last.receipt_number}
          {last.at_label ? ` · ${last.at_label}` : ''}
          {last.cashier ? ` · ${last.cashier}` : ''}
        </div>
      )}
    </div>
  );
}

export function PaymentsPane({ ajaxUrl, csrfToken, pid, visitId }: PaymentsPaneProps) {
  const initialFilter: PaymentHistoryFilter =
    visitId && visitId > 0 ? 'this_visit' : 'all_visits';

  const [filter, setFilter] = useState<PaymentHistoryFilter>(initialFilter);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState<PaymentHistoryRow[]>([]);
  const [summary, setSummary] = useState<PaymentHistorySummary | null>(null);
  const [symbol, setSymbol] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addCorrectionUrl, setAddCorrectionUrl] = useState<string | null>(null);
  const [addCorrectionLabel, setAddCorrectionLabel] = useState('Add correction');
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintPayload, setReprintPayload] = useState<ReceiptReprintPayload | null>(null);
  const [reprintSubmitting, setReprintSubmitting] = useState(false);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const showFilter = !!(visitId && visitId > 0);

  const buildParams = useCallback(
    (pageOffset: number): Record<string, string | number> => {
      const params: Record<string, string | number> = {
        pid,
        offset: pageOffset,
        filter,
      };
      if (filter === 'this_visit' && visitId && visitId > 0) {
        params.visit_id = visitId;
      }
      if (filter === 'date_range') {
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
      }
      return params;
    },
    [dateFrom, dateTo, filter, pid, visitId],
  );

  const applyListData = useCallback((data: PaymentsListData, append: boolean) => {
    setRows((prev) => (append ? [...prev, ...(data.rows ?? [])] : (data.rows ?? [])));
    setSummary(data.summary ?? null);
    setSymbol(data.currency_symbol ?? '');
    setHasMore(!!data.has_more);
    setOffset(data.next_offset ?? ((data.offset ?? 0) + (data.rows ?? []).length));
    setAddCorrectionUrl(data.add_correction_visible ? (data.add_correction_url ?? null) : null);
    setAddCorrectionLabel(data.add_correction_label ?? 'Add correction');
    if (data.date_from) setDateFrom(data.date_from);
    if (data.date_to) setDateTo(data.date_to);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await oeFetch<PaymentsListData>('chart_depth.payments_list', {
          ...fetchOptions,
          params: buildParams(0),
        });
        if (!cancelled) applyListData(data, false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load payment history.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyListData, buildParams, fetchOptions]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await oeFetch<PaymentsListData>('chart_depth.payments_list', {
        ...fetchOptions,
        params: buildParams(offset),
      });
      applyListData(data, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleReprint = async (row: PaymentHistoryRow) => {
    if (!row.receipt_id) return;
    setReprintSubmitting(true);
    try {
      const payload = await oeFetch<ReceiptReprintPayload>('chart_depth.receipt_reprint', {
        ...fetchOptions,
        method: 'POST',
        json: { pid, receipt_id: row.receipt_id },
      });
      setReprintPayload(payload);
      setReprintOpen(true);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not reprint receipt');
    } finally {
      setReprintSubmitting(false);
    }
  };

  if (loading) {
    return <em>Loading payments…</em>;
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <>
      <div className="btn-group btn-group-sm mb-3" role="group" aria-label="Payment filter">
        {showFilter && (
          <>
            <button
              type="button"
              className={`btn btn-outline-secondary${filter === 'this_visit' ? ' active' : ''}`}
              onClick={() => setFilter('this_visit')}
            >
              This visit
            </button>
            <button
              type="button"
              className={`btn btn-outline-secondary${filter === 'all_visits' ? ' active' : ''}`}
              onClick={() => setFilter('all_visits')}
            >
              All visits
            </button>
          </>
        )}
        <button
          type="button"
          className={`btn btn-outline-secondary${filter === 'date_range' ? ' active' : ''}`}
          onClick={() => setFilter('date_range')}
        >
          Date range
        </button>
      </div>

      {filter === 'date_range' && (
        <div className="form-row align-items-end mb-3">
          <div className="col-auto">
            <label className="small mb-0" htmlFor="nc-payments-date-from">From</label>
            <input
              type="date"
              className="form-control form-control-sm"
              id="nc-payments-date-from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="col-auto">
            <label className="small mb-0" htmlFor="nc-payments-date-to">To</label>
            <input
              type="date"
              className="form-control form-control-sm"
              id="nc-payments-date-to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      )}

      {filter === 'this_visit' && summary && (
        <SummaryCard summary={summary} symbol={symbol} />
      )}

      {addCorrectionUrl && (
        <div className="mb-3">
          <a className="btn btn-outline-secondary btn-sm" href={addCorrectionUrl} target="_top">
            {addCorrectionLabel}
          </a>
        </div>
      )}

      {!rows.length ? (
        <p className="text-muted mb-0">No payment or charge history for this view.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Visit</th>
                <th />
              </tr>
            </thead>
            <tbody id="nc-payments-rows">
              {rows.map((row, idx) => {
                const visitLabel = row.queue_number
                  ? `#${row.queue_number}${row.visit_date ? ` · ${row.visit_date}` : ''}`
                  : '—';

                return (
                  <tr key={`${row.type ?? 'row'}-${row.receipt_id ?? row.occurred_at ?? idx}`}>
                    <td>{row.occurred_at_label ?? row.paid_at_label ?? '—'}</td>
                    <td>{typeLabel(row.type)}</td>
                    <td>
                      <strong>{row.label ?? row.receipt_number ?? '—'}</strong>
                      {row.cashier && (
                        <div className="text-muted small">{row.cashier}</div>
                      )}
                    </td>
                    <td>{formatMoney(symbol, row.amount ?? row.amount_paid)}</td>
                    <td>{visitLabel}</td>
                    <td className="text-right">
                      {row.can_reprint && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={reprintSubmitting}
                          onClick={() => { void handleReprint(row); }}
                        >
                          Reprint
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm mt-2"
          disabled={loadingMore}
          onClick={() => { void loadMore(); }}
        >
          Load more
        </button>
      )}

      <ReprintReceiptModal
        open={reprintOpen}
        payload={reprintPayload}
        currencySymbol={symbol}
        onClose={() => {
          setReprintOpen(false);
          setReprintPayload(null);
        }}
      />
    </>
  );
}
