import { useCallback, useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { SlideOver } from '@components/SlideOver';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
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

interface AuditRow {
  id: number;
  date: string;
  event: string;
  category: string;
  user: string;
  patient_id: number;
  success: boolean;
  comments: string;
}

interface AuditQueryResult {
  rows: AuditRow[];
  total: number;
  page: number;
  page_size: number;
}

interface AuditDetail extends AuditRow {
  user_notes: string;
}

interface AuditExportResult {
  filename: string;
  content: string;
  row_count: number;
}

interface AuditLogCardProps {
  ajaxUrl: string;
  csrfToken: string;
}

// A type alias (not interface) so it carries an implicit index signature and is
// assignable to oeFetch's `params: Record<string, string | number | …>`.
type Filters = {
  date_from: string;
  date_to: string;
  user: string;
  q: string;
  success: string;
};

const EMPTY_FILTERS: Filters = { date_from: '', date_to: '', user: '', q: '', success: '' };

export function AuditLogCard({ ajaxUrl, csrfToken }: AuditLogCardProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await oeFetch<AuditQueryResult>('admin.audit.query', {
        ajaxUrl,
        csrfToken,
        params: { ...applied, page },
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, csrfToken, applied, page]);

  useEffect(() => { void load(); }, [load]);

  const runSearch = () => { setApplied(filters); setPage(1); };
  const resetSearch = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); };

  const openDetail = async (id: number) => {
    try {
      const d = await oeFetch<AuditDetail>('admin.audit.detail', { ajaxUrl, csrfToken, params: { id } });
      setDetail(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the entry.');
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const result = await oeFetch<AuditExportResult>('admin.audit.export', {
        ajaxUrl,
        csrfToken,
        params: applied,
      });
      const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export.');
    } finally {
      setExporting(false);
    }
  };

  const total = data?.total ?? 0;
  const pageSize = data?.page_size ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminSection
      title="Audit log"
      description="Read-only incident review over the system log."
      icon={<ScrollText className="h-4 w-4" aria-hidden />}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="nc-audit-from" className="text-xs">From</Label>
            <Input id="nc-audit-from" type="date" className="w-auto" value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nc-audit-to" className="text-xs">To</Label>
            <Input id="nc-audit-to" type="date" className="w-auto" value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nc-audit-user" className="text-xs">User</Label>
            <Input id="nc-audit-user" className="w-auto" value={filters.user} placeholder="username"
              onChange={(e) => setFilters((f) => ({ ...f, user: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nc-audit-q" className="text-xs">Search</Label>
            <Input id="nc-audit-q" className="w-auto" value={filters.q} placeholder="event / comments"
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nc-audit-success" className="text-xs">Result</Label>
            <NativeSelect id="nc-audit-success" className="w-auto" value={filters.success}
              onChange={(e) => setFilters((f) => ({ ...f, success: e.target.value }))}>
              <option value="">All</option>
              <option value="1">Success</option>
              <option value="0">Failure</option>
            </NativeSelect>
          </div>
          <Button type="button" size="sm" onClick={runSearch}>Search</Button>
          <Button type="button" size="sm" variant="secondary" onClick={resetSearch}>Reset</Button>
          <Button type="button" size="sm" variant="outline" disabled={exporting || total === 0}
            onClick={() => { void exportCsv(); }}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>

        {error && <div className={deskCalloutClass('error', 'text-sm')}>{error}</div>}

        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Result</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (data?.rows?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-[var(--oe-nc-text-muted)] text-sm">Loading…</TableCell></TableRow>
              ) : (data?.rows?.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-[var(--oe-nc-text-muted)] text-sm">No log entries match.</TableCell></TableRow>
              ) : (
                (data?.rows ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)] text-nowrap">{r.date}</TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium">{r.event || '—'}</span>
                      {r.category ? <span className="text-[var(--oe-nc-text-muted)]"> · {r.category}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">{r.user || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={r.success ? 'success' : 'danger'}>{r.success ? 'OK' : 'Fail'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="link" size="sm" className="h-auto p-0"
                        onClick={() => { void openDetail(r.id); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--oe-nc-text-muted)]">{total} entries · page {data?.page ?? 1} of {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={(data?.page ?? 1) <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button type="button" variant="outline" size="sm" disabled={(data?.page ?? 1) >= totalPages}
                onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <SlideOver
        open={detail !== null}
        onClose={() => setDetail(null)}
        id="nc-audit-detail"
        title="Audit entry"
        width="md"
      >
        {detail && (
          <dl className="text-sm space-y-2">
            <div><dt className="text-[var(--oe-nc-text-muted)]">When</dt><dd>{detail.date}</dd></div>
            <div><dt className="text-[var(--oe-nc-text-muted)]">Event</dt><dd>{detail.event || '—'}{detail.category ? ` · ${detail.category}` : ''}</dd></div>
            <div><dt className="text-[var(--oe-nc-text-muted)]">User</dt><dd>{detail.user || '—'}</dd></div>
            <div><dt className="text-[var(--oe-nc-text-muted)]">Patient ID</dt><dd>{detail.patient_id > 0 ? detail.patient_id : '—'}</dd></div>
            <div><dt className="text-[var(--oe-nc-text-muted)]">Result</dt><dd>{detail.success ? 'Success' : 'Failure'}</dd></div>
            <div>
              <dt className="text-[var(--oe-nc-text-muted)]">Comments</dt>
              <dd className="whitespace-pre-wrap break-words">{detail.comments || '—'}</dd>
            </div>
            {detail.user_notes ? (
              <div>
                <dt className="text-[var(--oe-nc-text-muted)]">Notes</dt>
                <dd className="whitespace-pre-wrap break-words">{detail.user_notes}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </SlideOver>
    </AdminSection>
  );
}
