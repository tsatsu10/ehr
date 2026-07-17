import { useMemo, useState } from 'react';
import { DataTable, DataTableStatusRow } from '@components/DataTable';
import { PaginationBar } from '@components/PaginationBar';
import { RowActionsMenu } from '@components/RowActionsMenu';
import { SegmentedControl } from '@components/SegmentedControl';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Input } from '@components/ui/input';
import { t } from '@core/i18n';
import { useRxHistory } from './useRxHistory';
import type { RxHistoryProps, RxHistoryRow, RxHistoryStatusFilter } from './rxHistoryTypes';

function statusBadge(status: RxHistoryRow['status']) {
  if (status === 'discontinued') {
    return <Badge variant="neutral">{t('Discontinued')}</Badge>;
  }
  if (status === 'dispensed') {
    return <Badge variant="neutral">{t('Dispensed')}</Badge>;
  }
  return <Badge variant="neutral">{t('Pending')}</Badge>;
}

export function RxHistoryPage({ ajaxUrl, csrfToken, moduleUrl, pid }: RxHistoryProps) {
  const [status, setStatus] = useState<RxHistoryStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, loading, error } = useRxHistory({ ajaxUrl, csrfToken, pid, page, status, search });

  const segments = useMemo(
    () => [
      { id: 'all', label: t('All') },
      { id: 'active', label: t('Active') },
      { id: 'discontinued', label: t('Discontinued') },
    ],
    [],
  );

  const handleStatusChange = (id: string) => {
    setStatus(id as RxHistoryStatusFilter);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="nc-rx-history">
      <div className="nc-rx-history__header">
        <h1 className="nc-rx-history__title">
          {t('Prescription history')}
          {data?.patient_name ? <span className="nc-rx-history__patient"> — {data.patient_name}</span> : null}
        </h1>
      </div>

      <div className="nc-rx-history__toolbar">
        <SegmentedControl segments={segments} value={status} onChange={handleStatusChange} ariaLabel={t('Filter by status')} />
        <div className="nc-form-group mb-0">
          <label className="sr-only" htmlFor="nc-rx-history-search">{t('Search by drug name')}</label>
          <Input
            id="nc-rx-history-search"
            type="search"
            className="h-8"
            placeholder={t('Search by drug name')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {error && <div className={deskCalloutClass('error', 'py-2')}>{error}</div>}

      <DataTable
        id="nc-rx-history-table"
        hover
        bordered
        header={(
          <tr>
            <th scope="col">{t('Drug')}</th>
            <th scope="col">{t('Status')}</th>
            <th scope="col">{t('Qty')}</th>
            <th scope="col">{t('Refills')}</th>
            <th scope="col">{t('Prescribed by')}</th>
            <th scope="col">{t('Date')}</th>
            <th scope="col" />
          </tr>
        )}
      >
        {!loading && (data?.rows.length ?? 0) === 0 && (
          <DataTableStatusRow colSpan={7}>{t('No prescriptions found.')}</DataTableStatusRow>
        )}
        {loading && !data && (
          <DataTableStatusRow colSpan={7}>{t('Loading…')}</DataTableStatusRow>
        )}
        {data?.rows.map((row) => (
          <tr key={row.id}>
            <td>
              <strong className="text-sm block">{row.drug}</strong>
              {row.sig && <span className="text-[var(--oe-nc-text-muted)] text-sm">{row.sig}</span>}
            </td>
            <td className="text-sm">{statusBadge(row.status)}</td>
            <td className="text-sm">{row.quantity || '—'}</td>
            <td className="text-sm">{row.refills}</td>
            <td className="text-sm">{row.provider_name ?? '—'}</td>
            <td className="text-sm">{row.date_added ?? '—'}</td>
            <td>
              <RowActionsMenu
                label={t('Actions for {drug}', { drug: row.drug })}
                items={[
                  {
                    id: 'print',
                    label: t('Print'),
                    href: `${moduleUrl}/rx-print.php?prescription_id=${row.id}`,
                  },
                  ...(row.editable && row.visit_id
                    ? [{
                      id: 'edit',
                      label: t('Edit'),
                      href: `${moduleUrl}/rx-edit.php?visit_id=${row.visit_id}&rx_id=${row.id}&return_to=pharmacy`,
                    }]
                    : []),
                ]}
              />
            </td>
          </tr>
        ))}
      </DataTable>

      {data && (
        <PaginationBar
          page={data.page}
          pageSize={data.page_size}
          total={data.total}
          onPageChange={setPage}
          id="nc-rx-history-pagination"
        />
      )}
    </div>
  );
}
