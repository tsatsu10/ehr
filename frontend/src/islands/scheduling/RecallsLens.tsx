import { useCallback, useEffect, useMemo, useState } from 'react';
import { SegmentedControl } from '@components/SegmentedControl';
import { DataTable, DataTableStatusRow } from '@components/DataTable';
import { ConfirmModal } from '@components/ConfirmModal';
import { fetchCalendarDay } from './schedulingApi';
import {
  deleteRecall,
  fetchRecallsWorklist,
  sendRecallReminder,
  snoozeRecall,
  updateRecallStatus,
} from './schedulingApi';
import { CalendarBookingSheet } from './CalendarBookingSheet';
import { RecallFormSheet } from './RecallFormSheet';
import type {
  CalendarBookingDraft,
  CalendarDayPayload,
  RecallBucket,
  RecallFormDraft,
  RecallRow,
  RecallsWorklistPayload,
  SchedulingFilters,
  SchedulingLabels,
} from './schedulingTypes';
import { recallBucketLabel, resolveSchedulingLabels } from './schedulingLabels';
import { calendarUrlForDate, flowBoardUrlForDate } from './schedulingShellUtils';

const BUCKETS: RecallBucket[] = ['overdue', 'due', 'upcoming', 'completed'];

interface RecallsLensProps {
  ajaxUrl: string;
  csrfToken: string;
  filters: SchedulingFilters;
  facilities: { id: number; label: string }[];
  refreshToken: number;
  newRecallSignal: number;
  frontDeskUrl: string;
  moduleUrl: string;
  filterPid?: number | null;
  labels?: Partial<SchedulingLabels>;
}

function dueLabel(row: RecallRow): string {
  if (row.bucket === 'completed') {
    return row.due_date;
  }
  if (row.days_delta < 0) {
    return `${Math.abs(row.days_delta)}d overdue`;
  }
  if (row.days_delta === 0) {
    return 'Today';
  }
  return `in ${row.days_delta}d`;
}

export function RecallsLens({
  ajaxUrl,
  csrfToken,
  filters,
  facilities,
  refreshToken,
  newRecallSignal,
  frontDeskUrl,
  moduleUrl,
  filterPid = null,
  labels: labelOverrides,
}: RecallsLensProps) {
  const labels = resolveSchedulingLabels(labelOverrides);
  const [bucket, setBucket] = useState<RecallBucket>('due');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<RecallsWorklistPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState<RecallFormDraft | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<CalendarBookingDraft | null>(null);
  const [bookingRecallId, setBookingRecallId] = useState(0);
  const [calendarPayload, setCalendarPayload] = useState<CalendarDayPayload | null>(null);
  const [outcomeRow, setOutcomeRow] = useState<RecallRow | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState('contacted');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const worklist = await fetchRecallsWorklist(
        ajaxUrl,
        csrfToken,
        filters,
        bucket,
        search,
        filterPid ?? undefined,
      );
      setData(worklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorLoadRecalls);
    } finally {
      setLoading(false);
    }
  }, [ajaxUrl, bucket, csrfToken, filterPid, filters, labels.errorLoadRecalls, search]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    if (newRecallSignal <= 0) {
      return;
    }
    setFormDraft({
      recallId: 0,
      pid: 0,
      patientLabel: '',
      dueDate: filters.date,
      reason: '',
      providerId: filters.providerId > 0 ? filters.providerId : 0,
      facilityId: filters.facilityId,
    });
    setFormOpen(true);
  }, [filters.date, filters.facilityId, filters.providerId, newRecallSignal]);

  const segments = useMemo(
    () => BUCKETS.map((id) => ({
      id,
      label: recallBucketLabel(labels, id),
      count: data?.counts[id] ?? 0,
    })),
    [data?.counts, labels],
  );

  const openEdit = (row: RecallRow) => {
    setFormDraft({
      recallId: row.recall_id,
      pid: row.pid,
      patientLabel: row.patient_name,
      dueDate: row.due_date,
      reason: row.reason,
      providerId: row.provider_id,
      facilityId: row.facility_id,
      recallType: row.recall_type ?? 'general',
    });
    setFormOpen(true);
  };

  const openBooking = async (row: RecallRow) => {
    setBusy(true);
    try {
      const day = await fetchCalendarDay(ajaxUrl, csrfToken, {
        ...filters,
        date: row.due_date >= filters.date ? row.due_date : filters.date,
      });
      setCalendarPayload(day);
      setBookingRecallId(row.recall_id);
      setBookingDraft({
        date: row.due_date >= filters.date ? row.due_date : filters.date,
        time: '09:00',
        providerId: row.provider_id,
        pid: row.pid,
        patientLabel: row.patient_name,
        categoryId: day.categories[0]?.id ?? 0,
        durationMinutes: day.interval_minutes,
        comments: row.reason,
        recallId: row.recall_id,
      });
      setBookingOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorOpenBooking);
    } finally {
      setBusy(false);
    }
  };

  const handleSnooze = async (row: RecallRow) => {
    setBusy(true);
    try {
      const worklist = await snoozeRecall(ajaxUrl, csrfToken, filters, bucket, row.recall_id, 7, filterPid ?? undefined);
      setData(worklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorSnoozeFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleSendReminder = async (row: RecallRow) => {
    setBusy(true);
    setError(null);
    try {
      await sendRecallReminder(ajaxUrl, csrfToken, row.recall_id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorSendReminderFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: RecallRow) => {
    if (!window.confirm(`${labels.deleteRecallConfirm} ${row.patient_name}?`)) {
      return;
    }
    setBusy(true);
    try {
      const worklist = await deleteRecall(ajaxUrl, csrfToken, filters, bucket, row.recall_id);
      setData(worklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorDeleteFailed);
    } finally {
      setBusy(false);
    }
  };

  const submitOutcome = async () => {
    if (!outcomeRow) {
      return;
    }
    setBusy(true);
    try {
      const worklist = await updateRecallStatus(
        ajaxUrl,
        csrfToken,
        filters,
        bucket,
        outcomeRow.recall_id,
        outcomeStatus,
        outcomeNote,
      );
      setData(worklist);
      setOutcomeRow(null);
      setOutcomeNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorSaveFailed);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return <p className="text-muted">{labels.loadingRecalls}</p>;
  }

  return (
    <div className="oe-nc-recalls">
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-3">
        <SegmentedControl
          segments={segments}
          value={bucket}
          onChange={(id) => setBucket(id as RecallBucket)}
          ariaLabel="Recall buckets"
        />
        <div className="form-group mb-0 mt-2 mt-md-0">
          <label className="sr-only" htmlFor="nc-recalls-search">Search recalls</label>
          <input
            id="nc-recalls-search"
            type="search"
            className="form-control form-control-sm"
            placeholder={labels.recallSearchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {filterPid != null && filterPid > 0 && (
        <p className="text-muted small mb-2">
          {labels.filteredPatientPid}
          {' '}
          {filterPid}
          .
        </p>
      )}

      <DataTable
        id="nc-recalls-table"
        hover
        bordered
        header={(
          <tr>
            <th scope="col">{labels.recallColPatient}</th>
            <th scope="col">{labels.recallColDue}</th>
            <th scope="col">{labels.recallColReason}</th>
            <th scope="col">{labels.recallColStatus}</th>
            <th scope="col">{labels.recallColContact}</th>
            <th scope="col">{labels.recallColActions}</th>
          </tr>
        )}
      >
        {data?.rows.length === 0 && (
          <DataTableStatusRow colSpan={6}>{labels.recallNoRows}</DataTableStatusRow>
        )}
        {data?.rows.map((row) => (
          <tr key={row.recall_id}>
            <td>
              <strong className="small d-block">{row.patient_name}</strong>
              <span className="text-muted small">
                MRN
                {' '}
                {row.pubpid}
              </span>
            </td>
            <td className={row.bucket === 'overdue' ? 'text-danger small' : 'small'}>
              {dueLabel(row)}
            </td>
            <td className="small">{row.reason || '—'}</td>
            <td className="small">
              <span className="badge badge-light border">{row.status_label}</span>
            </td>
            <td className="small text-muted">{row.contact}</td>
            <td className="small">
              {data.can_manage && (
                <div className="d-flex flex-wrap">
                  {row.produced_eid != null && row.produced_eid > 0 && (
                    <a
                      className="btn btn-link btn-sm p-0 mr-2"
                      href={calendarUrlForDate(
                        moduleUrl,
                        filters,
                        row.produced_event_date || row.due_date,
                      )}
                    >
                      {labels.crossLinkViewAppointment}
                    </a>
                  )}
                  <a
                    className="btn btn-link btn-sm p-0 mr-2"
                    href={flowBoardUrlForDate(moduleUrl, filters, row.due_date)}
                  >
                    {labels.crossLinkFlowBoard}
                  </a>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 mr-2"
                    disabled={busy}
                    onClick={() => {
                      setOutcomeRow(row);
                      setOutcomeStatus('contacted');
                    }}
                  >
                    {labels.recallLogOutcome}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 mr-2"
                    disabled={busy}
                    onClick={() => { void openBooking(row); }}
                  >
                    {labels.recallBookAppt}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 mr-2"
                    disabled={busy}
                    onClick={() => { void handleSnooze(row); }}
                  >
                    {labels.recallSnooze}
                  </button>
                  {data.messaging_enabled && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 mr-2"
                      disabled={busy}
                      onClick={() => { void handleSendReminder(row); }}
                    >
                      {labels.recallSendReminder}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 mr-2"
                    disabled={busy}
                    onClick={() => openEdit(row)}
                  >
                    {labels.recallEdit}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-danger"
                    disabled={busy}
                    onClick={() => { void handleDelete(row); }}
                  >
                    {labels.recallDelete}
                  </button>
                </div>
              )}
              <a className="btn btn-link btn-sm p-0" href={frontDeskUrl}>{labels.frontDesk}</a>
            </td>
          </tr>
        ))}
      </DataTable>

      <RecallFormSheet
        open={formOpen}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        filters={filters}
        bucket={bucket}
        providers={data?.providers ?? []}
        facilities={facilities}
        recallTypes={(data?.recall_types ?? []).map((type) => ({
          id: type.id as unknown as number,
          label: type.label,
        }))}
        draft={formDraft}
        labels={labels}
        onClose={() => setFormOpen(false)}
        onSaved={() => { void load(); }}
      />

      <CalendarBookingSheet
        open={bookingOpen}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        filters={{
          ...filters,
          date: bookingDraft?.date ?? filters.date,
        }}
        payload={calendarPayload}
        draft={bookingDraft}
        recallId={bookingRecallId}
        labels={labels}
        onClose={() => setBookingOpen(false)}
        onBooked={() => { void load(); }}
      />

      <ConfirmModal
        open={outcomeRow != null}
        onClose={() => setOutcomeRow(null)}
        title={labels.outcomeModalTitle}
        confirmLabel={labels.outcomeModalConfirm}
        submitting={busy}
        onConfirm={() => { void submitOutcome(); }}
      >
        <p className="small text-muted mb-2">
          {outcomeRow?.patient_name}
          {' · '}
          {outcomeRow?.reason}
        </p>
        <div className="form-group">
          <label htmlFor="nc-recall-outcome-status">{labels.outcomeModalStatus}</label>
          <select
            id="nc-recall-outcome-status"
            className="form-control form-control-sm"
            value={outcomeStatus}
            onChange={(e) => setOutcomeStatus(e.target.value)}
          >
            <option value="contacted">Contacted</option>
            <option value="declined">Declined</option>
            <option value="unreachable">Unreachable</option>
            <option value="completed">Completed</option>
            <option value="snoozed">Snoozed</option>
          </select>
        </div>
        <div className="form-group mb-0">
          <label htmlFor="nc-recall-outcome-note">{labels.outcomeModalNote}</label>
          <textarea
            id="nc-recall-outcome-note"
            className="form-control form-control-sm"
            rows={2}
            value={outcomeNote}
            onChange={(e) => setOutcomeNote(e.target.value)}
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
