import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '@components/ConfirmModal';
import { SegmentedControl } from '@components/SegmentedControl';
import { WidgetCard } from '@components/WidgetCard';
import { localDateString } from '@islands/daily-reports/reportsFormatters';
import {
  dismissQueueBridgeException,
  fetchQueueBridgeList,
  resolveQueueBridgeException,
} from './queueBridgeApi';
import {
  ACTION_LABELS,
  LENS_LABELS,
  type QueueBridgeLens,
  type QueueBridgeProps,
  type QueueBridgeRow,
} from './queueBridgeTypes';
import './main.css';

function formatSummaryLine(counts: { action: number; info: number }): string {
  const parts: string[] = [];
  if (counts.action > 0) {
    parts.push(`${counts.action} need attention`);
  }
  if (counts.info > 0) {
    parts.push(`${counts.info} informational`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No open exceptions';
}

function rowSubtitle(row: QueueBridgeRow): string {
  const bits: string[] = [];
  if (row.appt_time_label) {
    bits.push(`Appt ${row.appt_time_label}`);
  }
  if (row.queue_number != null) {
    bits.push(`Queue #${row.queue_number}`);
  }
  bits.push(row.summary);
  bits.push(`(${row.exception_code})`);
  return bits.join(' · ');
}

export function QueueBridgeHub(props: QueueBridgeProps) {
  const [lens, setLens] = useState<QueueBridgeLens>(props.initialLens ?? 'action');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchQueueBridgeList>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dismissRow, setDismissRow] = useState<QueueBridgeRow | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [dismissSubmitting, setDismissSubmitting] = useState(false);
  const [cancelRow, setCancelRow] = useState<QueueBridgeRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const segments = useMemo(
    () => (['action', 'info', 'resolved'] as QueueBridgeLens[]).map((id) => ({
      id,
      label: LENS_LABELS[id],
      count: data?.counts[id] ?? 0,
    })),
    [data?.counts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchQueueBridgeList(props.ajaxUrl, props.csrfToken, lens);
      setData(payload);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load exceptions');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [lens, props.ajaxUrl, props.csrfToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const summaryEl = document.getElementById('nc-queuebridge-summary');
    if (summaryEl && data) {
      summaryEl.textContent = formatSummaryLine({
        action: data.counts.action,
        info: data.counts.info,
      });
    }
    const updatedEl = document.getElementById('nc-queuebridge-updated');
    if (updatedEl && lastUpdated) {
      updatedEl.textContent = `Updated ${lastUpdated.toLocaleTimeString()}`;
    }
    const refreshBtn = document.getElementById('nc-queuebridge-refresh');
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = '1';
      refreshBtn.addEventListener('click', () => { void load(); });
    }
  }, [data, lastUpdated, load]);

  const handleOpenAction = useCallback((row: QueueBridgeRow, action: string) => {
    const links = row.links ?? data?.links;
    if (action === 'open_flow_board' && links?.flow_board_url) {
      window.open(links.flow_board_url, '_top');
      return;
    }
    if (action === 'open_scheduling' && links?.scheduling_url) {
      window.open(links.scheduling_url, '_top');
      return;
    }
    if (action === 'open_visit_board' && links?.visit_board_url) {
      window.open(links.visit_board_url, '_top');
      return;
    }
    if (action === 'dismiss') {
      setDismissRow(row);
      setDismissReason('');
    }
  }, [data?.links]);

  const handleResolve = useCallback(async (
    row: QueueBridgeRow,
    action: string,
    options?: { cancelReason?: string },
  ) => {
    const key = `${row.exception_code}:${row.pid}:${row.pc_eid ?? 0}`;
    setBusyKey(key);
    setError(null);
    try {
      const result = await resolveQueueBridgeException(props.ajaxUrl, props.csrfToken, {
        exception_code: row.exception_code,
        action,
        pid: row.pid,
        pc_eid: row.pc_eid,
        visit_id: row.visit_id,
        appt_date: data?.snapshot_date ?? localDateString(),
        ...(options?.cancelReason ? { cancel_reason: options.cancelReason } : {}),
      });
      if (result.list) {
        setData(result.list);
      } else {
        await load();
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyKey(null);
    }
  }, [data, load, props.ajaxUrl, props.csrfToken]);

  const handleResolveClick = useCallback((row: QueueBridgeRow, action: string) => {
    if (action === 'cancel_visit') {
      setCancelRow(row);
      setCancelReason('');
      return;
    }
    void handleResolve(row, action);
  }, [handleResolve]);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelRow || cancelReason.trim() === '') {
      return;
    }
    setCancelSubmitting(true);
    setError(null);
    try {
      await handleResolve(cancelRow, 'cancel_visit', { cancelReason: cancelReason.trim() });
      setCancelRow(null);
      setCancelReason('');
    } finally {
      setCancelSubmitting(false);
    }
  }, [cancelReason, cancelRow, handleResolve]);

  const handleDismissConfirm = useCallback(async () => {
    if (!dismissRow || dismissReason.trim() === '') {
      return;
    }
    setDismissSubmitting(true);
    setError(null);
    try {
      const result = await dismissQueueBridgeException(props.ajaxUrl, props.csrfToken, {
        exception_code: dismissRow.exception_code,
        pid: dismissRow.pid,
        reason: dismissReason.trim(),
        pc_eid: dismissRow.pc_eid,
        visit_id: dismissRow.visit_id,
      });
      setDismissRow(null);
      setDismissReason('');
      if (result.list) {
        setData(result.list);
      } else {
        await load();
      }
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dismiss failed');
    } finally {
      setDismissSubmitting(false);
    }
  }, [dismissReason, dismissRow, load, props.ajaxUrl, props.csrfToken]);

  const canResolve = props.canResolve && (data?.can_resolve ?? false);
  const resolveActions = new Set([
    'start_visit_checkin',
    'mark_arrived',
    'link_appointment',
    'cancel_visit',
    'unlink_appointment',
    'relink_nearest_appointment',
  ]);

  return (
    <div className="oe-nc-queuebridge" id="nc-queue-bridge-root">
      <WidgetCard
        title={`Queue Bridge — Today ${data?.snapshot_date ?? localDateString()}`}
        bodyPad="pad"
      >
        <SegmentedControl
          segments={segments}
          value={lens}
          onChange={(id) => setLens(id as QueueBridgeLens)}
          ariaLabel="Exception lenses"
          className="mb-3"
        />

        {error && (
          <div className="alert alert-danger" role="alert">{error}</div>
        )}

        {loading && <p className="text-muted">Loading exceptions…</p>}

        {!loading && data && data.rows.length === 0 && (
          <p className="text-muted mb-0">
            {lens === 'resolved' ? 'No exceptions resolved today.' : 'No exceptions in this lens.'}
          </p>
        )}

        {!loading && data && data.rows.length > 0 && (
          <ul className="oe-nc-queuebridge__list list-unstyled mb-0">
            {data.rows.map((row) => {
              const rowKey = `${row.exception_code}:${row.pid}:${row.pc_eid ?? 0}:${row.visit_id ?? 0}`;
              const isBusy = busyKey === `${row.exception_code}:${row.pid}:${row.pc_eid ?? 0}`;
              const actions = row.available_actions ?? [];

              return (
                <li key={rowKey} className="oe-nc-queuebridge__row">
                  <div className="oe-nc-queuebridge__row-head">
                    <strong>{row.patient_name}</strong>
                    <span className="text-muted small">{rowSubtitle(row)}</span>
                  </div>
                  {lens === 'resolved' && row.resolved_at && (
                    <div className="text-muted small">{row.resolved_at}</div>
                  )}
                  {lens !== 'resolved' && actions.length > 0 && (
                    <div className="oe-nc-queuebridge__actions">
                      {actions.map((action) => {
                        if (action === 'dismiss') {
                          if (!row.can_dismiss && !props.canDismiss) {
                            return null;
                          }
                          return (
                            <button
                              key={action}
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={isBusy}
                              onClick={() => handleOpenAction(row, action)}
                            >
                              {ACTION_LABELS[action] ?? action}
                            </button>
                          );
                        }

                        if (resolveActions.has(action)) {
                          if (!canResolve) {
                            return null;
                          }
                          const variant = action === 'cancel_visit'
                            ? 'btn-danger'
                            : action === 'unlink_appointment'
                              ? 'btn-outline-danger'
                              : 'btn-primary';
                          return (
                            <button
                              key={action}
                              type="button"
                              className={`btn ${variant} btn-sm`}
                              disabled={isBusy}
                              onClick={() => handleResolveClick(row, action)}
                            >
                              {ACTION_LABELS[action] ?? action}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={action}
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={isBusy}
                            onClick={() => handleOpenAction(row, action)}
                          >
                            {ACTION_LABELS[action] ?? action}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </WidgetCard>

      <ConfirmModal
        open={dismissRow != null}
        onClose={() => {
          if (!dismissSubmitting) {
            setDismissRow(null);
            setDismissReason('');
          }
        }}
        title="Dismiss exception"
        titleId="nc-queuebridge-dismiss-title"
        confirmLabel="Dismiss"
        confirmVariant="warning"
        confirmDisabled={dismissReason.trim() === ''}
        submitting={dismissSubmitting}
        submittingLabel="Dismissing…"
        onConfirm={() => { void handleDismissConfirm(); }}
      >
        <p className="mb-2">
          Explain why this exception can be ignored (e.g. walk-in OK, duplicate booking).
        </p>
        <label className="sr-only" htmlFor="nc-queuebridge-dismiss-reason">Dismiss reason</label>
        <textarea
          id="nc-queuebridge-dismiss-reason"
          className="form-control"
          rows={3}
          value={dismissReason}
          onChange={(e) => setDismissReason(e.target.value)}
        />
      </ConfirmModal>

      <ConfirmModal
        open={cancelRow != null}
        onClose={() => {
          if (!cancelSubmitting) {
            setCancelRow(null);
            setCancelReason('');
          }
        }}
        title="Cancel visit"
        titleId="nc-queuebridge-cancel-title"
        confirmLabel="Cancel visit"
        confirmVariant="danger"
        confirmDisabled={cancelReason.trim() === ''}
        submitting={cancelSubmitting}
        submittingLabel="Cancelling…"
        onConfirm={() => { void handleCancelConfirm(); }}
      >
        <p className="mb-2">
          The linked appointment was cancelled on schedule. Cancel this active visit or use
          {' '}
          <strong>Unlink appointment</strong>
          {' '}
          to keep the visit without a calendar link.
        </p>
        <label className="sr-only" htmlFor="nc-queuebridge-cancel-reason">Cancel reason</label>
        <textarea
          id="nc-queuebridge-cancel-reason"
          className="form-control"
          rows={3}
          maxLength={200}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </ConfirmModal>
    </div>
  );
}
