import type { RegistryRow, RegistrySearchStatus } from './registryTypes';

interface RegistryResultsTableProps {
  rows: RegistryRow[];
  chartUrlBase: string;
  status: RegistrySearchStatus;
  errorMessage: string | null;
  summaryText: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function RegistryResultsTable({
  rows,
  chartUrlBase,
  status,
  errorMessage,
  summaryText,
  page,
  pageSize,
  total,
  onPageChange,
}: RegistryResultsTableProps) {
  const hasClinical = rows.some(
    (row) => row.condition_summary || row.index_diagnosis_date
  );

  const showPagination = total > pageSize;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function renderBody() {
    if (status === 'loading') {
      return (
        <tr>
          <td colSpan={7}>
            <em>Searching…</em>
          </td>
        </tr>
      );
    }
    if (status === 'error' && errorMessage) {
      return (
        <tr>
          <td colSpan={7} className="text-danger">
            {errorMessage}
          </td>
        </tr>
      );
    }
    if (status === 'idle') {
      return (
        <tr>
          <td colSpan={7} className="text-muted">
            <em>No search yet.</em>
          </td>
        </tr>
      );
    }
    if (!rows.length) {
      return (
        <tr>
          <td colSpan={7} className="text-muted">
            <em>No patients match these filters.</em>
          </td>
        </tr>
      );
    }
    return rows.map((row) => {
      const chartUrl = row.chart_url ?? `${chartUrlBase}?pid=${encodeURIComponent(String(row.pid))}`;
      return (
        <tr key={row.pid}>
          <td>{row.name}</td>
          <td>{row.age_today ?? '—'}</td>
          <td>{row.sex || '—'}</td>
          <td>{row.mrn || '—'}</td>
          <td>
            {hasClinical ? (
              <>
                {row.condition_summary || '—'}
                {row.age_at_diagnosis != null && (
                  <span className="text-muted"> ({row.age_at_diagnosis}y)</span>
                )}
              </>
            ) : (
              '—'
            )}
          </td>
          <td>{row.completion_pct}%</td>
          <td className="text-right">
            <a className="btn btn-link btn-sm p-0" href={chartUrl} target="_top">
              Open chart
            </a>
          </td>
        </tr>
      );
    });
  }

  return (
    <section className="col-lg-8">
      <div className="oe-nc-registry-summary text-muted small mb-2">{summaryText}</div>
      <div className="table-responsive">
        <table className="table table-sm table-hover" id="nc-registry-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Sex</th>
              <th>MRN</th>
              <th
                className="oe-nc-registry-col-condition"
                style={{ display: hasClinical ? undefined : 'none' }}
              >
                Condition
              </th>
              <th>Completion</th>
              <th />
            </tr>
          </thead>
          <tbody id="nc-registry-rows">{renderBody()}</tbody>
        </table>
      </div>
      {showPagination && (
        <div className="d-flex justify-content-between align-items-center" id="nc-registry-pagination">
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Prev
          </button>
          <span className="small text-muted">
            {from}–{to} of {total}
          </span>
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            disabled={to >= total}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
