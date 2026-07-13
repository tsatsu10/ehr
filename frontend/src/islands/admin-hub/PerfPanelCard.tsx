import { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { oeFetch } from '@core/oeFetch';
import { AdminSection } from './adminUi';

interface PerfActionRow {
  action: string;
  calls: number;
  errors: number;
  avg_ms: number;
  p95_ms: number;
  max_ms: number;
}

interface PerfSummary {
  day: string;
  totals: { calls: number; errors: number };
  slowest: PerfActionRow[];
  errors: PerfActionRow[];
}

interface PerfPanelCardProps {
  ajaxUrl: string;
  csrfToken: string;
}

type DayChoice = 'yesterday' | 'today';

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${ms} ms`;
}

/**
 * SCALE-4.5 — read-only performance panel for the System tab: yesterday's (or
 * today's) slowest requests and error counts from the daily perf counters.
 * This is how an operator sees trouble building before users report it.
 */
export function PerfPanelCard({ ajaxUrl, csrfToken }: PerfPanelCardProps) {
  const [dayChoice, setDayChoice] = useState<DayChoice>('yesterday');
  const [data, setData] = useState<PerfSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Day tokens resolve on the server clock — a workstation with a wrong
      // timezone/date still sees the day the counters actually wrote.
      const result = await oeFetch<PerfSummary>('admin.perf.summary', {
        ajaxUrl,
        csrfToken,
        params: { day: dayChoice },
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load performance data.');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, dayChoice]);

  useEffect(() => { void load(); }, [load]);

  const slowest = data?.slowest ?? [];
  const erroring = data?.errors ?? [];
  const totalCalls = data?.totals?.calls ?? 0;
  const totalErrors = data?.totals?.errors ?? 0;

  return (
    <AdminSection
      title="Performance"
      description="Slowest requests and error counts, one row per action per day. Data is kept for 90 days."
      icon={<Gauge className="h-4 w-4" aria-hidden />}
      action={
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border-[1px] border-[var(--oe-nc-border)] p-0.5" role="group" aria-label="Day">
            <Button
              type="button"
              variant={dayChoice === 'yesterday' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDayChoice('yesterday')}
            >
              Yesterday
            </Button>
            <Button
              type="button"
              variant={dayChoice === 'today' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDayChoice('today')}
            >
              Today
            </Button>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => { void load(); }}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
      }
    >
      {error && (
        <div className={deskCalloutClass('error', 'mb-3 text-sm')} role="alert">{error}</div>
      )}

      {!error && (
        <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
          {totalCalls} request{totalCalls === 1 ? '' : 's'} · {totalErrors} error
          {totalErrors === 1 ? '' : 's'}
          {data?.day ? ` · ${data.day}` : ''}
        </p>
      )}

      {!error && slowest.length === 0 && !loading && (
        <p className="text-sm text-[var(--oe-nc-text-muted)]">
          Nothing recorded for this day yet. Counters build up as staff use the system.
        </p>
      )}

      {slowest.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
            Slowest actions (by p95)
          </p>
          <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead className="text-end">Calls</TableHead>
                <TableHead className="text-end">Average</TableHead>
                <TableHead className="text-end">p95</TableHead>
                <TableHead className="text-end">Slowest</TableHead>
                <TableHead className="text-end">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slowest.map((row) => (
                <TableRow key={row.action}>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="text-end text-sm">{row.calls}</TableCell>
                  <TableCell className="text-end text-sm">{fmtMs(row.avg_ms)}</TableCell>
                  <TableCell className="text-end text-sm font-medium">{fmtMs(row.p95_ms)}</TableCell>
                  <TableCell className="text-end text-sm">{fmtMs(row.max_ms)}</TableCell>
                  <TableCell className="text-end">
                    {row.errors > 0 ? <Badge variant="danger">{row.errors}</Badge> : <span className="text-sm text-[var(--oe-nc-text-muted)]">0</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {erroring.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
            Actions with errors
          </p>
          <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead className="text-end">Errors</TableHead>
                <TableHead className="text-end">Calls</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {erroring.map((row) => (
                <TableRow key={row.action}>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="text-end"><Badge variant="danger">{row.errors}</Badge></TableCell>
                  <TableCell className="text-end text-sm">{row.calls}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminSection>
  );
}
