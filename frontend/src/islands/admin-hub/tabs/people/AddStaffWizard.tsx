import { useEffect, useState } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
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
import { oeFetch } from '@core/oeFetch';
import type { RoleTemplate, TemplateReviewItem } from '../../peopleTypes';
import { PeopleInfoCallout, PeopleWarningCallout } from '../../peopleUi';

const STEPS = ['Identity', 'Role', 'Review', 'Done'] as const;

interface AddStaffWizardProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  onClose: () => void;
  onCreated: () => void;
}

export function AddStaffWizard({
  open,
  ajaxUrl,
  csrfToken,
  facilityId,
  onClose,
  onCreated,
}: AddStaffWizardProps) {
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [fname, setFname] = useState('');
  const [lname, setLname] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [templateId, setTemplateId] = useState('reception');
  const [isLead, setIsLead] = useState(false);
  const [promoteReason, setPromoteReason] = useState('');
  const [review, setReview] = useState<TemplateReviewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    void oeFetch<{ templates: RoleTemplate[] }>('admin.roles.templates', {
      ajaxUrl,
      csrfToken,
      params: { facility_id: facilityId },
    }).then((data) => {
      setTemplates(data.templates ?? []);
    }).catch(() => {
      setTemplates([]);
    });
  }, [open, ajaxUrl, csrfToken, facilityId]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const templateWarnings = selectedTemplate?.warnings ?? [];

  const reset = () => {
    setStep(0);
    setFname('');
    setLname('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setTemplateId('reception');
    setIsLead(false);
    setPromoteReason('');
    setReview([]);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const goReview = () => {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (templateId === 'admin' && promoteReason.trim() === '') {
      setError('Reason required for clinic admin template');
      return;
    }
    setStep(2);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await oeFetch<{
        review?: TemplateReviewItem[];
        warnings?: string[];
      }>('admin.staff.create', {
        ajaxUrl,
        csrfToken,
        json: {
          fname,
          lname,
          username,
          password,
          template_id: templateId,
          is_lead: isLead,
          promote_reason: promoteReason,
          facility_id: facilityId,
        },
      });
      setReview(result.review ?? []);
      setStep(3);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create staff');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className={dialogContentSizeClass.confirm}>
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
          <DialogClose aria-label="Close"><span aria-hidden="true">&times;</span></DialogClose>
        </DialogHeader>
        <DialogBody>
          <nav className="mb-4 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-[var(--oe-nc-text-muted)]" aria-label="Wizard progress">
            {STEPS.map((label, index) => (
              <span key={label} className={index === step ? 'text-[var(--color-oe-cta,#047857)]' : undefined}>
                {index + 1}. {label}
              </span>
            ))}
          </nav>
          {error && <p className="mb-3 text-sm text-[var(--color-oe-danger,#b91c1c)]">{error}</p>}
          {step === 0 && (
            <div className="space-y-3">
              <div><Label htmlFor="staff-fname">First name</Label><Input id="staff-fname" value={fname} onChange={(e) => setFname(e.target.value)} /></div>
              <div><Label htmlFor="staff-lname">Last name</Label><Input id="staff-lname" value={lname} onChange={(e) => setLname(e.target.value)} /></div>
              <div><Label htmlFor="staff-username">Username</Label><Input id="staff-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" /></div>
              <div><Label htmlFor="staff-password">Password</Label><Input id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
              <div><Label htmlFor="staff-password2">Confirm password</Label><Input id="staff-password2" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Role template</legend>
                {templates.map((template) => (
                  <label key={template.id} className="flex items-start gap-2 text-sm">
                    <input type="radio" name="role-template" value={template.id} checked={templateId === template.id} onChange={() => setTemplateId(template.id)} />
                    <span><strong>{template.label}</strong><span className="block text-[var(--oe-nc-text-muted)]">Desks: {(template.desks ?? []).join(', ')}</span></span>
                  </label>
                ))}
              </fieldset>
              {selectedTemplate?.supports_lead && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isLead} onChange={(e) => setIsLead(e.target.checked)} />
                  Lead (solo bench / supervisor permissions)
                </label>
              )}
              {templateId === 'admin' && (
                <div><Label htmlFor="promote-reason">Reason for admin access</Label><Input id="promote-reason" value={promoteReason} onChange={(e) => setPromoteReason(e.target.value)} /></div>
              )}
              {templateWarnings.map((warning) => (<PeopleWarningCallout key={warning}>{warning}</PeopleWarningCallout>))}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2 text-sm">
              <p><strong>{fname} {lname}</strong> ({username}) will:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Template: {selectedTemplate?.label ?? templateId}</li>
                {isLead && <li>Include lead permissions</li>}
              </ul>
              <PeopleInfoCallout>Review carefully — wrong groups expose stock admin screens.</PeopleInfoCallout>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-[var(--color-oe-cta,#047857)]">Staff created successfully.</p>
              <ul className="space-y-1">{review.map((item) => (<li key={item.text}>{item.allowed ? '✓' : '✗'} {item.text}</li>))}</ul>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {step > 0 && step < 3 && <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>}
          {step === 0 && <Button type="button" onClick={() => setStep(1)} disabled={!fname || !lname || !username || password.length < 8}>Next</Button>}
          {step === 1 && <Button type="button" onClick={goReview} disabled={!templateId}>Review</Button>}
          {step === 2 && <Button type="button" onClick={() => { void handleSave(); }} disabled={saving}>{saving ? 'Saving…' : 'Save staff'}</Button>}
          {step === 3 && <Button type="button" onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
