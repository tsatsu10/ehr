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
    return <div className="text-[var(--oe-nc-text-muted)]"><em>Loading reminder form…</em></div>;
  }

  if (error) {
    return <div className="text-[var(--oe-nc-danger,#dc2626)]">{error}</div>;
  }

  const patientIdentity = identityFromLabels(patientName, { pid: pid ?? undefined });

  return (
    <form className="nc-comm-reminder-create" onSubmit={(event) => { void handleSubmit(event); }}>
      <header className="nc-comm-detail-header mb-3">
        <h2 className="text-lg font-semibold mb-0">{isForward ? 'Forward reminder' : 'Create reminder'}</h2>
      </header>

      <div className="nc-form-group">
        <label className="block">Link to patient</label>
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
              Clear patient
            </Button>
          </>
        ) : (
          <PatientSearchDropdown
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            inputId="nc-reminder-patient"
            resultsId="nc-reminder-patient-results"
            placeholder="Search by name, phone, NHIS, National ID, MRN"
            onSelectPatient={(selectedPid, row) => {
              setPid(selectedPid);
              setPatientName(row?.display_name ?? '');
            }}
          />
        )}
      </div>

      <div className="nc-form-group">
        <div className="flex justify-between items-center mb-1">
          <label className="mb-0">Send to</label>
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={selectAllRecipients}>
            Select all
          </Button>
        </div>
        <div className="border rounded p-2" style={{ maxHeight: '10rem', overflowY: 'auto' }}>
          {(options?.recipients ?? []).map((recipient) => (
            <div className="flex items-center gap-2 mb-1" key={recipient.id}>
              <Checkbox
                id={`nc-reminder-to-${recipient.id}`}
                checked={sendTo.includes(recipient.id)}
                onCheckedChange={() => toggleRecipient(recipient.id)}
              />
              <Label htmlFor={`nc-reminder-to-${recipient.id}`} className="font-normal normal-case cursor-pointer mb-0">
                {recipient.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Checkbox
          id="nc-reminder-send-separately"
          checked={sendSeparately}
          onCheckedChange={(checked) => setSendSeparately(checked === true)}
        />
        <Label htmlFor="nc-reminder-send-separately" className="font-normal normal-case cursor-pointer mb-0">
          Each recipient must mark their own copy completed
        </Label>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="nc-form-group col-span-12 md:col-span-6 space-y-1.5">
          <Label htmlFor="nc-reminder-due-date" className="normal-case">Due date</Label>
          <Input
            type="date"
            className="h-8"
            id="nc-reminder-due-date"
            value={dueDate}
            onChange={(event) => {
              setDueDate(event.target.value);
              setPresetKey('');
            }}
            required
          />
        </div>
        <div className="nc-form-group col-span-12 md:col-span-6 space-y-1.5">
          <Label htmlFor="nc-reminder-preset" className="normal-case">Or select a time span</Label>
          <NativeSelect
            className="h-8"
            id="nc-reminder-preset"
            value={presetKey}
            onChange={(event) => handlePresetChange(event.target.value)}
          >
            <option value="">— Select —</option>
            {(options?.date_presets ?? []).map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="nc-form-group">
        <legend className="text-sm font-bold">Priority</legend>
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

      <div className="space-y-1.5 mb-3">
        <Label htmlFor="nc-reminder-message" className="normal-case">Message</Label>
        <Textarea
          id="nc-reminder-message"
          rows={4}
          maxLength={maxLength}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">{message.length}/{maxLength}</p>
      </div>

      {submitError && <div className={deskCalloutClass('error', 'py-2 mb-3')}>{submitError}</div>}

      <div className="flex flex-wrap">
        <Button type="submit" size="sm" className="mr-2" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reminder'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
