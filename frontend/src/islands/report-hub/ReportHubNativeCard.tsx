import { useMemo, useState } from 'react';
import { PaginationBar } from '@components/PaginationBar';
import { MatrixDataTable } from '@components/DataTable';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { SegmentedControl } from '@components/SegmentedControl';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import type { ReportHubCard } from './reportHubTypes';
import { reportDateRangeForPreset, type ReportDatePreset } from './reportHubDatePresets';
import {
  defaultReportDateRange,
  exportHubReportCsv,
  HUB_REPORT_PAGE_SIZE,
  runHubReportPreview,
} from './reportHubExport';

interface ReportHubNativeCardProps {
  card: ReportHubCard;
  ajaxUrl: string;
  csrfToken: string;
}

export function ReportHubNativeCard({
  card,
  ajaxUrl,
  csrfToken,
}: ReportHubNativeCardProps) {
  const defaults = useMemo(() => defaultReportDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const applyPreset = (preset: ReportDatePreset) => {
    const range = reportDateRangeForPreset(preset);
    setDateFrom(range.from);
    setDateTo(range.to);
    setPage(1);
  };

  const runPreview = async (pageNum = page) => {
    setLoading(true);
    setError(null);
    try {
      const data = await runHubReportPreview(ajaxUrl, csrfToken, {
        reportKey: card.id,
        dateFrom,
        dateTo,
        offset: (pageNum - 1) * HUB_REPORT_PAGE_SIZE,
        limit: HUB_REPORT_PAGE_SIZE,
      });
      setColumns(data.columns);
      setRows(data.rows);
      setTotal(data.total);
      setPage(pageNum);
    } catch (err) {
      setColumns([]);
      setRows([]);
      setTotal(null);
      setError(err instanceof Error ? err.message : 'Could not run report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportHubReportCsv(ajaxUrl, csrfToken, {
        reportKey: card.id,
        dateFrom,
        dateTo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <article className="nc-reporthub-card nc-reporthub-card--native" role="listitem">
      <div className="nc-reporthub-card-head">
        <h3 className="nc-reporthub-card-title text-base font-semibold mb-0">{card.title}</h3>
        <Badge variant="default" className="nc-reporthub-card-badge">Built-in</Badge>
      </div>
      <p className="nc-reporthub-card-blurb text-sm text-[var(--oe-nc-text-muted)] mb-3">{card.blurb}</p>

      <div className="nc-reporthub-native-filters">
        <div className="nc-reporthub-native-filters-presets">
          <span className="nc-reporthub-native-filters-label">Quick range</span>
          <SegmentedControl
            segments={[
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This week' },
              { id: 'this_month', label: 'This month' },
            ]}
            value=""
            onChange={(id) => applyPreset(id as ReportDatePreset)}
            ariaLabel="Date presets"
          />
        </div>

        <div className="nc-reporthub-native-filters-dates">
          <div className="nc-form-group mb-0">
            <Label className="nc-reporthub-native-filters-label normal-case" htmlFor={`nc-reporthub-from-${card.id}`}>
              From
            </Label>
            <Input
              id={`nc-reporthub-from-${card.id}`}
              type="date"
              className="h-8"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="nc-form-group mb-0">
            <Label className="nc-reporthub-native-filters-label normal-case" htmlFor={`nc-reporthub-to-${card.id}`}>
              To
            </Label>
            <Input
              id={`nc-reporthub-to-${card.id}`}
              type="date"
              className="h-8"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="nc-reporthub-native-filters-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || exporting}
              onClick={() => void runPreview(1)}
            >
              {loading ? 'Running…' : 'Run report'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading || exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className={deskCalloutClass('error', 'py-2 px-3 mb-2 nc-reporthub-alert')} role="alert">{error}</div>
      ) : null}

      {total !== null ? (
        <p className="nc-reporthub-native-meta text-sm text-[var(--oe-nc-text-muted)] mb-2">
          {total === 0
            ? 'No rows match this date range.'
            : `Showing ${rows.length} of ${total} row${total === 1 ? '' : 's'}.`}
        </p>
      ) : null}

      {columns.length > 0 ? (
        <div className="nc-reporthub-native-results">
          <MatrixDataTable
            compact
            hover
            columns={columns}
            rows={rows}
            emptyMessage="No rows in preview."
          />
          {total !== null && total > HUB_REPORT_PAGE_SIZE ? (
            <PaginationBar
              page={page}
              pageSize={HUB_REPORT_PAGE_SIZE}
              total={total}
              onPageChange={(nextPage) => void runPreview(nextPage)}
              id={`nc-reporthub-pagination-${card.id}`}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
