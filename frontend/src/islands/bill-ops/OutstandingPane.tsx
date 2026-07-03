import { useCallback, useEffect, useState } from 'react';
import { PaginationBar } from '@components/PaginationBar';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { oeFetch } from '@core/oeFetch';
import type { BillOpsHubProps, OutstandingData, OutstandingRow } from './billOpsTypes';
import { formatBillMoney } from './billOpsFormatters';

const PAGE_SIZE = 25;

interface Props {
  fetchOptions: { ajaxUrl: string; csrfToken: string };
  moduleUrl: string;
}

export function OutstandingPane({ fetchOptions, moduleUrl }: Props) {
  const [bucket, setBucket] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OutstandingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (bucket !== 'all') body.bucket = bucket;
      const payload = await oeFetch<OutstandingData>('bill_ops.outstanding_list', {
        ...fetchOptions,
        json: body,
      });
      setData(payload);
    } catch {
      setError('Could not load outstanding list');
    } finally {
      setLoading(false);
    }
  }, [bucket, fetchOptions, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalCount = data?.total ?? 0;

  return (
    <Card className="oe-nc-billops-pane">
      <CardHeader className="py-3">
        <CardTitle className="text-base">Outstanding balances</CardTitle>
      </CardHeader>
      <CardContent>
      <div className="form-inline mb-3">
        <select
          className="form-control form-control-sm mr-2"
          value={bucket}
          onChange={(e) => {
            setBucket(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All ages</option>
          <option value="0_7">0–7 days</option>
          <option value="8_30">8–30 days</option>
          <option value="31_plus">31+ days</option>
        </select>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-warning py-2">{error}</div>}

      {data && (
        <>
          <p className="mb-2">
            {totalCount} patients · Total owed {formatBillMoney(data.total_owed)}
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
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={totalCount}
            onPageChange={setPage}
            id="nc-billops-outstanding-pagination"
          />
        </>
      )}
      </CardContent>
    </Card>
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
