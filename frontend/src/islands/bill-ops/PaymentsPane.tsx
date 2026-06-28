import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { BillOpsHubProps, PaymentRow, PaymentsSearchData } from './billOpsTypes';
import { formatBillMoney, localDateString } from './billOpsFormatters';

interface Props {
  fetchOptions: { ajaxUrl: string; csrfToken: string };
  facilityId: number;
}

export function PaymentsPane({ fetchOptions, facilityId }: Props) {
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(localDateString());
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [symbol, setSymbol] = useState('GH₵');
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reversing, setReversing] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        q: query,
        date_from: date,
        date_to: date,
      };
      if (facilityId > 0) body.facility_id = facilityId;

      const data = await oeFetch<PaymentsSearchData>('bill_ops.payments_search', {
        ...fetchOptions,
        json: body,
      });
      setRows(data.rows ?? []);
      setSymbol(data.currency_symbol ?? 'GH₵');
      setSelected(null);
    } catch {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  }, [date, facilityId, fetchOptions, query]);

  useEffect(() => {
    void search();
  }, [search]);

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
      await search();
    } catch {
      setError('Reverse failed');
    } finally {
      setReversing(false);
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
        />
        <input
          type="date"
          className="form-control form-control-sm mr-2 mb-1"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-sm mb-1" onClick={() => void search()} disabled={loading}>
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
              <td className="text-right">{formatBillMoney(symbol, row.amount_paid)}</td>
              <td>{row.cashier ?? '—'}</td>
              <td>#{row.queue_number}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="border rounded p-3 mt-2">
          <h3 className="h6">Payment detail</h3>
          <p className="small mb-2">
            Receipt {selected.receipt_number} · Visit #{selected.queue_number} ·{' '}
            {formatBillMoney(symbol, selected.amount_paid)}
          </p>
          {selected.reversed_at ? (
            <p className="small text-muted mb-0">Reversed: {selected.reversal_reason}</p>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}
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
