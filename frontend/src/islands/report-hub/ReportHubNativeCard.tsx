import { useMemo, useState } from 'react';
import { PaginationBar } from '@components/PaginationBar';
import { DataTable, DataTableStatusRow } from '@components/DataTable';
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
    <article className="oe-nc-reporthub-card oe-nc-reporthub-card--native" role="listitem">
      <div className="oe-nc-reporthub-card__head">
        <h3 className="oe-nc-reporthub-card__title h6 mb-0">{card.title}</h3>
        <span className="badge badge-primary oe-nc-reporthub-card__badge">Built-in</span>
      </div>
      <p className="oe-nc-reporthub-card__blurb small text-muted mb-3">{card.blurb}</p>

      <div className="oe-nc-reporthub-native-filters">
        <div className="oe-nc-reporthub-native-filters__presets">
          <span className="oe-nc-reporthub-native-filters__label">Quick range</span>
          <div className="btn-group btn-group-sm" role="group" aria-label="Date presets">
            <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('today')}>
              Today
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('this_week')}>
              This week
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => applyPreset('this_month')}>
              This month
            </button>
          </div>
        </div>

        <div className="oe-nc-reporthub-native-filters__dates">
          <div className="form-group mb-0">
            <label className="oe-nc-reporthub-native-filters__label" htmlFor={`nc-reporthub-from-${card.id}`}>
              From
            </label>
            <input
              id={`nc-reporthub-from-${card.id}`}
              type="date"
              className="form-control form-control-sm"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="form-group mb-0">
            <label className="oe-nc-reporthub-native-filters__label" htmlFor={`nc-reporthub-to-${card.id}`}>
              To
            </label>
            <input
              id={`nc-reporthub-to-${card.id}`}
              type="date"
              className="form-control form-control-sm"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="oe-nc-reporthub-native-filters__actions">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              disabled={loading || exporting}
              onClick={() => void runPreview(1)}
            >
              {loading ? 'Running…' : 'Run report'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={loading || exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger py-2 px-3 mb-2 oe-nc-reporthub-alert" role="alert">{error}</div>
      ) : null}

      {total !== null ? (
        <p className="oe-nc-reporthub-native-meta small text-muted mb-2">
          {total === 0
            ? 'No rows match this date range.'
            : `Showing ${rows.length} of ${total} row${total === 1 ? '' : 's'}.`}
        </p>
      ) : null}

      {columns.length > 0 ? (
        <div className="oe-nc-reporthub-native-results">
          <DataTable
            compact
            hover
            header={(
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">{column}</th>
                ))}
              </tr>
            )}
          >
            {rows.length === 0 ? (
              <DataTableStatusRow colSpan={columns.length}>No rows in preview.</DataTableStatusRow>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={`${card.id}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${card.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </DataTable>
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
