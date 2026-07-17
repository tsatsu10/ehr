import { useCallback, useEffect, useMemo, useState } from 'react';
import { SegmentedControl } from '@components/SegmentedControl';
import { DataTable, DataTableStatusRow } from '@components/DataTable';
import { RowActionsMenu, type RowActionItem } from '@components/RowActionsMenu';
import { ConfirmModal } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
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
import { formatDateDisplay } from './schedulingCalendarUtils';
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
    return formatDateDisplay(row.due_date);
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
  const [pendingDelete, setPendingDelete] = useState<RecallRow | null>(null);
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
        visitTypeId: (day.default_visit_type_id || day.categories[0]?.id) ?? 0,
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
    setBusy(true);
    try {
      const worklist = await deleteRecall(ajaxUrl, csrfToken, filters, bucket, row.recall_id);
      setData(worklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorDeleteFailed);
    } finally {
      setBusy(false);
      setPendingDelete(null);
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

  // Secondary row actions live behind an overflow menu; Log outcome + Book stay
  // visible as the two primary actions. Manage-only items are gated the same way
  // the inline buttons were (data.can_manage); Front Desk is always available.
  const buildRecallActions = (row: RecallRow): RowActionItem[] => {
    const items: RowActionItem[] = [];
    const canManage = !!data?.can_manage;
    if (canManage && row.produced_eid != null && row.produced_eid > 0) {
      items.push({
        id: 'view-appt',
        label: labels.crossLinkViewAppointment,
        href: calendarUrlForDate(moduleUrl, filters, row.produced_event_date || row.due_date),
      });
    }
    if (canManage) {
      items.push({
        id: 'flow',
        label: labels.crossLinkFlowBoard,
        href: flowBoardUrlForDate(moduleUrl, filters, row.due_date),
      });
      items.push({ id: 'snooze', label: labels.recallSnooze, onClick: () => { void handleSnooze(row); }, disabled: busy });
      if (data?.messaging_enabled) {
        items.push({ id: 'remind', label: labels.recallSendReminder, onClick: () => { void handleSendReminder(row); }, disabled: busy });
      }
      items.push({ id: 'edit', label: labels.recallEdit, onClick: () => openEdit(row), disabled: busy });
    }
    items.push({ id: 'frontdesk', label: labels.frontDesk, href: frontDeskUrl });
    if (canManage) {
      items.push({ id: 'delete', label: labels.recallDelete, onClick: () => setPendingDelete(row), destructive: true, disabled: busy });
    }
    return items;
  };

  if (loading && !data) {
    return <p className="text-[var(--oe-nc-text-muted)]">{labels.loadingRecalls}</p>;
  }

  return (
    <div className="nc-recalls">
      <div className="flex flex-wrap items-end justify-between mb-3">
        <SegmentedControl
          segments={segments}
          value={bucket}
          onChange={(id) => setBucket(id as RecallBucket)}
          ariaLabel="Recall buckets"
        />
        <div className="nc-form-group mb-0 mt-2 md:mt-0">
          <label className="sr-only" htmlFor="nc-recalls-search">Search recalls</label>
          <Input
            id="nc-recalls-search"
            type="search"
            className="h-8"
            placeholder={labels.recallSearchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className={deskCalloutClass('error', 'py-2')}>{error}</div>}

      {filterPid != null && filterPid > 0 && (
        <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
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
              <strong className="text-sm block">{row.patient_name}</strong>
              <span className="text-[var(--oe-nc-text-muted)] text-sm">
                MRN
                {' '}
                {row.pubpid}
              </span>
              <span className="text-[var(--oe-nc-text-muted)] text-sm block">
                {row.last_seen_label
                  ? `${labels.recallLastSeenPrefix} ${row.last_seen_label}`
                  : labels.recallNeverSeen}
              </span>
            </td>
            <td className={row.bucket === 'overdue' ? 'text-[var(--oe-nc-danger)] text-sm' : 'text-sm'}>
              {dueLabel(row)}
            </td>
            <td className="text-sm">{row.reason || '—'}</td>
            <td className="text-sm">
              <Badge variant="outline">{row.status_label}</Badge>
            </td>
            <td className="text-sm text-[var(--oe-nc-text-muted)]">{row.contact}</td>
            <td className="text-sm">
              <div className="flex flex-wrap items-center gap-1">
                {data.can_manage && (
                  <>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mr-2"
                      disabled={busy}
                      onClick={() => {
                        setOutcomeRow(row);
                        setOutcomeStatus('contacted');
                      }}
                    >
                      {labels.recallLogOutcome}
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mr-2"
                      disabled={busy}
                      onClick={() => { void openBooking(row); }}
                    >
                      {labels.recallBookAppt}
                    </Button>
                  </>
                )}
                <RowActionsMenu
                  label={`Actions for ${row.patient_name}`}
                  items={buildRecallActions(row)}
                />
              </div>
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
        recallTypes={data?.recall_types ?? []}
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
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        title={`${labels.deleteRecallConfirm} ${pendingDelete?.patient_name ?? ''}?`}
        confirmLabel={labels.recallDelete}
        confirmVariant="danger"
        submitting={busy}
        onConfirm={() => {
          if (pendingDelete) {
            void handleDelete(pendingDelete);
          }
        }}
      >
        <p className="text-sm text-[var(--oe-nc-text-muted)]">
          MRN {pendingDelete?.pubpid}
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={outcomeRow != null}
        onClose={() => setOutcomeRow(null)}
        title={labels.outcomeModalTitle}
        confirmLabel={labels.outcomeModalConfirm}
        submitting={busy}
        onConfirm={() => { void submitOutcome(); }}
      >
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-2">
          {outcomeRow?.patient_name}
          {' · '}
          {outcomeRow?.reason}
        </p>
        <div className="nc-form-group">
          <label htmlFor="nc-recall-outcome-status">{labels.outcomeModalStatus}</label>
          <NativeSelect
            id="nc-recall-outcome-status"
            className="h-8"
            value={outcomeStatus}
            onChange={(e) => setOutcomeStatus(e.target.value)}
          >
            <option value="contacted">{labels.outcomeStatusContacted}</option>
            <option value="declined">{labels.outcomeStatusDeclined}</option>
            <option value="unreachable">{labels.outcomeStatusUnreachable}</option>
            <option value="completed">{labels.outcomeStatusCompleted}</option>
            <option value="snoozed">{labels.outcomeStatusSnoozed}</option>
          </NativeSelect>
        </div>
        <div className="nc-form-group mb-0">
          <label htmlFor="nc-recall-outcome-note">{labels.outcomeModalNote}</label>
          <Textarea
            id="nc-recall-outcome-note"
            className="min-h-[4.5rem]"
            rows={2}
            value={outcomeNote}
            onChange={(e) => setOutcomeNote(e.target.value)}
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
