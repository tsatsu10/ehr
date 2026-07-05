import type { RegistryRow, RegistrySearchStatus } from './registryTypes';
import { DataTable, DataTableStatusRow } from '@components/DataTable';
import { PaginationBar } from '@components/PaginationBar';
import { RowActionsMenu } from '@components/RowActionsMenu';

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

const COL_SPAN = 7;

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

  function renderBody() {
    if (status === 'loading') {
      return (
        <DataTableStatusRow colSpan={COL_SPAN}>
          <em>Searching…</em>
        </DataTableStatusRow>
      );
    }
    if (status === 'error' && errorMessage) {
      return (
        <DataTableStatusRow colSpan={COL_SPAN} tone="danger">
          {errorMessage}
        </DataTableStatusRow>
      );
    }
    if (status === 'idle') {
      return (
        <DataTableStatusRow colSpan={COL_SPAN}>
          <em>No search yet.</em>
        </DataTableStatusRow>
      );
    }
    if (!rows.length) {
      return (
        <DataTableStatusRow colSpan={COL_SPAN}>
          <em>No patients match these filters.</em>
        </DataTableStatusRow>
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
                  <span className="text-[var(--oe-nc-text-muted)]"> ({row.age_at_diagnosis}y)</span>
                )}
              </>
            ) : (
              '—'
            )}
          </td>
          <td>{row.completion_pct}%</td>
          <td className="text-right">
            <RowActionsMenu
              label={`Actions for ${row.name}`}
              items={[{ id: 'chart', label: 'Open chart', href: chartUrl }]}
            />
          </td>
        </tr>
      );
    });
  }

  return (
    <section className="col-span-12 lg:col-span-8">
      <div className="nc-registry-summary text-[var(--oe-nc-text-muted)] text-sm mb-2">{summaryText}</div>
      <DataTable
        id="nc-registry-table"
        hover
        header={(
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Sex</th>
            <th>MRN</th>
            <th
              className="nc-registry-col-condition"
              style={{ display: hasClinical ? undefined : 'none' }}
            >
              Condition
            </th>
            <th>Completion</th>
            <th aria-label="Actions" />
          </tr>
        )}
        footer={
          total > pageSize ? (
            <PaginationBar
              id="nc-registry-pagination"
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
            />
          ) : undefined
        }
      >
        {renderBody()}
      </DataTable>
    </section>
  );
}
