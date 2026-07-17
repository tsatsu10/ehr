import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { identityFromLabels } from '@components/patientBannerUtils';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Textarea } from '@components/ui/textarea';
import { oeFetch } from '@core/oeFetch';
import type { ReminderCreateOptions } from './communicationsTypes';
import { dueDateFromPreset, todayIsoDate } from './reminderDateUtils';
import { t } from '@core/i18n';

interface ReminderCreatePaneProps {
  ajaxUrl: string;
  csrfToken: string;
  forwardReminderId?: number | null;
  onCancel: () => void;
  onCreated: () => void;
}

export function ReminderCreatePane({
  ajaxUrl,
  csrfToken,
  forwardReminderId = null,
  onCancel,
  onCreated,
}: ReminderCreatePaneProps) {
  const [options, setOptions] = useState<ReminderCreateOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sendTo, setSendTo] = useState<number[]>([]);
  const [pid, setPid] = useState<number | null>(null);
  const [patientName, setPatientName] = useState('');
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [presetKey, setPresetKey] = useState('');
  const [priority, setPriority] = useState(3);
  const [message, setMessage] = useState('');
  const [sendSeparately, setSendSeparately] = useState(false);
  const [messageTouched, setMessageTouched] = useState(false);
  const [recipientsTouched, setRecipientsTouched] = useState(false);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const maxLength = options?.max_message_length ?? 160;
  const isForward = (forwardReminderId ?? 0) > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = {};
        if (forwardReminderId && forwardReminderId > 0) {
          params.forward_reminder_id = forwardReminderId;
        }
        const data = await oeFetch<ReminderCreateOptions>('communications.reminder_create_options', {
          ...fetchOptions,
          params,
        });
        if (cancelled) {
          return;
        }

        setOptions(data);
        const seed = data.forward;
        const selfId = data.recipients.find((row) => row.is_self)?.id;
        setSendTo(selfId ? [selfId] : []);
        setPriority(seed?.priority ?? data.default_priority ?? 3);
        setMessage(seed?.message ?? '');
        setDueDate(seed?.due_date ?? todayIsoDate());
        setPid(seed?.pid ?? null);
        setPatientName(seed?.patient_name ?? '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('Could not load reminder form'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchOptions, forwardReminderId]);

  const toggleRecipient = (id: number) => {
    setRecipientsTouched(true);
    setSendTo((prev) => (
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    ));
  };

  const selectAllRecipients = () => {
    if (!options?.recipients.length) {
      return;
    }
    setRecipientsTouched(true);
    setSendTo(options.recipients.map((row) => row.id));
  };

  const applyPreset = (key: string) => {
    setPresetKey(key);
    const nextDate = dueDateFromPreset(key);
    if (nextDate) {
      setDueDate(nextDate);
    }
  };

  // Inline validation — live errors, shown once the field was touched (or a
  // submit was attempted); the form never wipes on error.
  const trimmed = message.trim();
  const messageError = trimmed.length === 0
    ? t('Message is required.')
    : trimmed.length > maxLength
      ? t('Message must be at most {max} characters.', { max: String(maxLength) })
      : null;
  const recipientsError = sendTo.length === 0 ? t('Select at least one recipient.') : null;
  const dueDateError = !dueDate ? t('Due date is required.') : null;
  const formValid = !messageError && !recipientsError && !dueDateError;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setMessageTouched(true);
    setRecipientsTouched(true);
    if (!formValid) {
      return;
    }

    setSubmitting(true);
    try {
      await oeFetch('communications.reminder_create', {
        ...fetchOptions,
        method: 'POST',
        json: {
          send_to: sendTo,
          pid: pid ?? 0,
          due_date: dueDate,
          priority,
          message: trimmed,
          send_separately: sendSeparately,
        },
      });
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('Could not create reminder'));
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
    return <div className="text-[var(--oe-nc-text-muted)]"><em>{t('Loading reminder form…')}</em></div>;
  }

  if (error) {
    return <div className={deskCalloutClass('error', 'py-2')}>{error}</div>;
  }

  const patientIdentity = identityFromLabels(patientName, { pid: pid ?? undefined });

  return (
    <form className="nc-comm-reminder-create" onSubmit={(event) => { void handleSubmit(event); }} onKeyDown={handleKeyDown}>
      <header className="nc-comm-detail-header nc-comm-compose-head">
        <h2 className="nc-comm-reader-title">{isForward ? t('Forward reminder') : t('Create reminder')}</h2>
        <p className="nc-comm-reader-meta">
          {t('A dated task that appears in the recipients’ reminder list until completed.')}
        </p>
      </header>

      <div className="nc-form-group">
        <label className="nc-comm-field-label">{t('Link to patient')}</label>
        {patientIdentity ? (
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
            inputId="nc-reminder-patient"
            resultsId="nc-reminder-patient-results"
            placeholder={t('Search by name, phone, NHIS, National ID, MRN')}
            onSelectPatient={(selectedPid, row) => {
              setPid(selectedPid);
              setPatientName(row?.display_name ?? '');
            }}
          />
        )}
      </div>

      <div className="nc-form-group">
        <div className="flex justify-between items-center mb-1">
          <label className="nc-comm-field-label mb-0" id="nc-reminder-to-label">{t('Send to')}</label>
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={selectAllRecipients}>
            {t('Select all')}
          </Button>
        </div>
        <div className="nc-comm-recipient-box" role="group" aria-labelledby="nc-reminder-to-label">
          {(options?.recipients ?? []).map((recipient) => (
            <div className="nc-comm-check-row" key={recipient.id}>
              <input
                type="checkbox"
                className="nc-comm-check"
                id={`nc-reminder-to-${recipient.id}`}
                checked={sendTo.includes(recipient.id)}
                onChange={() => toggleRecipient(recipient.id)}
              />
              <label htmlFor={`nc-reminder-to-${recipient.id}`}>
                {recipient.label}
              </label>
            </div>
          ))}
        </div>
        {recipientsTouched && recipientsError && (
          <p className="nc-comm-field-error" role="alert">{recipientsError}</p>
        )}
      </div>

      <div className="nc-comm-check-row mb-3">
        <input
          type="checkbox"
          className="nc-comm-check"
          id="nc-reminder-send-separately"
          checked={sendSeparately}
          onChange={(event) => setSendSeparately(event.target.checked)}
        />
        <label htmlFor="nc-reminder-send-separately">
          {t('Each recipient must mark their own copy completed')}
        </label>
      </div>

      <div className="nc-form-group">
        <label className="nc-comm-field-label" htmlFor="nc-reminder-due-date">{t('Due date')}</label>
        <div className="nc-comm-due-row">
          <Input
            type="date"
            className="h-8 nc-comm-due-input"
            id="nc-reminder-due-date"
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
              setPresetKey('');
            }}
            required
          />
          {/* Quick spans as chips (was a "— Select —" dropdown). */}
          <div className="nc-comm-preset-chips" role="group" aria-label={t('Quick due dates')}>
            {(options?.date_presets ?? []).map((preset) => (
              <button
                type="button"
                key={preset.key}
                className={`nc-comm-preset-chip${presetKey === preset.key ? ' is-active' : ''}`}
                aria-pressed={presetKey === preset.key}
                onClick={() => applyPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        {dueDateError && (
          <p className="nc-comm-field-error" role="alert">{dueDateError}</p>
        )}
      </div>

      <div className="nc-form-group">
        <span className="nc-comm-field-label" id="nc-reminder-priority-label">{t('Priority')}</span>
        <div className="nc-radio-pills" role="radiogroup" aria-labelledby="nc-reminder-priority-label">
          {(options?.priorities ?? []).map((item) => (
            <label className="nc-radio-pill" key={item.id}>
              <input
                type="radio"
                name="nc-reminder-priority"
                value={item.id}
                checked={priority === item.id}
                onChange={() => setPriority(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="nc-form-group">
        <label className="nc-comm-field-label" htmlFor="nc-reminder-message">{t('Message')}</label>
        <Textarea
          id="nc-reminder-message"
          rows={4}
          maxLength={maxLength}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onBlur={() => setMessageTouched(true)}
        />
        <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">{message.length}/{maxLength}</p>
        {messageTouched && messageError && (
          <p className="nc-comm-field-error" role="alert">{messageError}</p>
        )}
      </div>

      {submitError && <div className={deskCalloutClass('error', 'py-2 mb-3')} role="alert">{submitError}</div>}

      <div className="nc-comm-compose-actions">
        <Button type="submit" disabled={submitting || !formValid}>
          {submitting ? t('Sending…') : t('Send reminder')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t('Cancel')}
        </Button>
      </div>
    </form>
  );
}
