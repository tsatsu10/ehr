import { useCallback, useEffect, useState } from 'react';
import { PaginationBar } from '@components/PaginationBar';
import { oeFetch } from '@core/oeFetch';
import { ReprintReceiptModal } from '@islands/chart-depth/ReprintReceiptModal';
import type { ReceiptReprintPayload } from '@islands/chart-depth/chartDepthTypes';
import type { BillOpsHubProps, PaymentRow, PaymentsSearchData } from './billOpsTypes';
import { formatBillMoney, localDateString } from './billOpsFormatters';

const PAGE_SIZE = 25;

interface Props {
  fetchOptions: { ajaxUrl: string; csrfToken: string };
  facilityId: number;
}

export function PaymentsPane({ fetchOptions, facilityId }: Props) {
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(localDateString());
  const [applied, setApplied] = useState(() => ({ query: '', date: localDateString() }));
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintPayload, setReprintPayload] = useState<ReceiptReprintPayload | null>(null);
  const [reprintSubmitting, setReprintSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        q: applied.query,
        date_from: applied.date,
        date_to: applied.date,
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (facilityId > 0) body.facility_id = facilityId;

      const data = await oeFetch<PaymentsSearchData>('bill_ops.payments_search', {
        ...fetchOptions,
        json: body,
      });
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setSelected(null);
    } catch {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  }, [applied.date, applied.query, facilityId, fetchOptions, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const runSearch = () => {
    setApplied({ query, date });
    setPage(1);
  };

  const reversePayment = async () => {
    if (!selected || !selected.can_reverse) return;
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    setReversing(true);
    setError(null);
    try {
      await oeFetch('bill_ops.payment_reverse', {
        ...fetchOptions,
        method: 'POST',
        json: { receipt_id: selected.id, reason: reason.trim() },
      });
      setReason('');
      await load();
    } catch {
      setError('Reverse failed');
    } finally {
      setReversing(false);
    }
  };

  const reprintReceipt = async () => {
    if (!selected?.can_reprint || !selected.pid) return;
    setReprintSubmitting(true);
    setError(null);
    try {
      const payload = await oeFetch<ReceiptReprintPayload>('bill_ops.receipt_reprint', {
        ...fetchOptions,
        method: 'POST',
        json: { pid: selected.pid, receipt_id: selected.id },
      });
      setReprintPayload(payload);
      setReprintOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reprint receipt');
    } finally {
      setReprintSubmitting(false);
    }
  };

  return (
    <div className="oe-nc-billops-pane">
      <div className="form-inline mb-3 flex-wrap">
        <input
          type="search"
          className="form-control form-control-sm mr-2 mb-1"
          placeholder="Receipt # / MRN / name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch();
          }}
        />
        <input
          type="date"
          className="form-control form-control-sm mr-2 mb-1"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm mb-1"
          onClick={runSearch}
          disabled={loading}
        >
          Search
        </button>
      </div>

      {error && <div className="alert alert-warning py-2">{error}</div>}

      <table className="table table-sm table-hover">
        <thead>
          <tr>
            <th scope="col">Receipt</th>
            <th scope="col">Patient</th>
            <th scope="col" className="text-right">Amount</th>
            <th scope="col">Cashier</th>
            <th scope="col">Visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={selected?.id === row.id ? 'table-active' : undefined}
              onClick={() => setSelected(row)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                {row.receipt_number}
                {row.reversed_at && <span className="badge badge-secondary ml-1">Reversed</span>}
              </td>
              <td>{row.patient_name}</td>
              <td className="text-right">{formatBillMoney(row.amount_paid)}</td>
              <td>{row.cashier ?? '—'}</td>
              <td>#{row.queue_number}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        id="nc-billops-payments-pagination"
      />

      {selected && (
        <div className="border rounded p-3 mt-2">
          <h3 className="h6">Payment detail</h3>
          <p className="small mb-2">
            Receipt {selected.receipt_number} · Visit #{selected.queue_number} ·{' '}
            {formatBillMoney(selected.amount_paid)}
            {selected.posted_payment_id ? (
              <span className="text-muted"> · Posted #{selected.posted_payment_id}</span>
            ) : null}
          </p>
          {selected.reversed_at ? (
            <p className="small text-muted mb-0">Reversed: {selected.reversal_reason}</p>
          ) : (
            <div className="d-flex flex-wrap align-items-start">
              <div className="mr-3 mb-2">
                <div className="form-group mb-2">
                  <label htmlFor="nc-billops-reverse-reason">Reverse reason</label>
                  <input
                    id="nc-billops-reverse-reason"
                    type="text"
                    className="form-control form-control-sm"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => void reversePayment()}
                  disabled={reversing}
                >
                  {reversing ? 'Reversing…' : 'Reverse payment'}
                </button>
              </div>
              {selected.can_reprint && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm mb-2"
                  onClick={() => void reprintReceipt()}
                  disabled={reprintSubmitting}
                >
                  {reprintSubmitting ? 'Loading…' : 'Reprint receipt'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <ReprintReceiptModal
        open={reprintOpen}
        payload={reprintPayload}
        onClose={() => setReprintOpen(false)}
      />
    </div>
  );
}

export function PaymentsPaneWrapper(props: BillOpsHubProps) {
  return (
    <PaymentsPane
      fetchOptions={{ ajaxUrl: props.ajaxUrl, csrfToken: props.csrfToken }}
      facilityId={props.facilityId}
    />
  );
}
