import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
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
    <div className="nc-comm-reminder-log">
      <header className="nc-comm-detail-header mb-3 flex justify-between items-center">
        <h2 className="text-lg font-semibold mb-0">Reminder log</h2>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>

      <div className="border rounded p-2 mb-3 bg-[var(--oe-nc-bg-tint)]">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="nc-form-group col-span-12 md:col-span-3 mb-2 md:mb-0">
            <Label className="normal-case font-normal mb-1" htmlFor="nc-reminder-log-status">Status</Label>
            <NativeSelect
              id="nc-reminder-log-status"
              className="h-8"
              value={filters.processed}
              onChange={(event) => setFilters((prev) => ({
                ...prev,
                processed: event.target.value as ReminderLogStatusFilter,
              }))}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
            </NativeSelect>
          </div>
          <div className="nc-form-group col-span-12 md:col-span-3 mb-2 md:mb-0">
            <Label className="normal-case font-normal mb-1" htmlFor="nc-reminder-log-from">Sent from</Label>
            <Input
              type="date"
              id="nc-reminder-log-from"
              className="h-8"
              value={filters.date_from}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))}
            />
          </div>
          <div className="nc-form-group col-span-12 md:col-span-3 mb-2 md:mb-0">
            <Label className="normal-case font-normal mb-1" htmlFor="nc-reminder-log-to">Sent to</Label>
            <Input
              type="date"
              id="nc-reminder-log-to"
              className="h-8"
              value={filters.date_to}
              onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))}
            />
          </div>
          <div className="nc-form-group col-span-12 md:col-span-3 mb-0">
            <Button type="button" size="sm" className="mr-1" onClick={applyFilters}>
              Apply
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </div>

        {isAdmin && recipients.length > 0 && (
          <div className="grid grid-cols-12 gap-3 mt-2">
            <div className="nc-form-group col-span-12 md:col-span-6 mb-0">
              <Label className="normal-case font-normal text-sm mb-1">Sent by</Label>
              <div className="border rounded p-2 bg-white" style={{ maxHeight: '6rem', overflowY: 'auto' }}>
                {recipients.map((recipient) => (
                  <div className="flex items-center gap-2 mb-1" key={`by-${recipient.id}`}>
                    <Checkbox
                      id={`nc-log-sent-by-${recipient.id}`}
                      checked={filters.sent_by.includes(recipient.id)}
                      onCheckedChange={() => toggleFilterRecipient('sent_by', recipient.id)}
                    />
                    <Label
                      htmlFor={`nc-log-sent-by-${recipient.id}`}
                      className="font-normal normal-case cursor-pointer mb-0 text-sm"
                    >
                      {recipient.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="nc-form-group col-span-12 md:col-span-6 mb-0">
              <Label className="normal-case font-normal text-sm mb-1">Sent to</Label>
              <div className="border rounded p-2 bg-white" style={{ maxHeight: '6rem', overflowY: 'auto' }}>
                {recipients.map((recipient) => (
                  <div className="flex items-center gap-2 mb-1" key={`to-${recipient.id}`}>
                    <Checkbox
                      id={`nc-log-sent-to-${recipient.id}`}
                      checked={filters.sent_to.includes(recipient.id)}
                      onCheckedChange={() => toggleFilterRecipient('sent_to', recipient.id)}
                    />
                    <Label
                      htmlFor={`nc-log-sent-to-${recipient.id}`}
                      className="font-normal normal-case cursor-pointer mb-0 text-sm"
                    >
                      {recipient.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-[var(--oe-nc-text-muted)]"><em>Loading reminder log…</em></div>
      ) : error ? (
        <div className="text-[var(--oe-nc-danger,#dc2626)]">{error}</div>
      ) : !rows.length ? (
        <p className="text-[var(--oe-nc-text-muted)] mb-0">No reminders found for this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Processed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.sent_at_label ?? row.sent_at ?? '—'}</TableCell>
                  <TableCell>{row.from_name}</TableCell>
                  <TableCell>{row.to_name}</TableCell>
                  <TableCell>{row.patient_name}</TableCell>
                  <TableCell>{row.message}</TableCell>
                  <TableCell>{row.due_date_label ?? row.due_date ?? '—'}</TableCell>
                  <TableCell>{formatProcessedCell(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
