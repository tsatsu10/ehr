import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { BillOpsHubProps, OutstandingData, OutstandingRow } from './billOpsTypes';
import { formatBillMoney } from './billOpsFormatters';

interface Props {
  fetchOptions: { ajaxUrl: string; csrfToken: string };
  moduleUrl: string;
}

export function OutstandingPane({ fetchOptions, moduleUrl }: Props) {
  const [bucket, setBucket] = useState('all');
  const [data, setData] = useState<OutstandingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (bucket !== 'all') body.bucket = bucket;
      const payload = await oeFetch<OutstandingData>('bill_ops.outstanding_list', {
        ...fetchOptions,
        json: body,
      });
      setData(payload);
    } catch {
      setError('Could not load outstanding list');
    }
  }, [bucket, fetchOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="oe-nc-billops-pane">
      <div className="form-inline mb-3">
        <select
          className="form-control form-control-sm mr-2"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
        >
          <option value="all">All ages</option>
          <option value="0_7">0–7 days</option>
          <option value="8_30">8–30 days</option>
          <option value="31_plus">31+ days</option>
        </select>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-warning py-2">{error}</div>}

      {data && (
        <>
          <p className="mb-2">
            {data.rows.length} patients · Total owed {formatBillMoney(data.total_owed)}
          </p>
          <table className="table table-sm table-hover">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Phone</th>
                <th scope="col" className="text-right">Owed</th>
                <th scope="col">Since</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: OutstandingRow) => (
                <tr key={row.visit_id}>
                  <td>
                    {row.patient_name}
                    <span className="text-muted small d-block">{row.pubpid}</span>
                  </td>
                  <td>{row.phone ?? '—'}</td>
                  <td className="text-right">{formatBillMoney(row.owed)}</td>
                  <td>{row.visit_date}</td>
                  <td>
                    <a
                      href={`${moduleUrl}/patient-chart.php?pid=${row.pid}`}
                      className="btn btn-outline-primary btn-sm"
                      target="_top"
                    >
                      Chart
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function OutstandingPaneWrapper(props: BillOpsHubProps) {
  return (
    <OutstandingPane
      fetchOptions={{ ajaxUrl: props.ajaxUrl, csrfToken: props.csrfToken }}
      moduleUrl={props.moduleUrl}
    />
  );
}
