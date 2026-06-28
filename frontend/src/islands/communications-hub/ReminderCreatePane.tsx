import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { oeFetch } from '@core/oeFetch';
import type { ReminderCreateOptions } from './communicationsTypes';
import { dueDateFromPreset, todayIsoDate } from './reminderDateUtils';

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
          setError(err instanceof Error ? err.message : 'Could not load reminder form');
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
    setSendTo((prev) => (
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    ));
  };

  const selectAllRecipients = () => {
    if (!options?.recipients.length) {
      return;
    }
    setSendTo(options.recipients.map((row) => row.id));
  };

  const handlePresetChange = (key: string) => {
    setPresetKey(key);
    if (!key) {
      return;
    }
    const nextDate = dueDateFromPreset(key);
    if (nextDate) {
      setDueDate(nextDate);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > maxLength) {
      setSubmitError(`Message must be 1–${maxLength} characters.`);
      return;
    }
    if (sendTo.length === 0) {
      setSubmitError('Select at least one recipient.');
      return;
    }
    if (!dueDate) {
      setSubmitError('Due date is required.');
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
      setSubmitError(err instanceof Error ? err.message : 'Could not create reminder');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-muted"><em>Loading reminder form…</em></div>;
  }

  if (error) {
    return <div className="text-danger">{error}</div>;
  }

  return (
    <form className="oe-nc-comm-reminder-create" onSubmit={(event) => { void handleSubmit(event); }}>
      <header className="oe-nc-comm-detail__header mb-3">
        <h2 className="h5 mb-0">{isForward ? 'Forward reminder' : 'Create reminder'}</h2>
      </header>

      <div className="form-group">
        <label className="d-block">Link to patient</label>
        {pid && patientName ? (
          <div className="d-flex align-items-center flex-wrap">
            <span className="badge badge-light border text-dark mr-2 mb-1 py-2 px-2">{patientName}</span>
            <button
              type="button"
              className="btn btn-link btn-sm p-0 mb-1"
              onClick={() => {
                setPid(null);
                setPatientName('');
              }}
            >
              Clear
            </button>
          </div>
        ) : (
          <PatientSearchDropdown
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            inputId="nc-reminder-patient"
            resultsId="nc-reminder-patient-results"
            placeholder="Search by name, phone, NHIS, National ID, MRN"
            inputClassName="form-control form-control-sm"
            onSelectPatient={(selectedPid, row) => {
              setPid(selectedPid);
              setPatientName(row?.display_name ?? '');
            }}
          />
        )}
      </div>

      <div className="form-group">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <label className="mb-0">Send to</label>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={selectAllRecipients}>
            Select all
          </button>
        </div>
        <div className="border rounded p-2" style={{ maxHeight: '10rem', overflowY: 'auto' }}>
          {(options?.recipients ?? []).map((recipient) => (
            <div className="form-check" key={recipient.id}>
              <input
                type="checkbox"
                className="form-check-input"
                id={`nc-reminder-to-${recipient.id}`}
                checked={sendTo.includes(recipient.id)}
                onChange={() => toggleRecipient(recipient.id)}
              />
              <label className="form-check-label small" htmlFor={`nc-reminder-to-${recipient.id}`}>
                {recipient.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <div className="custom-control custom-checkbox">
          <input
            type="checkbox"
            className="custom-control-input"
            id="nc-reminder-send-separately"
            checked={sendSeparately}
            onChange={(event) => setSendSeparately(event.target.checked)}
          />
          <label className="custom-control-label small" htmlFor="nc-reminder-send-separately">
            Each recipient must mark their own copy completed
          </label>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group col-md-6">
          <label htmlFor="nc-reminder-due-date">Due date</label>
          <input
            type="date"
            className="form-control form-control-sm"
            id="nc-reminder-due-date"
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
              setPresetKey('');
            }}
            required
          />
        </div>
        <div className="form-group col-md-6">
          <label htmlFor="nc-reminder-preset">Or select a time span</label>
          <select
            className="form-control form-control-sm"
            id="nc-reminder-preset"
            value={presetKey}
            onChange={(event) => handlePresetChange(event.target.value)}
          >
            <option value="">— Select —</option>
            {(options?.date_presets ?? []).map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="form-group">
        <legend className="small font-weight-bold">Priority</legend>
        {(options?.priorities ?? []).map((item) => (
          <div className="custom-control custom-radio custom-control-inline" key={item.id}>
            <input
              type="radio"
              className="custom-control-input"
              id={`nc-reminder-priority-${item.id}`}
              name="nc-reminder-priority"
              value={item.id}
              checked={priority === item.id}
              onChange={() => setPriority(item.id)}
            />
            <label className="custom-control-label" htmlFor={`nc-reminder-priority-${item.id}`}>
              {item.label}
            </label>
          </div>
        ))}
      </fieldset>

      <div className="form-group">
        <label htmlFor="nc-reminder-message">Message</label>
        <textarea
          className="form-control"
          id="nc-reminder-message"
          rows={4}
          maxLength={maxLength}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        <small className="text-muted">{message.length}/{maxLength}</small>
      </div>

      {submitError && <div className="alert alert-danger py-2">{submitError}</div>}

      <div className="d-flex flex-wrap">
        <button type="submit" className="btn btn-primary btn-sm mr-2" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reminder'}
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
