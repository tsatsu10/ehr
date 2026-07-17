/**
 * RoutingModal — confirm lab/pharmacy routing when completing a consult.
 */

import { useState } from 'react';
import { IdentityConfirmBanner } from '@components/ConfirmModal';
import { deskCalloutClass } from '@components/deskCalloutStyles';
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
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { t } from '@core/i18n';
import type { DoctorVisit, PatientPreview, RoutingPreview } from '@core/types';
import { useModalDismiss } from '@components/useModalDismiss';
import { postDoctorAction } from './postDoctorAction';

interface RoutingModalProps {
  open: boolean;
  visit: DoctorVisit | null;
  preview: PatientPreview | null;
  routingPreview: RoutingPreview | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

interface RoutingModalBodyProps {
  open: boolean;
  visit: DoctorVisit;
  preview: PatientPreview;
  routingPreview: RoutingPreview | null;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

function RoutingModalBody({
  open,
  visit,
  preview,
  routingPreview,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onCompleted,
}: RoutingModalBodyProps) {
  const routing = routingPreview ?? {
    detected_lab: false,
    detected_rx: false,
    lab_count: 0,
    rx_count: 0,
  };

  const [needsLab, setNeedsLab] = useState(!!routing.detected_lab);
  const [needsRx, setNeedsRx] = useState(!!routing.detected_rx && !routing.detected_lab);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const identity = preview.identity;

  const handleConfirm = async () => {
    if (blocked || submitting) return;

    if (needsLab && needsRx) {
      setError(t('Choose lab or pharmacy routing, not both'));
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await postDoctorAction<{ visit?: DoctorVisit }>({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'doctor.complete',
      body: {
        visit_id: visit.id,
        row_version: visit.row_version ?? 0,
        needs_lab: needsLab,
        needs_rx: needsRx,
        notes: notes.trim(),
      },
    });

    setSubmitting(false);

    if (!result.ok) {
      const data = result.data as { code?: string; encounter_url?: string } | undefined;
      if (result.status === 409 && data?.code === 'encounter_unsigned') {
        setError(result.message || t('Documentation must be signed first'));
        if (data.encounter_url) {
          window.open(data.encounter_url, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      setError(result.message || t('Complete failed'));
      return;
    }

    onCompleted();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-doctor-routing-modal"
        className={dialogContentSizeClass.confirm}
        aria-labelledby="nc-doctor-routing-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-doctor-routing-title">{t('Confirm routing')}</DialogTitle>
          <DialogClose aria-label={t('Close')}>
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <IdentityConfirmBanner
            displayName={identity.display_name}
            pubpid={identity.pubpid}
            queueNumber={visit.queue_number}
          />
          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3" id="nc-routing-detected">
            {t('System detected: {labCount} lab order(s), {rxCount} Rx today', {
              labCount: routing.lab_count,
              rxCount: routing.rx_count,
            })}
          </p>
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              id="nc-routing-lab"
              checked={needsLab}
              onCheckedChange={(checked) => setNeedsLab(checked === true)}
            />
            <Label htmlFor="nc-routing-lab" className="font-normal cursor-pointer">
              {t('Send to lab')}
            </Label>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="nc-routing-rx"
              checked={needsRx}
              onCheckedChange={(checked) => setNeedsRx(checked === true)}
            />
            <Label htmlFor="nc-routing-rx" className="font-normal cursor-pointer">
              {t('Send to pharmacy')}
            </Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nc-routing-notes">{t('Notes (optional)')}</Label>
            <Textarea
              id="nc-routing-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && (
            <div className={deskCalloutClass('error', 'text-sm mt-3 mb-0')} id="nc-routing-error" role="alert">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            type="button"
            id="nc-routing-confirm"
            disabled={submitting || blocked}
            onClick={() => void handleConfirm()}
          >
            {submitting ? t('Routing…') : t('Confirm and route')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RoutingModal({
  open,
  visit,
  preview,
  routingPreview,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onClose,
  onCompleted,
}: RoutingModalProps) {
  useModalDismiss(open, onClose);

  if (!visit || !preview) return null;

  return (
    <RoutingModalBody
      key={`${visit.id}-${routingPreview?.lab_count ?? 0}-${routingPreview?.rx_count ?? 0}`}
      open={open}
      visit={visit}
      preview={preview}
      routingPreview={routingPreview}
      ajaxUrl={ajaxUrl}
      csrfToken={csrfToken}
      facilityId={facilityId}
      blocked={blocked}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  );
}
