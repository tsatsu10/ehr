import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { PatientSearchDropdown } from '@components/PatientSearchDropdown';
import { identityFromLabels } from '@components/patientBannerUtils';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
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
    return <div className="text-[var(--oe-nc-text-muted)]"><em>Loading compose form…</em></div>;
  }

  if (error) {
    return <div className={deskCalloutClass('error', 'py-2')}>{error}</div>;
  }

  const patientIdentity = identityFromLabels(patientName, { pid: pid ?? undefined });

  return (
    <form className="nc-comm-compose" onSubmit={(e) => { void handleSubmit(e); }}>
      <header className="nc-comm-detail-header mb-3">
        <h2 className="text-lg font-semibold mb-0">{isReply ? 'Reply to message' : 'Compose message'}</h2>
      </header>

      {attachment && !isReply && (
        <div className={deskCalloutClass('info', 'py-2 text-sm mb-3')}>
          Attaching fax ID: {attachment.job_id || attachment.attachment_id}
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        <Label htmlFor="nc-comm-compose-type" className="normal-case">Type</Label>
        <NativeSelect
          id="nc-comm-compose-type"
          className="h-8"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
        >
          <option value="">Unassigned</option>
          {(options?.note_types ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5 mb-3">
        <Label htmlFor="nc-comm-compose-status" className="normal-case">Status</Label>
        <NativeSelect
          id="nc-comm-compose-status"
          className="h-8"
          value={messageStatus}
          onChange={(e) => setMessageStatus(e.target.value)}
        >
          {(options?.message_statuses ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
          {!options?.message_statuses?.length && (
            <option value="New">New</option>
          )}
        </NativeSelect>
      </div>

      <div className="space-y-1.5 mb-3">
        <Label htmlFor="nc-comm-compose-patient" className="normal-case">Patient (optional)</Label>
        {isReply && patientIdentity ? (
          <PatientContextBanner layout="compact" identity={patientIdentity} />
        ) : isReply ? (
          <Input
            id="nc-comm-compose-patient"
            type="text"
            className="h-8"
            readOnly
            value={patientName || (pid ? `PID ${pid}` : 'No patient linked')}
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
              Clear patient
            </Button>
          </>
        ) : (
          <PatientSearchDropdown
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            inputId="nc-comm-compose-patient"
            resultsId="nc-comm-compose-patient-results"
            placeholder="Search by name, phone, NHIS, National ID, MRN"
            onSelectPatient={(selectedPid, row) => {
              setPid(selectedPid);
              setPatientName(row?.display_name ?? '');
            }}
          />
        )}
      </div>

      {!isReply && (
        <div className="nc-form-group">
          <label>To</label>
          <div className="nc-comm-compose-recipients border rounded p-2" style={{ maxHeight: '10rem', overflowY: 'auto' }}>
            {(options?.users ?? []).map((user) => (
              <div key={user.username} className="flex items-center gap-2 mb-1">
                <Checkbox
                  id={`nc-comm-to-${user.username}`}
                  checked={assignedTo.includes(user.username)}
                  onCheckedChange={() => toggleAssignee(user.username)}
                />
                <Label htmlFor={`nc-comm-to-${user.username}`} className="font-normal normal-case cursor-pointer mb-0">
                  {user.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {options?.show_due_date && (
        <div className="space-y-1.5 mb-3">
          <Label htmlFor="nc-comm-compose-due" className="normal-case">Due date</Label>
          <Input
            id="nc-comm-compose-due"
            type="datetime-local"
            className="h-8"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        <Label htmlFor="nc-comm-compose-body" className="normal-case">Message</Label>
        <Textarea
          id="nc-comm-compose-body"
          rows={5}
          required
          minLength={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {submitError && (
        <div className={deskCalloutClass('error', 'py-2 mb-3')}>{submitError}</div>
      )}

      <div className="flex flex-wrap">
        <Button type="submit" size="sm" className="mr-2" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
