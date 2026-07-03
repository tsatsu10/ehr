import { useCallback, useEffect, useRef, useState } from 'react';
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
    <div className="oe-nc-billops-pane">
      <div className="form-inline mb-3 flex-wrap">
        <input
          type="date"
          className="form-control form-control-sm mr-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
        <a href={reportsUrl} className="btn btn-link btn-sm ml-2 mb-1" target="_top">
          Run reconciliation (Reports)
        </a>
        {data && (
          <>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm ml-1 mb-1"
              onClick={() => void exportCsv()}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm ml-1 mb-1" onClick={printDaysheet}>
              Print
            </button>
          </>
        )}
      </div>

      {error && <div className="alert alert-warning py-2">{error}</div>}

      {data && (
        <div ref={printRef} className="oe-nc-billops-daysheet-print">
          <div className="row mb-3">
            <div className="col-md-3 col-6 mb-2">
              <div className="small text-muted">Receipts</div>
              <div className="h5 mb-0">{data.receipt_count}</div>
            </div>
            <div className="col-md-3 col-6 mb-2">
              <div className="small text-muted">Voided</div>
              <div className="h5 mb-0">{data.void_count}</div>
            </div>
            <div className="col-md-3 col-6 mb-2">
              <div className="small text-muted">No-charge closes</div>
              <div className="h5 mb-0">{data.no_charge_closes}</div>
            </div>
            <div className="col-md-3 col-6 mb-2">
              <div className="small text-muted">Cash collected</div>
              <div className="h5 mb-0">{formatBillMoney(data.cash_collected)}</div>
            </div>
          </div>

          <div className="form-group mb-3" style={{ maxWidth: '16rem' }}>
            <label htmlFor="nc-billops-momo-tally" className="small text-muted mb-1">
              MoMo tally (label only, manual)
            </label>
            <input
              id="nc-billops-momo-tally"
              type="number"
              min={0}
              step="0.01"
              className="form-control form-control-sm"
              value={momoTally}
              onChange={(e) => handleMomoTallyChange(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <p className="mb-3">
            Reconciliation:{' '}
            <span className={reconOk ? 'text-success' : 'text-warning'}>
              {reconOk ? 'OK' : 'Warning'} (Δ {formatBillMoney(data.reconciliation.delta_amount)})
            </span>
            {data.reconciliation.latest_run?.completed_at && (
              <span className="text-muted small ml-2">
                last run {data.reconciliation.latest_run.completed_at}
              </span>
            )}
          </p>

          <div className="row">
            <div className="col-md-6">
              <h3 className="h6">By cashier</h3>
              <ul className="list-unstyled small">
                {data.by_cashier.map((row) => (
                  <li key={row.cashier}>
                    {row.cashier}: {formatBillMoney(row.total)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-md-6">
              <h3 className="h6">By visit type</h3>
              <ul className="list-unstyled small">
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
