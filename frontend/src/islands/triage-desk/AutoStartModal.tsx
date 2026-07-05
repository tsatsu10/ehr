/**
 * AutoStartModal — "Start visit at triage" modal.
 *
 * Shown when a patient is found via Find Patient but has no active visit.
 * Mirrors openAutoStartModal() + confirmAutoStart() from triage.js.
 */

import { useState } from 'react';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { identityFromLabels } from '@components/patientBannerUtils';
import { Button } from '@components/ui/button';
import { Checkbox } from '@components/ui/checkbox';
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
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import type { VisitType } from '@core/types';

interface AutoStartModalProps {
  open: boolean;
  patientName: string;
  patientMrn: string;
  visitTypes: VisitType[];
  submitting: boolean;
  error: string | null;
  onConfirm: (visitTypeId: number, isUrgent: boolean) => void;
  onClose: () => void;
}

export function AutoStartModal({
  open,
  patientName,
  patientMrn,
  visitTypes,
  submitting,
  error,
  onConfirm,
  onClose,
}: AutoStartModalProps) {
  const [visitTypeId, setVisitTypeId] = useState<number>(visitTypes[0]?.id ?? 0);
  const [isUrgent, setIsUrgent] = useState(false);

  const handleConfirm = () => {
    const id = visitTypeId || visitTypes[0]?.id;
    if (!id) return;
    onConfirm(id, isUrgent);
  };

  const patientIdentity = identityFromLabels(patientName, { pubpid: patientMrn || undefined });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-auto-start-modal"
        className={dialogContentSizeClass.confirm}
        aria-labelledby="nc-auto-start-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-auto-start-title">Start visit at triage</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>

        <DialogBody>
          {patientIdentity ? (
            <PatientContextBanner layout="compact" identity={patientIdentity} className="mb-3" />
          ) : null}
          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3">
            No visit was started at Front Desk. Start one now and begin triage?
          </p>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-auto-start-visit-type" className="normal-case">Visit type</Label>
            {visitTypes.length === 0 ? (
              <div className={deskCalloutClass('warn', 'py-2')}>No visit types configured</div>
            ) : (
              <NativeSelect
                id="nc-auto-start-visit-type"
                value={String(visitTypeId)}
                onChange={(e) => setVisitTypeId(Number(e.target.value))}
              >
                {visitTypes.map((vt) => (
                  <option key={vt.id} value={vt.id}>{vt.label}</option>
                ))}
              </NativeSelect>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="nc-auto-start-urgent"
              checked={isUrgent}
              onCheckedChange={(checked) => setIsUrgent(checked === true)}
            />
            <Label htmlFor="nc-auto-start-urgent" className="font-normal normal-case cursor-pointer mb-0">
              Urgent
            </Label>
          </div>

          {error && (
            <div className={deskCalloutClass('error', 'mt-2')} role="alert">
              {error}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || visitTypes.length === 0}
          >
            {submitting ? 'Starting…' : 'Start and triage'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
