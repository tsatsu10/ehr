import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
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
      setError(err instanceof Error ? err.message : 'Could not load reminder log');
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

  return (
    <div className="oe-nc-comm-reminder-log">
      <header className="oe-nc-comm-detail__header mb-3 d-flex justify-content-between align-items-center">
        <h2 className="h5 mb-0">Reminder log</h2>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="border rounded p-2 mb-3 bg-light">
        <div className="form-row align-items-end">
          <div className="form-group col-md-3 mb-2 mb-md-0">
            <label className="small mb-0" htmlFor="nc-reminder-log-status">Status</label>
            <select
              id="nc-reminder-log-status"
              className="form-control form-control-sm"
              value={filters.processed}
              onChange={(event) => setFilters((prev) => ({
                ...prev,
                processed: event.target.value as ReminderLogStatusFilter,
              }))}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
            </select>
          </div>
          <div className="form-group col-md-3 mb-2 mb-md-0">
            <label className="small mb-0" htmlFor="nc-reminder-log-from">Sent from</label>
            <input
              type="date"
              id="nc-reminder-log-from"
              className="form-control form-control-sm"
              value={filters.date_from}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
            />
          </div>
          <div className="form-group col-md-3 mb-2 mb-md-0">
            <label className="small mb-0" htmlFor="nc-reminder-log-to">Sent to</label>
            <input
              type="date"
              id="nc-reminder-log-to"
              className="form-control form-control-sm"
              value={filters.date_to}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
            />
          </div>
          <div className="form-group col-md-3 mb-0">
            <button type="button" className="btn btn-primary btn-sm mr-1" onClick={applyFilters}>
              Apply
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>

        {isAdmin && recipients.length > 0 && (
          <div className="form-row mt-2">
            <div className="form-group col-md-6 mb-0">
              <label className="small mb-1">Sent by</label>
              <div className="border rounded p-2 bg-white" style={{ maxHeight: '6rem', overflowY: 'auto' }}>
                {recipients.map((recipient) => (
                  <div className="form-check" key={`by-${recipient.id}`}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`nc-log-sent-by-${recipient.id}`}
                      checked={filters.sent_by.includes(recipient.id)}
                      onChange={() => toggleFilterRecipient('sent_by', recipient.id)}
                    />
                    <label className="form-check-label small" htmlFor={`nc-log-sent-by-${recipient.id}`}>
                      {recipient.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group col-md-6 mb-0">
              <label className="small mb-1">Sent to</label>
              <div className="border rounded p-2 bg-white" style={{ maxHeight: '6rem', overflowY: 'auto' }}>
                {recipients.map((recipient) => (
                  <div className="form-check" key={`to-${recipient.id}`}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`nc-log-sent-to-${recipient.id}`}
                      checked={filters.sent_to.includes(recipient.id)}
                      onChange={() => toggleFilterRecipient('sent_to', recipient.id)}
                    />
                    <label className="form-check-label small" htmlFor={`nc-log-sent-to-${recipient.id}`}>
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
        <div className="text-muted"><em>Loading reminder log…</em></div>
      ) : error ? (
        <div className="text-danger">{error}</div>
      ) : !rows.length ? (
        <p className="text-muted mb-0">No reminders found for this filter.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>ID</th>
                <th>Sent</th>
                <th>From</th>
                <th>To</th>
                <th>Patient</th>
                <th>Message</th>
                <th>Due</th>
                <th>Processed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.sent_at_label ?? row.sent_at ?? '—'}</td>
                  <td>{row.from_name}</td>
                  <td>{row.to_name}</td>
                  <td>{row.patient_name}</td>
                  <td>{row.message}</td>
                  <td>{row.due_date_label ?? row.due_date ?? '—'}</td>
                  <td>{formatProcessedCell(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
