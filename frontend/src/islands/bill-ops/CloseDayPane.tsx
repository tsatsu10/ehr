import { useCallback, useEffect, useRef, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { oeFetch } from '@core/oeFetch';
import type { BillOpsHubProps, DaysheetData } from './billOpsTypes';
import { daysheetToCsv, downloadCsv } from './billOpsDaysheetExport';
import { formatBillMoney, localDateString } from './billOpsFormatters';
import { readMomoTally, writeMomoTally } from './billOpsMomoTally';

interface Props {
  fetchOptions: { ajaxUrl: string; csrfToken: string };
  facilityId: number;
  reportsUrl: string;
}

export function CloseDayPane({ fetchOptions, facilityId, reportsUrl }: Props) {
  const [date, setDate] = useState(localDateString());
  const [data, setData] = useState<DaysheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [momoTally, setMomoTally] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { date };
      if (facilityId > 0) body.facility_id = facilityId;
      const payload = await oeFetch<DaysheetData>('bill_ops.daysheet', {
        ...fetchOptions,
        json: body,
      });
      setData(payload);
    } catch {
      setError('Could not load daysheet');
    } finally {
      setLoading(false);
    }
  }, [date, facilityId, fetchOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.date) return;
    setMomoTally(readMomoTally(facilityId, data.date));
  }, [data?.date, facilityId]);

  const handleMomoTallyChange = (value: string) => {
    setMomoTally(value);
    if (data?.date) {
      writeMomoTally(facilityId, data.date, value);
    }
  };

  const reconOk = data?.reconciliation.status === 'ok';

  const exportCsv = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const body: Record<string, unknown> = { date: data.date };
      if (facilityId > 0) body.facility_id = facilityId;
      await oeFetch('bill_ops.daysheet_export', {
        ...fetchOptions,
        method: 'POST',
        json: body,
      });
      downloadCsv(`daysheet-${data.date}.csv`, daysheetToCsv(data, momoTally));
    } catch {
      setError('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const printDaysheet = () => {
    window.print();
  };

  return (
    <div className="nc-billops-pane">
      <div className="flex flex-wrap items-center gap-2 mb-3 flex-wrap">
        <Input
          type="date"
          className="h-8 w-auto mr-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <Button variant="link" size="sm" className="ml-2 mb-1 h-auto p-0" asChild>
          <a href={reportsUrl} target="_top">
            Run reconciliation (Reports)
          </a>
        </Button>
        {data && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 mb-1"
              onClick={() => void exportCsv()}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="ml-1 mb-1" onClick={printDaysheet}>
              Print
            </Button>
          </>
        )}
      </div>

      {error && <div className={deskCalloutClass('warn', 'py-2')}>{error}</div>}

      {data && (
        <div ref={printRef} className="nc-billops-daysheet-print">
          <div className="grid grid-cols-12 gap-3 mb-3">
            <div className="col-span-6 md:col-span-3 mb-2">
              <div className="text-sm text-[var(--oe-nc-text-muted)]">Receipts</div>
              <div className="text-lg font-semibold mb-0">{data.receipt_count}</div>
            </div>
            <div className="col-span-6 md:col-span-3 mb-2">
              <div className="text-sm text-[var(--oe-nc-text-muted)]">Voided</div>
              <div className="text-lg font-semibold mb-0">{data.void_count}</div>
            </div>
            <div className="col-span-6 md:col-span-3 mb-2">
              <div className="text-sm text-[var(--oe-nc-text-muted)]">No-charge closes</div>
              <div className="text-lg font-semibold mb-0">{data.no_charge_closes}</div>
            </div>
            <div className="col-span-6 md:col-span-3 mb-2">
              <div className="text-sm text-[var(--oe-nc-text-muted)]">Cash collected</div>
              <div className="text-lg font-semibold mb-0">{formatBillMoney(data.cash_collected)}</div>
            </div>
          </div>

          <div className="space-y-1.5 mb-3" style={{ maxWidth: '16rem' }}>
            <Label htmlFor="nc-billops-momo-tally" className="normal-case font-normal text-[var(--oe-nc-text-muted)]">
              MoMo tally (label only, manual)
            </Label>
            <Input
              id="nc-billops-momo-tally"
              type="number"
              className="h-8"
              min={0}
              step="0.01"
              value={momoTally}
              onChange={(e) => handleMomoTallyChange(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <p className="mb-3">
            Reconciliation:{' '}
            <span className={reconOk ? 'text-green-600' : 'text-[var(--color-oe-warning,#ea580c)]'}>
              {reconOk ? 'OK' : 'Warning'} (Δ {formatBillMoney(data.reconciliation.delta_amount)})
            </span>
            {data.reconciliation.latest_run?.completed_at && (
              <span className="text-[var(--oe-nc-text-muted)] text-sm ml-2">
                last run {data.reconciliation.latest_run.completed_at}
              </span>
            )}
          </p>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-6">
              <h3 className="text-sm font-semibold">By cashier</h3>
              <ul className="list-none m-0 p-0 text-sm">
                {data.by_cashier.map((row) => (
                  <li key={row.cashier}>
                    {row.cashier}: {formatBillMoney(row.total)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-12 md:col-span-6">
              <h3 className="text-sm font-semibold">By visit type</h3>
              <ul className="list-none m-0 p-0 text-sm">
                {data.by_visit_type.map((row) => (
                  <li key={row.visit_type_label}>
                    {row.visit_type_label}: {formatBillMoney(row.total)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CloseDayPaneWrapper(props: BillOpsHubProps) {
  return (
    <CloseDayPane
      fetchOptions={{ ajaxUrl: props.ajaxUrl, csrfToken: props.csrfToken }}
      facilityId={props.facilityId}
      reportsUrl={props.reportsUrl}
    />
  );
}
