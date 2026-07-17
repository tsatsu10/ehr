import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { identityFromLabels } from '@components/patientBannerUtils';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
import { X } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import type { ComposeAttachment, ComposeOptions, ComposeReplySeed } from './communicationsTypes';
import { t } from '@core/i18n';

const MIN_BODY_LENGTH = 2;
/** Show the recipient filter box once the staff list is long enough to scroll. */
const RECIPIENT_FILTER_THRESHOLD = 8;

interface MessageComposePaneProps {
  ajaxUrl: string;
  csrfToken: string;
  replyNoteId?: number | null;
  attachment?: ComposeAttachment | null;
  initialPid?: number | null;
  onCancel: () => void;
  onSent: (messageId: number) => void;
}

export function MessageComposePane({
  ajaxUrl,
  csrfToken,
  replyNoteId,
  attachment = null,
  initialPid = null,
  onCancel,
  onSent,
}: MessageComposePaneProps) {
  const [options, setOptions] = useState<ComposeOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [noteType, setNoteType] = useState('');
  const [messageStatus, setMessageStatus] = useState('New');
  const [pid, setPid] = useState<number | null>(null);
  const [patientName, setPatientName] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [bodyTouched, setBodyTouched] = useState(false);
  const [recipientsTouched, setRecipientsTouched] = useState(false);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const isReply = (replyNoteId ?? 0) > 0;

  const applySeed = (seed: ComposeReplySeed | null | undefined, defaultStatus: string) => {
    if (!seed) {
      setMessageStatus(defaultStatus || 'New');
      setNoteType('');
      setPid(null);
      setPatientName('');
      setAssignedTo([]);
      setBody('');
      return;
    }

    setNoteType(seed.note_type || '');
    setMessageStatus(seed.message_status || defaultStatus || 'New');
    setPid(seed.pid ?? null);
    setPatientName(seed.patient_name ?? '');
    setAssignedTo(seed.assigned_to ?? []);
    setBody('');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = {};
        if (replyNoteId && replyNoteId > 0) {
          params.reply_note_id = replyNoteId;
        }
        const data = await oeFetch<ComposeOptions>('communications.compose_options', {
          ...fetchOptions,
          params,
        });
        if (cancelled) return;

        setOptions(data);
        applySeed(data.reply, data.default_status);
        if (!data.reply && initialPid && initialPid > 0) {
          setPid(initialPid);
          setPatientName('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('Could not load compose form'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchOptions, replyNoteId, initialPid]);

  const toggleAssignee = (username: string) => {
    setRecipientsTouched(true);
    setAssignedTo((prev) => (
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username]
    ));
  };

  // Inline validation — errors compute live while typing; hints only show once
  // the field was touched (or a submit was attempted), values are never wiped.
  const bodyError = body.trim().length < MIN_BODY_LENGTH
    ? t('Message must be at least {min} characters.', { min: String(MIN_BODY_LENGTH) })
    : null;
  const recipientsError = !isReply && assignedTo.length === 0
    ? t('Select at least one recipient.')
    : null;
  const formValid = !bodyError && !recipientsError;

  const users = options?.users ?? [];
  const filterText = recipientFilter.trim().toLowerCase();
  const visibleUsers = filterText
    ? users.filter((user) => user.label.toLowerCase().includes(filterText))
    : users;
  const selectedUsers = users.filter((user) => assignedTo.includes(user.username));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setBodyTouched(true);
    setRecipientsTouched(true);
    if (!formValid) {
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        body: body.trim(),
        note_type: noteType || 'Unassigned',
        // The compose form no longer exposes a Status dropdown — a new
        // conversation is always the default status; done/reopen lives in
        // the reader.
        message_status: messageStatus || 'New',
        pid: pid ?? 0,
        assigned_to: assignedTo,
      };
      if (isReply && replyNoteId) {
        payload.reply_note_id = replyNoteId;
      }
      if (options?.show_due_date && dueDate) {
        payload.form_datetime = dueDate;
      }
      if (!isReply && attachment) {
        payload.attachment_id = attachment.attachment_id;
        payload.attachment_type = attachment.attachment_type;
      }

      const result = await oeFetch<{ id: number }>('communications.message_send', {
        ...fetchOptions,
        method: 'POST',
        json: payload,
      });
      onSent(result.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('Could not send message'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape' && !event.defaultPrevented && !submitting) {
      event.preventDefault();
      onCancel();
    }
  };

  if (loading) {
    return <div className="text-[var(--oe-nc-text-muted)]"><em>{t('Loading compose form…')}</em></div>;
  }

  if (error) {
    return <div className={deskCalloutClass('error', 'py-2')}>{error}</div>;
  }

  const patientIdentity = identityFromLabels(patientName, { pid: pid ?? undefined });

  return (
    <form className="nc-comm-compose" onSubmit={(e) => { void handleSubmit(e); }} onKeyDown={handleKeyDown}>
      <header className="nc-comm-detail-header nc-comm-compose-head">
        <h2 className="nc-comm-reader-title">{isReply ? t('Reply to message') : t('New message')}</h2>
        <p className="nc-comm-reader-meta">
          {isReply
            ? t('Your reply is added to the conversation.')
            : t('Starts a conversation with the staff you select.')}
        </p>
      </header>

      {attachment && !isReply && (
        <div className={deskCalloutClass('info', 'py-2 text-sm mb-3')}>
          {t('The received fax (job {id}) will be attached to this message.', {
            id: String(attachment.job_id || attachment.attachment_id),
          })}
        </div>
      )}

      {!isReply && (
        <div className="nc-form-group">
          <label className="nc-comm-field-label" id="nc-comm-compose-to-label">{t('To')}</label>
          {selectedUsers.length > 0 && (
            <div className="nc-comm-chip-row" aria-live="polite">
              {selectedUsers.map((user) => (
                <span className="nc-comm-chip" key={`sel-${user.username}`}>
                  {user.label}
                  <button
                    type="button"
                    className="nc-comm-chip-remove"
                    aria-label={t('Remove {name}', { name: user.label })}
                    onClick={() => toggleAssignee(user.username)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {users.length > RECIPIENT_FILTER_THRESHOLD && (
            <Input
              type="search"
              className="nc-comm-recipient-filter"
              placeholder={t('Filter staff…')}
              aria-label={t('Filter recipients')}
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
            />
          )}
          <div className="nc-comm-recipient-box" role="group" aria-labelledby="nc-comm-compose-to-label">
            {visibleUsers.map((user) => (
              <div className="nc-comm-check-row" key={user.username}>
                <input
                  type="checkbox"
                  className="nc-comm-check"
                  id={`nc-comm-to-${user.username}`}
                  checked={assignedTo.includes(user.username)}
                  onChange={() => toggleAssignee(user.username)}
                />
                <label htmlFor={`nc-comm-to-${user.username}`}>
                  {user.label}
                </label>
              </div>
            ))}
            {!visibleUsers.length && (
              <p className="nc-comm-recipient-empty">{t('No staff match this filter.')}</p>
            )}
          </div>
          {recipientsTouched && recipientsError && (
            <p className="nc-comm-field-error" role="alert">{recipientsError}</p>
          )}
        </div>
      )}

      <div className="nc-comm-form-row">
        <div className="nc-form-group">
          <label className="nc-comm-field-label" htmlFor="nc-comm-compose-type">{t('Type')}</label>
          <NativeSelect
            id="nc-comm-compose-type"
            className="h-8"
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
          >
            <option value="">{t('Unassigned')}</option>
            {(options?.note_types ?? []).map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </NativeSelect>
        </div>
        {options?.show_due_date && (
          <div className="nc-form-group">
            <label className="nc-comm-field-label" htmlFor="nc-comm-compose-due">{t('Due date')}</label>
            <Input
              id="nc-comm-compose-due"
              type="datetime-local"
              className="h-8"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="nc-form-group">
        <label className="nc-comm-field-label" htmlFor="nc-comm-compose-patient">{t('Patient (optional)')}</label>
        {isReply && patientIdentity ? (
          <PatientContextBanner layout="compact" identity={patientIdentity} />
        ) : isReply ? (
          <Input
            id="nc-comm-compose-patient"
            type="text"
            className="h-8"
            readOnly
            value={patientName || (pid ? t('PID {pid}', { pid: String(pid) }) : t('No patient linked'))}
          />
        ) : patientIdentity ? (
          <>
            <PatientContextBanner layout="compact" identity={patientIdentity} />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1"
              onClick={() => {
                setPid(null);
                setPatientName('');
              }}
            >
              {t('Clear patient')}
            </Button>
          </>
        ) : (
          <PatientSearchDropdown
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            inputId="nc-comm-compose-patient"
            resultsId="nc-comm-compose-patient-results"
            placeholder={t('Search by name, phone, NHIS, National ID, MRN')}
            onSelectPatient={(selectedPid, row) => {
              setPid(selectedPid);
              setPatientName(row?.display_name ?? '');
            }}
          />
        )}
      </div>

      <div className="nc-form-group">
        <label className="nc-comm-field-label" htmlFor="nc-comm-compose-body">{t('Message')}</label>
        <Textarea
          id="nc-comm-compose-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => setBodyTouched(true)}
        />
        {bodyTouched && bodyError && (
          <p className="nc-comm-field-error" role="alert">{bodyError}</p>
        )}
      </div>

      {submitError && (
        <div className={deskCalloutClass('error', 'py-2 mb-3')} role="alert">{submitError}</div>
      )}

      <div className="nc-comm-compose-actions">
        <Button type="submit" disabled={submitting || !formValid}>
          {submitting ? t('Sending…') : t('Send')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t('Cancel')}
        </Button>
      </div>
    </form>
  );
}
