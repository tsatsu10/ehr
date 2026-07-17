import { useCallback, useEffect, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PaginationBar } from '@components/PaginationBar';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { oeFetch } from '@core/oeFetch';
import { ReprintReceiptModal } from '@islands/chart-depth/ReprintReceiptModal';
import type { ReceiptReprintPayload } from '@islands/chart-depth/chartDepthTypes';
import type { BillOpsHubProps, PaymentRow, PaymentsSearchData } from './billOpsTypes';
import { formatBillMoney, localDateString } from './billOpsFormatters';
import { ncShadcnTableClass, ncTableSelectedRowClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

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
    <div className="nc-billops-pane">
      <div className="flex flex-wrap items-center gap-2 mb-3 flex-wrap">
        <Input
          type="search"
          className="h-8 w-auto mr-2 mb-1"
          placeholder="Receipt # / MRN / name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch();
          }}
        />
        <Input
          type="date"
          className="h-8 w-auto mr-2 mb-1"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          className="mb-1"
          onClick={runSearch}
          disabled={loading}
        >
          Search
        </Button>
      </div>

      {error && <div className={deskCalloutClass('warn', 'py-2')}>{error}</div>}

      <Table className={ncShadcnTableClass({ hover: true })}>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Receipt</TableHead>
            <TableHead scope="col">Patient</TableHead>
            <TableHead scope="col" className="text-right">Amount</TableHead>
            <TableHead scope="col">Cashier</TableHead>
            <TableHead scope="col">Visit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={selected?.id === row.id ? ncTableSelectedRowClass : undefined}
              onClick={() => setSelected(row)}
              style={{ cursor: 'pointer' }}
            >
              <TableCell>
                {row.receipt_number}
                {row.reversed_at && <Badge variant="neutral" className="ml-1">Reversed</Badge>}
              </TableCell>
              <TableCell>{row.patient_name}</TableCell>
              <TableCell className="text-right">{formatBillMoney(row.amount_paid)}</TableCell>
              <TableCell>{row.cashier ?? '—'}</TableCell>
              <TableCell>{row.is_deposit ? 'Deposit' : `#${row.queue_number}`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        id="nc-billops-payments-pagination"
      />

      {selected && (
        <div className="border rounded p-3 mt-2">
          <h3 className="text-sm font-semibold">Payment detail</h3>
          <p className="text-sm mb-2">
            Receipt {selected.receipt_number} · {selected.is_deposit ? 'Deposit' : `Visit #${selected.queue_number}`} ·{' '}
            {formatBillMoney(selected.amount_paid)}
            {selected.posted_payment_id ? (
              <span className="text-[var(--oe-nc-text-muted)]"> · Posted #{selected.posted_payment_id}</span>
            ) : null}
          </p>
          {selected.reversed_at ? (
            <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">Reversed: {selected.reversal_reason}</p>
          ) : (
            <div className="flex flex-wrap items-start">
              <div className="mr-3 mb-2">
                <div className="space-y-1.5 mb-2">
                  <Label htmlFor="nc-billops-reverse-reason">Reverse reason</Label>
                  <Input
                    id="nc-billops-reverse-reason"
                    type="text"
                    className="h-8"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => void reversePayment()}
                  disabled={reversing}
                >
                  {reversing ? 'Reversing…' : 'Reverse payment'}
                </Button>
              </div>
              {selected.can_reprint && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-2"
                  onClick={() => void reprintReceipt()}
                  disabled={reprintSubmitting}
                >
                  {reprintSubmitting ? 'Loading…' : 'Reprint receipt'}
                </Button>
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
