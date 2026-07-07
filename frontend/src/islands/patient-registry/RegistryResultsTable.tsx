import type { RegistryRow, RegistrySearchStatus } from './registryTypes';
import { formatRegistryDate } from './registryFormat';
import { buildRegistryRowActions, type RegistryRowActionContext } from './registryRowActions';
import { DataTable, DataTableStatusRow } from '@components/DataTable';
import { PaginationBar } from '@components/PaginationBar';
import { RowActionsMenu } from '@components/RowActionsMenu';
import { Badge } from '@components/ui/badge';
import { CompletionScorePill } from '@components/CompletionScorePill';

interface RegistryResultsTableProps {
  rows: RegistryRow[];
  chartUrlBase: string;
  rowActionContext: RegistryRowActionContext;
  status: RegistrySearchStatus;
  errorMessage: string | null;
  page: number;
  pageSize: number;
  total: number;
  billingThreshold?: number;
  onPageChange: (page: number) => void;
}

const COL_SPAN = 11;

export function RegistryResultsTable({
  rows,
  chartUrlBase,
  rowActionContext,
  status,
  errorMessage,
  page,
  pageSize,
  total,
  billingThreshold = 70,
  onPageChange,
}: RegistryResultsTableProps) {
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
          <em>No search yet — set criteria above and click Apply.</em>
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
      const ageLabel = row.age_today != null
        ? `${row.age_today}${row.dob_estimated ? '*' : ''}`
        : '—';
      const actionContext = { ...rowActionContext, chartUrlBase };
      const rowActions = buildRegistryRowActions({ ...row, chart_url: chartUrl }, actionContext);

      return (
        <tr key={row.pid}>
          <td className="nc-registry-col-name">
            <span className="nc-registry-col-name__text">{row.name}</span>
          </td>
          <td className="nc-registry-col-age">{ageLabel}</td>
          <td>{row.sex || '—'}</td>
          <td className="nc-registry-col-mrn">{row.mrn || '—'}</td>
          <td className="nc-registry-col-phone">{row.phone_masked || '—'}</td>
          <td className="nc-registry-col-condition">{row.condition_summary || '—'}</td>
          <td className="nc-registry-col-dx-date">
            {formatRegistryDate(row.index_diagnosis_date)}
          </td>
          <td className="nc-registry-col-profile">
            <CompletionScorePill
              score={row.completion_pct}
              threshold={billingThreshold}
            />
          </td>
          <td className="nc-registry-col-last-visit">
            {formatRegistryDate(row.last_visit_date)}
          </td>
          <td className="nc-registry-col-in-clinic">
            {row.has_active_visit_today ? (
              <Badge variant="info">In clinic</Badge>
            ) : (
              '—'
            )}
          </td>
          <td className="text-right nc-registry-col-actions">
            <RowActionsMenu
              label={`Actions for ${row.name}`}
              items={rowActions}
            />
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="nc-registry-table-wrap">
      <DataTable
        id="nc-registry-table"
        hover
      header={(
        <tr>
          <th>Name</th>
          <th>Age</th>
          <th>Sex</th>
          <th>MRN</th>
          <th>Phone</th>
          <th>Condition</th>
          <th>Dx date</th>
          <th>Profile</th>
          <th>Last visit</th>
          <th>In clinic</th>
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
    </div>
  );
}
