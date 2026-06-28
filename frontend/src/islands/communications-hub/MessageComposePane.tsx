import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { oeFetch } from '@core/oeFetch';
import type { ComposeAttachment, ComposeOptions, ComposeReplySeed } from './communicationsTypes';

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
          setError(err instanceof Error ? err.message : 'Could not load compose form');
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
    setAssignedTo((prev) => (
      prev.includes(username)
        ? prev.filter((u) => u !== username)
        : [...prev, username]
    ));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const trimmedBody = body.trim();
    if (trimmedBody.length < 2) {
      setSubmitError('Message body must be at least 2 characters.');
      return;
    }

    if (!isReply && messageStatus !== 'Done' && assignedTo.length === 0) {
      setSubmitError('Select at least one recipient.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        body: trimmedBody,
        note_type: noteType || 'Unassigned',
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
      setSubmitError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-muted"><em>Loading compose form…</em></div>;
  }

  if (error) {
    return <div className="alert alert-danger py-2">{error}</div>;
  }

  return (
    <form className="oe-nc-comm-compose" onSubmit={(e) => { void handleSubmit(e); }}>
      <header className="oe-nc-comm-detail__header mb-3">
        <h2 className="h5 mb-0">{isReply ? 'Reply to message' : 'Compose message'}</h2>
      </header>

      {attachment && !isReply && (
        <div className="alert alert-info py-2 small mb-3">
          Attaching fax ID: {attachment.job_id || attachment.attachment_id}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="nc-comm-compose-type">Type</label>
        <select
          id="nc-comm-compose-type"
          className="form-control form-control-sm"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
        >
          <option value="">Unassigned</option>
          {(options?.note_types ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="nc-comm-compose-status">Status</label>
        <select
          id="nc-comm-compose-status"
          className="form-control form-control-sm"
          value={messageStatus}
          onChange={(e) => setMessageStatus(e.target.value)}
        >
          {(options?.message_statuses ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
          {!options?.message_statuses?.length && (
            <option value="New">New</option>
          )}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="nc-comm-compose-patient">Patient (optional)</label>
        {isReply ? (
          <input
            id="nc-comm-compose-patient"
            type="text"
            className="form-control form-control-sm"
            readOnly
            value={patientName || (pid ? `PID ${pid}` : 'No patient linked')}
          />
        ) : pid ? (
          <div className="d-flex align-items-center flex-wrap">
            <span
              id="nc-comm-compose-patient"
              className="badge badge-light border text-dark mr-2 mb-1 py-2 px-2"
            >
              {patientName || `PID ${pid}`}
            </span>
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
            inputId="nc-comm-compose-patient"
            resultsId="nc-comm-compose-patient-results"
            placeholder="Search by name, phone, NHIS, National ID, MRN"
            inputClassName="form-control form-control-sm"
            onSelectPatient={(selectedPid, row) => {
              setPid(selectedPid);
              setPatientName(row?.display_name ?? '');
            }}
          />
        )}
      </div>

      {!isReply && (
        <div className="form-group">
          <label>To</label>
          <div className="oe-nc-comm-compose-recipients border rounded p-2" style={{ maxHeight: '10rem', overflowY: 'auto' }}>
            {(options?.users ?? []).map((user) => (
              <div key={user.username} className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={`nc-comm-to-${user.username}`}
                  checked={assignedTo.includes(user.username)}
                  onChange={() => toggleAssignee(user.username)}
                />
                <label className="form-check-label small" htmlFor={`nc-comm-to-${user.username}`}>
                  {user.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {options?.show_due_date && (
        <div className="form-group">
          <label htmlFor="nc-comm-compose-due">Due date</label>
          <input
            id="nc-comm-compose-due"
            type="datetime-local"
            className="form-control form-control-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="nc-comm-compose-body">Message</label>
        <textarea
          id="nc-comm-compose-body"
          className="form-control"
          rows={5}
          required
          minLength={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {submitError && (
        <div className="alert alert-danger py-2">{submitError}</div>
      )}

      <div className="d-flex flex-wrap">
        <button type="submit" className="btn btn-primary btn-sm mr-2" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send'}
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
