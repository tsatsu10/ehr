import { useEffect, useState } from 'react';
import { ConfirmModal } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { identityFromLabels } from '@components/patientBannerUtils';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { NativeSelect } from '@components/ui/native-select';
import { printMessageThread } from './printMessageThread';
import type { MessageDetail, ReminderListRow } from './communicationsTypes';

interface CommunicationsDetailProps {
  loading: boolean;
  error: string | null;
  message: MessageDetail | null;
  reminder: ReminderListRow | null;
  webroot: string;
  ajaxUrl?: string;
  csrfToken?: string;
  onReply?: (noteId: number) => void;
  onStatusChange?: (noteId: number, status: string) => void;
  onAssignPatient?: (noteId: number, pid: number) => void;
  onDelete?: (noteId: number) => void;
  onForwardReminder?: (reminderId: number) => void;
  statusChanging?: boolean;
  assigningPatient?: boolean;
}

export function CommunicationsDetail({
  loading,
  error,
  message,
  reminder,
  webroot,
  ajaxUrl = '',
  csrfToken = '',
  onReply,
  onStatusChange,
  onAssignPatient,
  onDelete,
  onForwardReminder,
  statusChanging = false,
  assigningPatient = false,
}: CommunicationsDetailProps) {
  if (loading) {
    return <div className="text-[var(--oe-nc-text-muted)]"><em>Loading…</em></div>;
  }
  if (error) {
    return <div className="text-[var(--oe-nc-danger,#dc2626)]">{error}</div>;
  }
  if (message) {
    return (
      <MessageDetailView
        detail={message}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        onReply={onReply}
        onStatusChange={onStatusChange}
        onAssignPatient={onAssignPatient}
        onDelete={onDelete}
        statusChanging={statusChanging}
        assigningPatient={assigningPatient}
      />
    );
  }
  if (reminder) {
    return (
      <ReminderDetailView
        reminder={reminder}
        webroot={webroot}
        onForwardReminder={onForwardReminder}
      />
    );
  }
  return (
    <div className="nc-comm-empty text-[var(--oe-nc-text-muted)]">
      <p className="mb-0">Select an item to read details.</p>
    </div>
  );
}

function MessageDetailView({
  detail,
  ajaxUrl,
  csrfToken,
  onReply,
  onStatusChange,
  onAssignPatient,
  onDelete,
  statusChanging = false,
  assigningPatient = false,
}: {
  detail: MessageDetail;
  ajaxUrl: string;
  csrfToken: string;
  onReply?: (noteId: number) => void;
  onStatusChange?: (noteId: number, status: string) => void;
  onAssignPatient?: (noteId: number, pid: number) => void;
  onDelete?: (noteId: number) => void;
  statusChanging?: boolean;
  assigningPatient?: boolean;
}) {
  const [assignPid, setAssignPid] = useState<number | null>(null);
  const [assignName, setAssignName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setAssignPid(null);
    setAssignName('');
  }, [detail.id, detail.can_assign_patient]);

  const statusControl = detail.can_change_status && (detail.message_statuses?.length ?? 0) > 0 ? (
    <NativeSelect
      id="nc-comm-detail-status"
      className="h-8 inline-block w-auto ml-1"
      value={detail.status || ''}
      disabled={statusChanging}
      aria-label="Message status"
      onChange={(e) => onStatusChange?.(detail.id, e.target.value)}
    >
      {(detail.message_statuses ?? []).map((opt) => (
        <option key={opt.id} value={opt.id}>{opt.label}</option>
      ))}
    </NativeSelect>
  ) : (
    <span>{detail.status || ''}</span>
  );

  const patientIdentity = identityFromLabels(detail.patient_name, { pid: detail.pid ?? undefined });
  const showPatientBanner = patientIdentity != null && !detail.can_assign_patient;

  return (
    <>
      {detail.is_supervisory_read && detail.supervisory_banner && (
        <div className={deskCalloutClass('warn', 'nc-comm-detail-banner py-2 text-sm')}>
          {detail.supervisory_banner}
        </div>
      )}
      {detail.can_assign_patient && (
        <div className={deskCalloutClass('warn', 'nc-comm-orphan py-2')}>
          <p className="text-sm mb-2 mb-md-1">
            <strong>No patient linked.</strong> Assign a patient to this message.
          </p>
          {assignPid ? (
            <div className="flex flex-wrap items-center">
              <Badge variant="outline" className="mr-2 mb-1 py-2 px-2">
                {assignName || `PID ${assignPid}`}
              </Badge>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 mr-2 mb-1"
                disabled={assigningPatient}
                onClick={() => {
                  setAssignPid(null);
                  setAssignName('');
                }}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="warning"
                size="sm"
                className="mb-1"
                disabled={assigningPatient}
                onClick={() => onAssignPatient?.(detail.id, assignPid)}
              >
                {assigningPatient ? 'Assigning…' : 'Assign patient'}
              </Button>
            </div>
          ) : (
            <PatientSearchDropdown
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              inputId="nc-comm-assign-patient"
              resultsId="nc-comm-assign-patient-results"
              placeholder="Search by name, phone, NHIS, National ID, MRN"
              onSelectPatient={(selectedPid, row) => {
                setAssignPid(selectedPid);
                setAssignName(row?.display_name ?? '');
              }}
            />
          )}
        </div>
      )}
      {showPatientBanner && patientIdentity ? (
        <PatientContextBanner
          layout="compact"
          identity={patientIdentity}
          aside={<Badge variant="outline">{detail.type}</Badge>}
        >
          <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
            {detail.from_name} · {detail.date_display || detail.date}
          </div>
        </PatientContextBanner>
      ) : null}
      <header className="nc-comm-detail-header">
        {!showPatientBanner ? (
          <h2 className="text-lg font-semibold mb-1">
            {detail.patient_name || detail.type || 'Message'}
            {detail.patient_unassigned && !detail.can_assign_patient && (
              <Badge variant="warning" className="ml-2">No patient</Badge>
            )}
          </h2>
        ) : (
          <h2 className="h6 mb-1 text-[var(--oe-nc-text-muted)]">{detail.type || 'Message'}</h2>
        )}
        {!showPatientBanner ? (
          <div className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
            {detail.from_name} · {detail.date_display || detail.date}
          </div>
        ) : null}
        <div className="text-sm mb-2">
          <strong>Type:</strong> {detail.type} · <strong>Status:</strong> {statusControl}
        </div>
        <div className="mb-2">
          {detail.chart_url && (
            <Button variant="outline" size="sm" className="mr-1" asChild>
              <a href={detail.chart_url} target="_top">
                Open chart
              </a>
            </Button>
          )}
          {detail.can_reply && onReply && (
            <Button
              type="button"
              size="sm"
              onClick={() => onReply(detail.id)}
            >
              Reply
            </Button>
          )}
          {detail.can_reply && !onReply && detail.legacy_reply_url && (
            <Button size="sm" asChild>
              <a href={detail.legacy_reply_url} target="_top">
                Reply
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1"
            onClick={() => printMessageThread(detail)}
          >
            Print
          </Button>
          {detail.can_delete && onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </header>
      <div
        className="nc-comm-thread"
        dangerouslySetInnerHTML={{ __html: detail.thread_html || '' }}
      />
      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete message?"
        modalId="nc-comm-delete-modal"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          onDelete?.(detail.id);
          setDeleteConfirmOpen(false);
        }}
      >
        <p className="mb-0">Delete this message? This cannot be undone.</p>
      </ConfirmModal>
    </>
  );
}

function ReminderDetailView({
  reminder,
  webroot,
  onForwardReminder,
}: {
  reminder: ReminderListRow;
  webroot: string;
  onForwardReminder?: (reminderId: number) => void;
}) {
  const chartUrl = reminder.pid
    ? `${webroot}/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid=${reminder.pid}`
    : null;
  const patientIdentity = identityFromLabels(reminder.patient_name, { pid: reminder.pid });

  return (
    <>
      {patientIdentity ? (
        <PatientContextBanner
          layout="compact"
          identity={patientIdentity}
          aside={(
            <span className={`nc-comm-urgency--${reminder.urgency}`}>
              {reminder.urgency_label}
            </span>
          )}
        >
          <div className="text-sm text-[var(--oe-nc-text-muted)] mt-1">
            Due {reminder.due_display || reminder.due_date} · From {reminder.from_name}
          </div>
        </PatientContextBanner>
      ) : null}
      <header className="nc-comm-detail-header">
        {!patientIdentity ? (
          <>
            <h2 className="text-lg font-semibold mb-1">{reminder.patient_name || 'Reminder'}</h2>
            <div className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
              <span className={`nc-comm-urgency--${reminder.urgency}`}>
                {reminder.urgency_label}
              </span>
              {' · '}
              {reminder.due_display || reminder.due_date}
            </div>
            <div className="text-sm mb-2"><strong>From:</strong> {reminder.from_name}</div>
          </>
        ) : (
          <h2 className="h6 mb-1 text-[var(--oe-nc-text-muted)]">Reminder</h2>
        )}
        <div className="mb-2">
          {chartUrl && (
            <Button variant="outline" size="sm" className="mr-1" asChild>
              <a href={chartUrl} target="_top">
                Open chart
              </a>
            </Button>
          )}
          {onForwardReminder && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onForwardReminder(reminder.id)}
            >
              Forward
            </Button>
          )}
        </div>
      </header>
      <p className="mb-0">{reminder.preview}</p>
    </>
  );
}
