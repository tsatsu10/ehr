import { useCallback, useEffect, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PaginationBar } from '@components/PaginationBar';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import type { BillOpsHubProps, OutstandingData, OutstandingRow } from './billOpsTypes';
import { formatBillMoney } from './billOpsFormatters';
import { ncShadcnTableClass } from '@components/ncTableStyles';
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
    <Card className="nc-billops-pane">
      <CardHeader className="py-3">
        <CardTitle className="text-base">Outstanding balances</CardTitle>
      </CardHeader>
      <CardContent>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <NativeSelect
          className="h-8 w-auto mr-2"
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
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && <div className={deskCalloutClass('warn', 'py-2')}>{error}</div>}

      {data && (
        <>
          <p className="mb-2">
            {totalCount} patients · Total owed {formatBillMoney(data.total_owed)}
          </p>
          <Table className={ncShadcnTableClass({ hover: true })}>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Patient</TableHead>
                <TableHead scope="col">Phone</TableHead>
                <TableHead scope="col" className="text-right">Owed</TableHead>
                <TableHead scope="col">Since</TableHead>
                <TableHead scope="col" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row: OutstandingRow) => (
                <TableRow key={row.visit_id}>
                  <TableCell>
                    {row.patient_name}
                    <span className="text-[var(--oe-nc-text-muted)] text-sm block">{row.pubpid}</span>
                  </TableCell>
                  <TableCell>{row.phone ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatBillMoney(row.owed)}</TableCell>
                  <TableCell>{row.visit_date}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`${moduleUrl}/patient-chart.php?pid=${row.pid}`}
                        target="_top"
                      >
                        Chart
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
