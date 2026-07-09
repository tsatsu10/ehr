/**
 * ReferralWizard — 3-step outbound referral composer (M11-F03).
 *
 * Destination → clinical reason → preview & print. A façade over the stock
 * transactions/LBTref backend via chart_depth.referral_save — no LBF editor.
 */

import { useCallback, useState } from 'react';
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
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { oeFetch } from '@core/oeFetch';
import type { ReferralSaveResult } from './chartDepthTypes';

interface ReferralWizardProps {
  open: boolean;
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  encounterId?: number;
  /** D-REF-8 — "Name · MRN" identity line shown on the preview step before print. */
  patientLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}

const STEPS = ['Destination', 'Clinical reason', 'Preview & print'] as const;

export function ReferralWizard({
  open,
  ajaxUrl,
  csrfToken,
  pid,
  encounterId,
  patientLabel,
  onClose,
  onSaved,
}: ReferralWizardProps) {
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState('');
  const [department, setDepartment] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(0);
    setDestination('');
    setDepartment('');
    setChiefComplaint('');
    setDiagnosis('');
    setSummary('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (!saving) {
      reset();
      onClose();
    }
  }, [onClose, reset, saving]);

  const stepValid = step === 0 ? destination.trim().length > 0 : step === 1 ? summary.trim().length > 0 : true;

  const handleSaveAndPrint = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await oeFetch<ReferralSaveResult>('chart_depth.referral_save', {
        method: 'POST',
        ajaxUrl,
        csrfToken,
        json: {
          pid,
          encounter_id: encounterId ?? 0,
          destination_facility: destination.trim(),
          destination_department: department.trim(),
          chief_complaint: chiefComplaint.trim(),
          diagnosis: diagnosis.trim(),
          summary: summary.trim(),
        },
      });

      const printed = await oeFetch<ReferralSaveResult>('chart_depth.referral_print', {
        method: 'POST',
        ajaxUrl,
        csrfToken,
        json: { transaction_id: saved.transaction_id },
      });

      if (printed.print_url) {
        window.open(printed.print_url, '_blank', 'noopener,noreferrer');
      }
      reset();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the referral');
    } finally {
      setSaving(false);
    }
  }, [ajaxUrl, chiefComplaint, csrfToken, department, destination, diagnosis, encounterId, onSaved, pid, reset, summary]);

  const fieldClass =
    'w-full rounded border border-[var(--oe-nc-border)] px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oe-nc-primary)]';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent
        id="nc-referral-wizard"
        className={dialogContentSizeClass.confirm}
        aria-labelledby="nc-referral-wizard-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-referral-wizard-title">
            New referral — {STEPS[step]} ({step + 1}/3)
          </DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          {error && <div className={deskCalloutClass('error', 'mb-3 py-2 text-sm')}>{error}</div>}

          {step === 0 && (
            <div className="space-y-3">
              <div>
                <label htmlFor="nc-referral-destination" className="mb-1 block text-sm font-medium">
                  Destination facility *
                </label>
                <input
                  id="nc-referral-destination"
                  className={fieldClass}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Regional Teaching Hospital"
                />
              </div>
              <div>
                <label htmlFor="nc-referral-department" className="mb-1 block text-sm font-medium">
                  Department / specialty
                </label>
                <input
                  id="nc-referral-department"
                  className={fieldClass}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Cardiology"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label htmlFor="nc-referral-cc" className="mb-1 block text-sm font-medium">
                  Chief complaint
                </label>
                <input
                  id="nc-referral-cc"
                  className={fieldClass}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="nc-referral-diagnosis" className="mb-1 block text-sm font-medium">
                  Diagnosis
                </label>
                <input
                  id="nc-referral-diagnosis"
                  className={fieldClass}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="nc-referral-summary" className="mb-1 block text-sm font-medium">
                  Clinical summary *
                </label>
                <textarea
                  id="nc-referral-summary"
                  className={fieldClass}
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Reason for referral, relevant findings, treatment so far…"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2 text-sm">
              {/* D-REF-8 — identity confirm before Save & print POSTs referral_print. */}
              <p
                id="nc-referral-identity"
                className="mb-2 rounded border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface-muted,#f5f7f9)] px-2 py-1.5 font-medium"
              >
                {patientLabel || 'Patient'}
                {encounterId && encounterId > 0 ? ` · Encounter #${encounterId}` : ''}
              </p>
              <p className="mb-1">
                <strong>To:</strong> {destination}
                {department ? ` — ${department}` : ''}
              </p>
              {chiefComplaint && (
                <p className="mb-1">
                  <strong>Chief complaint:</strong> {chiefComplaint}
                </p>
              )}
              {diagnosis && (
                <p className="mb-1">
                  <strong>Diagnosis:</strong> {diagnosis}
                </p>
              )}
              <p className="mb-1 whitespace-pre-wrap">
                <strong>Summary:</strong> {summary}
              </p>
              <p className="text-[var(--oe-nc-text-muted)]">
                Save &amp; print opens the clinic-letterhead referral for A4 printing.
              </p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {step > 0 && (
            <Button type="button" variant="outline" disabled={saving} onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" disabled={!stepValid} onClick={() => setStep(step + 1)}>
              Next
            </Button>
          ) : (
            <Button
              type="button"
              variant="cta"
              id="nc-referral-save-print"
              disabled={saving}
              onClick={() => {
                void handleSaveAndPrint();
              }}
            >
              {saving ? 'Saving…' : 'Save & print'}
            </Button>
          )}
          <Button type="button" variant="secondary" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
