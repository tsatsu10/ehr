import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { PaginationBar } from '@components/PaginationBar';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { oeFetch } from '@core/oeFetch';
import { t } from '@core/i18n';
import type {
  ReminderLogFilters,
  ReminderLogResult,
  ReminderLogStatusFilter,
  ReminderRecipientOption,
} from './communicationsTypes';

interface ReminderLogPaneProps {
  ajaxUrl: string;
  csrfToken: string;
  onClose: () => void;
}

const DEFAULT_FILTERS: ReminderLogFilters = {
  processed: 'all',
  date_from: '',
  date_to: '',
  sent_by: [],
  sent_to: [],
};

const LOG_PAGE_SIZE = 25;

function statusFilterOptions(): Array<{ value: ReminderLogStatusFilter; label: string }> {
  return [
    { value: 'all', label: t('All') },
    { value: 'pending', label: t('Pending') },
    { value: 'processed', label: t('Completed') },
  ];
}

function formatProcessedCell(row: ReminderLogResult['rows'][number]): string {
  const label = row.processed_at_label;
  if (!label || label.startsWith('0000')) {
    return '—';
  }
  return row.processed_by && row.processed_by !== 'N/A'
    ? `${label} · ${row.processed_by}`
    : label;
}

export function ReminderLogPane({ ajaxUrl, csrfToken, onClose }: ReminderLogPaneProps) {
  const [rows, setRows] = useState<ReminderLogResult['rows']>([]);
  const [recipients, setRecipients] = useState<ReminderRecipientOption[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState<ReminderLogFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const buildParams = useCallback((active: ReminderLogFilters): Record<string, string | number> => {
    const params: Record<string, string | number> = {};
    if (active.processed !== 'all') {
      params.processed = active.processed;
    }
    if (active.date_from) {
      params.date_from = active.date_from;
    }
    if (active.date_to) {
      params.date_to = active.date_to;
    }
    if (active.sent_by.length) {
      params.sent_by = active.sent_by.join(',');
    }
    if (active.sent_to.length) {
      params.sent_to = active.sent_to.join(',');
    }
    return params;
  }, []);

  const loadLog = useCallback(async (active: ReminderLogFilters) => {
    setLoading(true);
    setError(null);
    setPage(1);
    try {
      const data = await oeFetch<ReminderLogResult>('communications.reminder_log', {
        ...fetchOptions,
        params: buildParams(active),
      });
      setRows(data.rows ?? []);
      setIsAdmin(!!data.is_admin);
      if (data.recipients?.length) {
        setRecipients(data.recipients);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not load reminder log'));
    } finally {
      setLoading(false);
    }
  }, [buildParams, fetchOptions]);

  useEffect(() => {
    void loadLog(DEFAULT_FILTERS);
  }, [loadLog]);

  const toggleFilterRecipient = (
    field: 'sent_by' | 'sent_to',
    id: number,
  ) => {
    setFilters((prev) => {
      const current = prev[field];
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id];
      return { ...prev, [field]: next };
    });
  };

  const applyFilters = () => {
    void loadLog(filters);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    void loadLog(DEFAULT_FILTERS);
  };

  const pageRows = rows.slice((page - 1) * LOG_PAGE_SIZE, page * LOG_PAGE_SIZE);

  return (
    <div className="nc-comm-reminder-log">
      <header className="nc-comm-detail-header nc-comm-log-head">
        <div>
          <h2 className="nc-comm-reader-title">{t('Reminder log')}</h2>
          <p className="nc-comm-reader-meta">{t('Every reminder sent, with who completed it and when.')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t('Close')}
        </Button>
      </header>

      <div className="nc-comm-filter-bar">
        <div className="nc-comm-form-row">
          <div className="nc-form-group">
            <span className="nc-comm-field-label" id="nc-reminder-log-status-label">{t('Status')}</span>
            <div className="nc-radio-pills" role="radiogroup" aria-labelledby="nc-reminder-log-status-label">
              {statusFilterOptions().map((option) => (
                <label className="nc-radio-pill" key={option.value}>
                  <input
                    type="radio"
                    name="nc-reminder-log-status"
                    value={option.value}
                    checked={filters.processed === option.value}
                    onChange={() => setFilters((prev) => ({ ...prev, processed: option.value }))}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="nc-form-group">
            <label className="nc-comm-field-label" htmlFor="nc-reminder-log-from">{t('Sent from date')}</label>
            <Input
              type="date"
              id="nc-reminder-log-from"
              className="h-8"
              value={filters.date_from}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
            />
          </div>
          <div className="nc-form-group">
            <label className="nc-comm-field-label" htmlFor="nc-reminder-log-to">{t('Sent to date')}</label>
            <Input
              type="date"
              id="nc-reminder-log-to"
              className="h-8"
              value={filters.date_to}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
            />
          </div>
          <div className="nc-form-group nc-comm-filter-actions">
            <Button type="button" size="sm" className="mr-1" onClick={applyFilters}>
              {t('Apply')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              {t('Reset')}
            </Button>
          </div>
        </div>

        {isAdmin && recipients.length > 0 && (
          <div className="nc-comm-form-row">
            <div className="nc-form-group">
              <span className="nc-comm-field-label">{t('Sent by (person)')}</span>
              <div className="nc-comm-recipient-box nc-comm-recipient-box--sm">
                {recipients.map((recipient) => (
                  <div className="nc-comm-check-row" key={`by-${recipient.id}`}>
                    <input
                      type="checkbox"
                      className="nc-comm-check"
                      id={`nc-log-sent-by-${recipient.id}`}
                      checked={filters.sent_by.includes(recipient.id)}
                      onChange={() => toggleFilterRecipient('sent_by', recipient.id)}
                    />
                    <label htmlFor={`nc-log-sent-by-${recipient.id}`}>
                      {recipient.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="nc-form-group">
              <span className="nc-comm-field-label">{t('Sent to (person)')}</span>
              <div className="nc-comm-recipient-box nc-comm-recipient-box--sm">
                {recipients.map((recipient) => (
                  <div className="nc-comm-check-row" key={`to-${recipient.id}`}>
                    <input
                      type="checkbox"
                      className="nc-comm-check"
                      id={`nc-log-sent-to-${recipient.id}`}
                      checked={filters.sent_to.includes(recipient.id)}
                      onChange={() => toggleFilterRecipient('sent_to', recipient.id)}
                    />
                    <label htmlFor={`nc-log-sent-to-${recipient.id}`}>
                      {recipient.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="nc-comm-list-state">{t('Loading reminder log…')}</div>
      ) : error ? (
        <div className={deskCalloutClass('error', 'py-2')} role="alert">
          <p className="mb-2">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={applyFilters}>
            {t('Retry')}
          </Button>
        </div>
      ) : !rows.length ? (
        <div className="nc-comm-list-state">
          <strong className="nc-comm-empty-title">{t('No reminders found for this filter.')}</strong>
          <Button type="button" variant="link" size="sm" className="h-auto p-0 self-start" onClick={resetFilters}>
            {t('Reset filters')}
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table className={ncShadcnTableClass({ hover: true, className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Sent')}</TableHead>
                  <TableHead>{t('From')}</TableHead>
                  <TableHead>{t('To')}</TableHead>
                  <TableHead>{t('Patient')}</TableHead>
                  <TableHead>{t('Message')}</TableHead>
                  <TableHead>{t('Due')}</TableHead>
                  <TableHead>{t('Completed')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.sent_at_label ?? row.sent_at ?? '—'}</TableCell>
                    <TableCell>{row.from_name}</TableCell>
                    <TableCell>{row.to_name}</TableCell>
                    <TableCell>{row.patient_name}</TableCell>
                    <TableCell className="nc-comm-log-msg" title={row.message}>{row.message}</TableCell>
                    <TableCell>{row.due_date_label ?? row.due_date ?? '—'}</TableCell>
                    <TableCell>{formatProcessedCell(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.length > LOG_PAGE_SIZE && (
            <div className="nc-comm-pagination">
              <PaginationBar
                id="nc-comm-log-pagination"
                page={page}
                pageSize={LOG_PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
