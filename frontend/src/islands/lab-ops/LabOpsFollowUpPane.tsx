import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import type { FollowUpData, FollowUpRow } from './labOpsTypes';

interface LabOpsFollowUpPaneProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId?: number | string;
}

const LEFT = { textAlign: 'left' as const };
const RIGHT = { textAlign: 'right' as const };

function ddmmyyyy(iso: string): string {
  const [y, m, d] = (iso || '').split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function ageBadge(bucket: string, days: number) {
  const variant = bucket === '8_plus' ? 'danger' : bucket === '3_7' ? 'warning' : 'neutral';
  return <Badge variant={variant}>{days}d</Badge>;
}

function FollowUpTable({ rows, emptyLabel, dateLabel }: {
  rows: FollowUpRow[];
  emptyLabel: string;
  dateLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)]">{emptyLabel}</p>;
  }
  return (
    <div className="nc-labops-followup-table-wrap" style={{ overflowX: 'auto' }}>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th style={LEFT}>Patient</th>
            <th style={LEFT}>{dateLabel}</th>
            <th style={LEFT}>Tests</th>
            <th style={RIGHT}>Waiting</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.order_id}-${row.pid}`}>
              <td style={LEFT}>
                <a href={row.chart_url} target="_top" className="text-[var(--oe-nc-primary)] hover:underline">
                  {row.patient_name}
                </a>
                {row.pubpid && (
                  <span className="text-[var(--oe-nc-text-muted)]"> · {row.pubpid}</span>
                )}
              </td>
              <td style={LEFT} className="tabular-nums">{ddmmyyyy(row.date)}</td>
              <td style={LEFT}>{row.detail || '—'}</td>
              <td style={RIGHT}>{ageBadge(row.age_bucket, row.age_days)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * CP-4 — Lab Ops Follow-up tab: the two oversight lists that used to live on
 * the stock pending-orders / pending-followup reports.
 */
export function LabOpsFollowUpPane({ ajaxUrl, csrfToken, facilityId }: LabOpsFollowUpPaneProps) {
  const [windowDays, setWindowDays] = useState('14');
  const [data, setData] = useState<FollowUpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<FollowUpData>('lab_ops.followup', {
        ajaxUrl,
        csrfToken,
        params: {
          facility_id: facilityId ? Number(facilityId) : 0,
          window_days: Number(windowDays),
        },
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load follow-up lists.');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="nc-labops-followup space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="nc-labops-followup-window" className="text-sm text-[var(--oe-nc-text-muted)]">
            Looking back
          </Label>
          <NativeSelect
            id="nc-labops-followup-window"
            className="h-8 w-auto"
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </NativeSelect>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            void load();
          }}
        >
          Refresh
        </Button>
      </div>

      {error && <div className={deskCalloutClass('error', 'py-2 text-sm')}>{error}</div>}
      {loading && !data && <p className="text-sm text-[var(--oe-nc-text-muted)]">Loading follow-up lists…</p>}

      {data && (
        <>
          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Ordered, no result yet ({data.unresulted.length}
              {data.unresulted.length >= data.row_cap ? '+' : ''})
            </h3>
            <FollowUpTable
              rows={data.unresulted}
              emptyLabel="Every order in this window has a result."
              dateLabel="Ordered"
            />
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">
              Abnormal result, patient not back since ({data.abnormal_no_followup.length}
              {data.abnormal_no_followup.length >= data.row_cap ? '+' : ''})
            </h3>
            <FollowUpTable
              rows={data.abnormal_no_followup}
              emptyLabel="No abnormal results are waiting on a return visit."
              dateLabel="Reported"
            />
          </section>
        </>
      )}
    </div>
  );
}
