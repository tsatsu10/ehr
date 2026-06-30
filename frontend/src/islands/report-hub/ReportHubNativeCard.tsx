import { useMemo, useState } from 'react';
import { DataTable, DataTableStatusRow } from '@components/DataTable';
import type { ReportHubCard } from './reportHubTypes';
import {
  defaultReportDateRange,
  exportHubReportCsv,
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
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runHubReportPreview(ajaxUrl, csrfToken, {
        reportKey: card.id,
        dateFrom,
        dateTo,
      });
      setColumns(data.columns);
      setRows(data.rows);
      setTotal(data.total);
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
      <h3 className="oe-nc-reporthub-card__title h6">{card.title}</h3>
      <p className="oe-nc-reporthub-card__blurb small text-muted mb-2">{card.blurb}</p>

      <div className="oe-nc-reporthub-native-filters form-inline flex-wrap mb-2">
        <label className="sr-only" htmlFor={`nc-reporthub-from-${card.id}`}>From date</label>
        <input
          id={`nc-reporthub-from-${card.id}`}
          type="date"
          className="form-control form-control-sm mr-2 mb-2"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <label className="sr-only" htmlFor={`nc-reporthub-to-${card.id}`}>To date</label>
        <input
          id={`nc-reporthub-to-${card.id}`}
          type="date"
          className="form-control form-control-sm mr-2 mb-2"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline-primary btn-sm mb-2 mr-2"
          disabled={loading || exporting}
          onClick={() => void runPreview()}
        >
          {loading ? 'Running…' : 'Run report'}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm mb-2"
          disabled={loading || exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {error ? (
        <div className="alert alert-danger py-2 px-3 mb-2" role="alert">{error}</div>
      ) : null}

      {total !== null ? (
        <p className="small text-muted mb-2">
          {total === 0
            ? 'No rows match this date range.'
            : `Showing ${rows.length} of ${total} row${total === 1 ? '' : 's'}.`}
        </p>
      ) : null}

      {columns.length > 0 ? (
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
      ) : null}
    </article>
  );
}
