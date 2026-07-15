import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Input } from '@components/ui/input';
import type { PharmPrescriptionRow, PharmPrescriptionsReport } from './pharmOpsTypes';

interface PharmOpsPrescriptionsReportProps {
  ajaxUrl: string;
  csrfToken: string;
}

// Inline alignment: the BS4-colliding alignment utilities are pinned by the
// bs:check ratchet, so we set textAlign via style instead of class names.
const RIGHT = { textAlign: 'right' as const };
const LEFT = { textAlign: 'left' as const };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ddmmyyyy(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function statusVariant(status: PharmPrescriptionRow['status']): 'success' | 'warning' | 'danger' {
  if (status === 'dispensed') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
}

export function PharmOpsPrescriptionsReport({ ajaxUrl, csrfToken }: PharmOpsPrescriptionsReportProps) {
  const [from, setFrom] = useState<string>(() => isoDaysAgo(90));
  const [to, setTo] = useState<string>(() => todayIso());
  const [data, setData] = useState<PharmPrescriptionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await oeFetch<PharmPrescriptionsReport>('pharm_ops.inventory.prescriptions', {
        ...fetchOptions,
        params: { from, to },
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescriptions report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];

  return (
    <div className="nc-pharmops-prescriptions">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-rx-from">From</label>
          <Input id="nc-rx-from" type="date" className="h-8 w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-(--oe-nc-text-muted)" htmlFor="nc-rx-to">To</label>
          <Input id="nc-rx-to" type="date" className="h-8 w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="nc-pharmops-empty nc-pharmops-empty--loading">Loading prescriptions…</div>
      ) : error ? (
        <div className={deskCalloutClass('warn')} role="alert">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="nc-pharmops-empty-card">
          <div className="nc-pharmops-empty-card-title">No prescriptions</div>
          <div className="nc-pharmops-empty-card-body">
            No prescriptions were written in the selected date range.
          </div>
        </div>
      ) : (
        <div className="nc-pharmops-report-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="nc-pharmops-report-table w-full">
            <thead>
              <tr>
                <th style={LEFT}>Date</th>
                <th style={LEFT}>Patient</th>
                <th style={LEFT}>Drug</th>
                <th style={RIGHT}>Prescribed</th>
                <th style={RIGHT}>Dispensed</th>
                <th style={LEFT}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.prescription_id}>
                  <td style={LEFT} className="tabular-nums">{ddmmyyyy(row.date)}</td>
                  <td style={LEFT}>
                    {row.patient_name || '—'}
                    {row.pubpid ? <span className="text-(--oe-nc-text-muted)"> · {row.pubpid}</span> : null}
                  </td>
                  <td style={LEFT}>{row.drug_name}</td>
                  <td style={RIGHT} className="tabular-nums">{row.prescribed_qty}</td>
                  <td style={RIGHT} className="tabular-nums">{row.dispensed_qty}</td>
                  <td style={LEFT}>
                    <Badge variant={statusVariant(row.status)}>{row.status_label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
