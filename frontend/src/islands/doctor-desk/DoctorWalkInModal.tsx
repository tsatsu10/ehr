/**
 * DoctorWalkInModal — "Start visit with doctor" modal.
 *
 * Shown when Find Patient locates a patient with no visit today at all — the walk-straight-into-
 * my-office case. Skips Front Desk and Triage entirely; the visit is created directly bound to
 * this doctor's consult (mirrors AutoStartModal's shape for Triage's equivalent walk-in case).
 */

import { useState } from 'react';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { identityFromLabels } from '@components/patientBannerUtils';
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
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import type { VisitType } from '@core/types';

interface DoctorWalkInModalProps {
  open: boolean;
  patientName: string;
  patientMrn: string;
  visitTypes: VisitType[];
  submitting: boolean;
  error: string | null;
  onConfirm: (visitTypeId: number) => void;
  onClose: () => void;
}

export function DoctorWalkInModal({
  open,
  patientName,
  patientMrn,
  visitTypes,
  submitting,
  error,
  onConfirm,
  onClose,
}: DoctorWalkInModalProps) {
  const [visitTypeId, setVisitTypeId] = useState<number>(visitTypes[0]?.id ?? 0);

  const handleConfirm = () => {
    const id = visitTypeId || visitTypes[0]?.id;
    if (!id) return;
    onConfirm(id);
  };

  const patientIdentity = identityFromLabels(patientName, { pubpid: patientMrn || undefined });

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-doctor-walk-in-modal"
        className={dialogContentSizeClass.confirm}
        aria-labelledby="nc-doctor-walk-in-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-doctor-walk-in-title">Start visit with doctor</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>

        <DialogBody>
          {patientIdentity ? (
            <PatientContextBanner layout="compact" identity={patientIdentity} className="mb-3" />
          ) : null}
          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3">
            No visit today for this patient. Skip Front Desk and Triage and start the consult now?
          </p>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-doctor-walk-in-visit-type" className="normal-case">Visit type</Label>
            {visitTypes.length === 0 ? (
              <div className={deskCalloutClass('warn', 'py-2')}>No visit types configured</div>
            ) : (
              <NativeSelect
                id="nc-doctor-walk-in-visit-type"
                value={String(visitTypeId)}
                onChange={(e) => setVisitTypeId(Number(e.target.value))}
              >
                {visitTypes.map((vt) => (
                  <option key={vt.id} value={vt.id}>{vt.label}</option>
                ))}
              </NativeSelect>
            )}
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
            {submitting ? 'Starting…' : 'Start consult'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
