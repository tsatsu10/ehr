/**
 * TriageUrgencyControl — nurse-side urgency escalation on the active pane.
 *
 * Escalating (not urgent → urgent) is one click, reason optional — speed matters most in the
 * direction that protects the patient. De-escalating (urgent → not urgent) requires a reason —
 * removing a safety flag is the riskier direction. Never changes visit state (workflows §12.2:
 * "urgent alone must not skip triage").
 */

import { useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { deskCalloutClass } from '@components/deskCalloutStyles';

interface TriageUrgencyControlProps {
  isUrgent: boolean;
  submitting: boolean;
  error: string | null;
  onSetUrgency: (isUrgent: boolean, reason?: string) => void;
}

function ReasonField({
  id,
  required,
  value,
  onChange,
}: {
  id: string;
  required: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <Label htmlFor={id} className="normal-case">Reason ({required ? 'required' : 'optional'})</Label>
      <Textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

function UrgencyError({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className={deskCalloutClass('error', 'text-sm')} role="alert">{error}</div>;
}

export function TriageUrgencyControl({
  isUrgent,
  submitting,
  error,
  onSetUrgency,
}: TriageUrgencyControlProps) {
  const [reason, setReason] = useState('');
  const [reasonOpen, setReasonOpen] = useState(false);
  const reasonFieldId = isUrgent ? 'nc-triage-urgency-reason-remove' : 'nc-triage-urgency-reason-add';

  if (isUrgent) {
    if (!reasonOpen) {
      return (
        <div className="nc-triage-urgency-control flex items-center gap-2 flex-wrap">
          <Badge variant="danger">Urgent</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => setReasonOpen(true)}
          >
            Remove urgent flag
          </Button>
        </div>
      );
    }

    return (
      <div className="nc-triage-urgency-control space-y-1.5">
        <div className="flex items-center gap-2">
          <Badge variant="danger">Urgent</Badge>
          <span className="text-sm text-[var(--oe-nc-text-muted)]">Removing requires a reason</span>
        </div>
        <ReasonField id={reasonFieldId} required value={reason} onChange={setReason} />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="warning"
            size="sm"
            disabled={submitting || reason.trim() === ''}
            onClick={() => onSetUrgency(false, reason.trim())}
          >
            {submitting ? 'Removing…' : 'Confirm removal'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => { setReasonOpen(false); setReason(''); }}
          >
            Cancel
          </Button>
        </div>
        <UrgencyError error={error} />
      </div>
    );
  }

  return (
    <div className="nc-triage-urgency-control space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={submitting}
          onClick={() => onSetUrgency(true, reason.trim() || undefined)}
        >
          {submitting ? 'Marking urgent…' : 'Mark urgent'}
        </Button>
        {!reasonOpen && (
          <button
            type="button"
            className="text-sm underline text-[var(--oe-nc-text-muted)]"
            onClick={() => setReasonOpen(true)}
          >
            Add reason
          </button>
        )}
      </div>
      {reasonOpen && (
        <ReasonField id={reasonFieldId} required={false} value={reason} onChange={setReason} />
      )}
      <UrgencyError error={error} />
    </div>
  );
}
