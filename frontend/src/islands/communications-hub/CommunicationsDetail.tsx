import { useEffect, useState } from 'react';
import { ConfirmModal } from '@components/ConfirmModal';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
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
    return <div className="text-muted"><em>Loading…</em></div>;
  }
  if (error) {
    return <div className="text-danger">{error}</div>;
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
    <div className="oe-nc-comm-empty text-muted">
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
    <select
      id="nc-comm-detail-status"
      className="form-control form-control-sm d-inline-block w-auto ml-1"
      value={detail.status || ''}
      disabled={statusChanging}
      aria-label="Message status"
      onChange={(e) => onStatusChange?.(detail.id, e.target.value)}
    >
      {(detail.message_statuses ?? []).map((opt) => (
        <option key={opt.id} value={opt.id}>{opt.label}</option>
      ))}
    </select>
  ) : (
    <span>{detail.status || ''}</span>
  );

  return (
    <>
      {detail.is_supervisory_read && detail.supervisory_banner && (
        <div className="alert alert-warning oe-nc-comm-detail__banner py-2 small">
          {detail.supervisory_banner}
        </div>
      )}
      {detail.can_assign_patient && (
        <div className="alert alert-warning oe-nc-comm-orphan py-2">
          <p className="small mb-2 mb-md-1">
            <strong>No patient linked.</strong> Assign a patient to this message.
          </p>
          {assignPid ? (
            <div className="d-flex flex-wrap align-items-center">
              <span className="badge badge-light border text-dark mr-2 mb-1 py-2 px-2">
                {assignName || `PID ${assignPid}`}
              </span>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 mr-2 mb-1"
                disabled={assigningPatient}
                onClick={() => {
                  setAssignPid(null);
                  setAssignName('');
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-warning btn-sm mb-1"
                disabled={assigningPatient}
                onClick={() => onAssignPatient?.(detail.id, assignPid)}
              >
                {assigningPatient ? 'Assigning…' : 'Assign patient'}
              </button>
            </div>
          ) : (
            <PatientSearchDropdown
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              inputId="nc-comm-assign-patient"
              resultsId="nc-comm-assign-patient-results"
              placeholder="Search by name, phone, NHIS, National ID, MRN"
              inputClassName="form-control form-control-sm"
              onSelectPatient={(selectedPid, row) => {
                setAssignPid(selectedPid);
                setAssignName(row?.display_name ?? '');
              }}
            />
          )}
        </div>
      )}
      <header className="oe-nc-comm-detail__header">
        <h2 className="h5 mb-1">
          {detail.patient_name || detail.type || 'Message'}
          {detail.patient_unassigned && !detail.can_assign_patient && (
            <span className="badge badge-warning ml-2">No patient</span>
          )}
        </h2>
        <div className="text-muted small mb-2">
          {detail.from_name} · {detail.date_display || detail.date}
        </div>
        <div className="small mb-2">
          <strong>Type:</strong> {detail.type} · <strong>Status:</strong> {statusControl}
        </div>
        <div className="mb-2">
          {detail.chart_url && (
            <a className="btn btn-outline-primary btn-sm mr-1" href={detail.chart_url} target="_top">
              Open chart
            </a>
          )}
          {detail.can_reply && onReply && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onReply(detail.id)}
            >
              Reply
            </button>
          )}
          {detail.can_reply && !onReply && detail.legacy_reply_url && (
            <a className="btn btn-primary btn-sm" href={detail.legacy_reply_url} target="_top">
              Reply
            </a>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm ml-1"
            onClick={() => printMessageThread(detail)}
          >
            Print
          </button>
          {detail.can_delete && onDelete && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm ml-1"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </button>
          )}
        </div>
      </header>
      <div
        className="oe-nc-comm-thread"
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

  return (
    <>
      <header className="oe-nc-comm-detail__header">
        <h2 className="h5 mb-1">{reminder.patient_name || 'Reminder'}</h2>
        <div className="text-muted small mb-2">
          <span className={`oe-nc-comm-urgency--${reminder.urgency}`}>
            {reminder.urgency_label}
          </span>
          {' · '}
          {reminder.due_display || reminder.due_date}
        </div>
        <div className="small mb-2"><strong>From:</strong> {reminder.from_name}</div>
        <div className="mb-2">
          {chartUrl && (
            <a className="btn btn-outline-primary btn-sm mr-1" href={chartUrl} target="_top">
              Open chart
            </a>
          )}
          {onForwardReminder && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => onForwardReminder(reminder.id)}
            >
              Forward
            </button>
          )}
        </div>
      </header>
      <p className="mb-0">{reminder.preview}</p>
    </>
  );
}
