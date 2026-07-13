import { useEffect, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import { Textarea } from '@components/ui/textarea';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { oeFetch } from '@core/oeFetch';

interface FollowUpFlagModalProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  onClose: () => void;
}

/** Default due date = today + 14 days, as YYYY-MM-DD (local). */
function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * G5 — "Flag for follow-up". Creates a recall of type `follow_up` in the existing
 * S1 Recalls worklist (via scheduling.recalls.flag_follow_up), rather than a
 * parallel follow-up store. The clinic works the follow-up from the Recalls lens.
 */
export function FollowUpFlagModal({ open, ajaxUrl, csrfToken, pid, onClose }: FollowUpFlagModalProps) {
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setDueDate(defaultDueDate());
    setReason('');
    setError(null);
    setSaving(false);
  }, [open]);

  const canSave = dueDate.trim() !== '' && !saving;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await oeFetch('scheduling.recalls.flag_follow_up', {
        method: 'POST',
        ajaxUrl,
        csrfToken,
        json: { pid, due_date: dueDate, reason: reason.trim() },
      });
      showDeskToast('Patient flagged for follow-up. It is now in the Recalls worklist.', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not flag for follow-up.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-chart-followup-modal"
        className={dialogContentSizeClass.sm}
        aria-labelledby="nc-chart-followup-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-chart-followup-title">Flag for follow-up</DialogTitle>
          <DialogClose id="nc-chart-followup-close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3">
            Adds this patient to the Recalls worklist so the front desk can call them back.
          </p>
          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-chart-followup-date">Follow-up by</Label>
            <Input
              type="date"
              id="nc-chart-followup-date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-chart-followup-reason">Reason (optional)</Label>
            <Textarea
              id="nc-chart-followup-reason"
              rows={3}
              placeholder="e.g. Recheck blood pressure, review lab results"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && (
            <div className={deskCalloutClass('error', 'text-sm')} id="nc-chart-followup-error" role="alert">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" id="nc-chart-followup-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            id="nc-chart-followup-save"
            disabled={!canSave}
            onClick={() => { void submit(); }}
          >
            {saving ? 'Flagging…' : 'Flag for follow-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
