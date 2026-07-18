import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmModal } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { initialsFromName } from '@components/patientBannerUtils';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Textarea } from '@components/ui/textarea';
import { Forward, Printer, Trash2, ExternalLink, SendHorizontal, Check, RotateCcw } from 'lucide-react';
import { printMessageThread } from './printMessageThread';
import { avatarColor } from './commAvatar';
import type { MessageDetail, ReminderListRow } from './communicationsTypes';
import { t } from '@core/i18n';

/** Square icon action for the reading-pane toolbar: 44px target, tooltip,
 *  accessible name, renders as a link when href is given. */
function IconAction({
  label,
  onClick,
  href,
  destructive = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  children: ReactNode;
}) {
  const className = `nc-comm-icon-action${destructive ? ' nc-comm-icon-action--danger' : ''}`;
  if (href) {
    return (
      <a className={className} href={href} target="_top" title={label} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  );
}

interface CommunicationsDetailProps {
  loading: boolean;
  error: string | null;
  message: MessageDetail | null;
  reminder: ReminderListRow | null;
  /** Replaces the default idle prompt (e.g. a selected reminder that is gone). */
  emptyText?: string;
  webroot: string;
  ajaxUrl?: string;
  csrfToken?: string;
  onReply?: (noteId: number) => void;
  onSendReply?: (noteId: number, body: string) => Promise<void> | void;
  onStatusChange?: (noteId: number, status: string) => void;
  onMarkDone?: (noteId: number) => void;
  onAssignPatient?: (noteId: number, pid: number) => void;
  onDelete?: (noteId: number) => void;
  onForwardReminder?: (reminderId: number) => void;
  onCompleteReminder?: (reminderId: number) => void;
  statusChanging?: boolean;
  assigningPatient?: boolean;
  replySending?: boolean;
}

export function CommunicationsDetail({
  loading,
  error,
  message,
  reminder,
  emptyText,
  webroot,
  ajaxUrl = '',
  csrfToken = '',
  onSendReply,
  onStatusChange,
  onMarkDone,
  onAssignPatient,
  onDelete,
  onForwardReminder,
  onCompleteReminder,
  statusChanging = false,
  assigningPatient = false,
  replySending = false,
}: CommunicationsDetailProps) {
  if (loading) {
    return <div className="nc-comm-detail-state text-[var(--oe-nc-text-muted)]"><em>{t('Loading…')}</em></div>;
  }
  if (error) {
    return <div className="nc-comm-detail-state text-[var(--oe-nc-danger,#dc2626)]">{error}</div>;
  }
  if (message) {
    return (
      <MessageDetailView
        detail={message}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        onSendReply={onSendReply}
        onStatusChange={onStatusChange}
        onMarkDone={onMarkDone}
        onAssignPatient={onAssignPatient}
        onDelete={onDelete}
        statusChanging={statusChanging}
        assigningPatient={assigningPatient}
        replySending={replySending}
      />
    );
  }
  if (reminder) {
    return (
      <ReminderDetailView
        reminder={reminder}
        webroot={webroot}
        onForwardReminder={onForwardReminder}
        onCompleteReminder={onCompleteReminder}
      />
    );
  }
  return (
    <div className="nc-comm-empty text-[var(--oe-nc-text-muted)]">
      <p className="mb-0">{emptyText ?? t('Select an item to read details.')}</p>
    </div>
  );
}

function MessageDetailView({
  detail,
  ajaxUrl,
  csrfToken,
  onSendReply,
  onStatusChange,
  onMarkDone,
  onAssignPatient,
  onDelete,
  statusChanging = false,
  assigningPatient = false,
  replySending = false,
}: {
  detail: MessageDetail;
  ajaxUrl: string;
  csrfToken: string;
  onSendReply?: (noteId: number, body: string) => Promise<void> | void;
  onStatusChange?: (noteId: number, status: string) => void;
  onMarkDone?: (noteId: number) => void;
  onAssignPatient?: (noteId: number, pid: number) => void;
  onDelete?: (noteId: number) => void;
  statusChanging?: boolean;
  assigningPatient?: boolean;
  replySending?: boolean;
}) {
  const [assignPid, setAssignPid] = useState<number | null>(null);
  const [assignName, setAssignName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    setAssignPid(null);
    setAssignName('');
    setReplyText('');
  }, [detail.id, detail.can_assign_patient]);

  const canSendReply = replyText.trim().length >= 2 && !replySending;
  const submitReply = async () => {
    if (!canSendReply || !onSendReply) {
      return;
    }
    await onSendReply(detail.id, replyText.trim());
    setReplyText('');
  };

  const isDone = detail.status === 'Done';
  // One clear action instead of a raw status dropdown: close an active message,
  // or reopen a done one. "Read" happens automatically when a message is opened.
  const doneToggle = isDone
    ? (detail.can_change_status && onStatusChange ? (
      <button
        type="button"
        className="nc-comm-done-toggle nc-comm-done-toggle--reopen"
        disabled={statusChanging}
        onClick={() => onStatusChange(detail.id, 'Read')}
      >
        <RotateCcw aria-hidden="true" />
        {t('Reopen')}
      </button>
    ) : null)
    : (detail.can_mark_done && onMarkDone ? (
      <button
        type="button"
        className="nc-comm-done-toggle"
        disabled={statusChanging}
        onClick={() => onMarkDone(detail.id)}
      >
        <Check aria-hidden="true" />
        {t('Mark done')}
      </button>
    ) : null);

  return (
    <>
      {/* One compact pinned header bar (artifact chat-thread-head): avatar ·
          name + meta · circular actions. The boxed patient banner is gone —
          identity lives in the bar itself. */}
      <header className="nc-comm-detail-header nc-comm-reader-head">
        <span
          className="nc-comm-avatar nc-comm-avatar--lg"
          style={{ background: avatarColor(detail.from_name || detail.patient_name || detail.type) }}
          aria-hidden="true"
        >
          {initialsFromName(detail.patient_name || detail.type || t('Message'))}
        </span>
        <div className="nc-comm-reader-head-main">
          <h2 className="nc-comm-reader-title">
            {detail.patient_name || detail.type || t('Message')}
            <span className="nc-comm-type-tag">{detail.type}</span>
            {isDone && <span className="nc-comm-done-badge">{t('Done')}</span>}
            {detail.patient_unassigned && !detail.can_assign_patient && (
              <Badge variant="warning" className="ml-2">{t('No patient')}</Badge>
            )}
          </h2>
          <div className="nc-comm-reader-meta">
            {detail.from_name} · {detail.date_display || detail.date}
          </div>
        </div>
        <div className="nc-comm-reader-actions">
          {doneToggle}
          {detail.chart_url && (
            <IconAction label={t('Open chart')} href={detail.chart_url}>
              <ExternalLink aria-hidden="true" />
            </IconAction>
          )}
          <IconAction label={t('Print')} onClick={() => printMessageThread(detail)}>
            <Printer aria-hidden="true" />
          </IconAction>
          {detail.can_delete && onDelete && (
            <IconAction label={t('Delete')} destructive onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 aria-hidden="true" />
            </IconAction>
          )}
        </div>
      </header>
      {detail.is_supervisory_read && detail.supervisory_banner && (
        <div className={deskCalloutClass('warn', 'nc-comm-detail-banner py-2 text-sm')}>
          {detail.supervisory_banner}
        </div>
      )}
      {detail.can_assign_patient && (
        <div className={deskCalloutClass('warn', 'nc-comm-orphan py-2')}>
          <p className="text-sm mb-2">
            <strong>{t('No patient linked.')}</strong> {t('Assign a patient to this message.')}
          </p>
          {assignPid ? (
            <div className="nc-comm-assign-row">
              <Badge variant="outline">
                {assignName || t('PID {pid}', { pid: String(assignPid) })}
              </Badge>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                disabled={assigningPatient}
                onClick={() => {
                  setAssignPid(null);
                  setAssignName('');
                }}
              >
                {t('Clear')}
              </Button>
              <Button
                type="button"
                variant="warning"
                size="sm"
                disabled={assigningPatient}
                onClick={() => onAssignPatient?.(detail.id, assignPid)}
              >
                {assigningPatient ? t('Assigning…') : t('Assign patient')}
              </Button>
            </div>
          ) : (
            <PatientSearchDropdown
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              inputId="nc-comm-assign-patient"
              resultsId="nc-comm-assign-patient-results"
              placeholder={t('Search by name, phone, NHIS, National ID, MRN')}
              onSelectPatient={(selectedPid, row) => {
                setAssignPid(selectedPid);
                setAssignName(row?.display_name ?? '');
              }}
            />
          )}
        </div>
      )}
      {detail.turns && detail.turns.length > 0 ? (
        <div className="nc-comm-chat" role="log" aria-label={t('Message thread')}>
          {detail.turns.map((turn, i) => {
            const day = turn.time_label.slice(0, 10);
            const prevDay = i > 0 ? detail.turns![i - 1].time_label.slice(0, 10) : '';
            const timeOnly = turn.time_label.slice(11) || turn.time_label;
            return (
              <div key={i}>
                {day && day !== prevDay && (
                  <div className="nc-comm-day-sep"><span>{day}</span></div>
                )}
                <div className={`nc-comm-bubble-row${turn.is_self ? ' is-self' : ''}`}>
                  <div className="nc-comm-bubble-col">
                    <div className="nc-comm-bubble">
                      {!turn.is_self && <span className="nc-comm-bubble-author">{turn.author}</span>}
                      <span className="nc-comm-bubble-text">{turn.text}</span>
                    </div>
                    {/* Timestamp sits under the bubble, outside it (chat convention). */}
                    {turn.time_label && <span className="nc-comm-msg-time">{timeOnly}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="nc-comm-message-card">
          <div
            className="nc-comm-thread"
            dangerouslySetInnerHTML={{ __html: detail.thread_html || '' }}
          />
        </div>
      )}

      {detail.can_reply && onSendReply && (
        <div className="nc-comm-composer-dock">
          <Textarea
            className="nc-comm-composer-input"
            rows={1}
            value={replyText}
            placeholder={t('Type a reply…')}
            aria-label={t('Reply')}
            disabled={replySending}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line (chat convention).
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submitReply();
              }
            }}
          />
          <button
            type="button"
            className="nc-comm-composer-send"
            aria-label={t('Send')}
            title={t('Send')}
            disabled={!canSendReply}
            onClick={() => { void submitReply(); }}
          >
            <SendHorizontal aria-hidden="true" />
          </button>
        </div>
      )}
      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={t('Delete message?')}
        modalId="nc-comm-delete-modal"
        confirmLabel={t('Delete')}
        confirmVariant="danger"
        onConfirm={() => {
          onDelete?.(detail.id);
          setDeleteConfirmOpen(false);
        }}
      >
        <p className="mb-0">{t('Delete this message? This cannot be undone.')}</p>
      </ConfirmModal>
    </>
  );
}

function ReminderDetailView({
  reminder,
  webroot,
  onForwardReminder,
  onCompleteReminder,
}: {
  reminder: ReminderListRow;
  webroot: string;
  onForwardReminder?: (reminderId: number) => void;
  onCompleteReminder?: (reminderId: number) => void;
}) {
  const chartUrl = reminder.pid
    ? `${webroot}/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid=${reminder.pid}`
    : null;

  // "Mark completed" sits in the reader header — same placement and style as
  // the message reader's done toggle (it used to hide in the page footer).
  const completeToggle = onCompleteReminder ? (
    <button
      type="button"
      className="nc-comm-done-toggle"
      onClick={() => onCompleteReminder(reminder.id)}
    >
      <Check aria-hidden="true" />
      {t('Mark completed')}
    </button>
  ) : null;

  return (
    <>
      <header className="nc-comm-detail-header nc-comm-reader-head">
        <span
          className="nc-comm-avatar nc-comm-avatar--lg"
          style={{ background: avatarColor(reminder.patient_name || reminder.from_name || t('Reminder')) }}
          aria-hidden="true"
        >
          {initialsFromName(reminder.patient_name || t('Reminder'))}
        </span>
        <div className="nc-comm-reader-head-main">
          <h2 className="nc-comm-reader-title">
            {reminder.patient_name || t('Reminder')}
            <span className={`nc-comm-urgency--${reminder.urgency} nc-comm-row-urgency`}>
              {reminder.urgency_label}
            </span>
          </h2>
          <div className="nc-comm-reader-meta">
            {t('Due {date} · From {sender}', {
              date: reminder.due_display || reminder.due_date,
              sender: reminder.from_name,
            })}
          </div>
        </div>
        <div className="nc-comm-reader-actions">
          {completeToggle}
          {chartUrl && (
            <IconAction label={t('Open chart')} href={chartUrl}>
              <ExternalLink aria-hidden="true" />
            </IconAction>
          )}
          {onForwardReminder && (
            <IconAction label={t('Forward')} onClick={() => onForwardReminder(reminder.id)}>
              <Forward aria-hidden="true" />
            </IconAction>
          )}
        </div>
      </header>
      <div className="nc-comm-message-card">
        <p className="mb-0">{reminder.preview}</p>
      </div>
    </>
  );
}
