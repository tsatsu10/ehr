/**
 * StartVisitForm — renders visit-start fields and delegates all logic to useStartVisit.
 */

import { DeskAlert } from '@components/DeskAlert';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@components/ui/select';
import { Play, CalendarCheck, AlertCircle, Loader2, Clock, User, Flag } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FrontDeskPreviewData } from '@core/types';
import { RevisitGatePanel } from './RevisitGatePanel';
import { ReferralUploadField } from './ReferralUploadField';
import { HardAssignDoctorSelect } from '@components/HardAssignDoctorSelect';
import { StartVisitSuccessView } from './StartVisitSuccessView';
import { useStartVisit, type PriorityFlag } from './useStartVisit';

/** "Arrived N min ago" label — clock state kept out of render for purity (react-hooks/purity). */
function ArrivedAgo({ arrivedAtMs }: { arrivedAtMs: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.round((nowMs - arrivedAtMs) / 60_000));
  return <>{mins === 0 ? 'just now' : `${mins} min ago`}</>;
}

const PRIORITY_OPTIONS: { value: PriorityFlag; label: string; title: string }[] = [
  { value: 'standard', label: 'Standard',  title: 'Normal priority' },
  { value: 'elderly',  label: 'Elderly',   title: 'Patient is elderly — fast-track' },
  { value: 'pregnant', label: 'Pregnant',  title: 'Patient is pregnant — fast-track' },
  { value: 'under_5',  label: 'Under 5',   title: 'Child under 5 years — fast-track' },
  { value: 'urgent',   label: 'Urgent',    title: 'Urgent clinical need' },
];

export interface StartVisitFormProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pid: number;
  preview: FrontDeskPreviewData;
  moduleUrl: string;
  printQueueSlip: boolean;
  visitBoardUrl?: string;
  canSkipTriage?: boolean;
  canRevisitOverride?: boolean;
  enforceCompletionOnRevisit?: boolean;
  autoStart?: boolean;
  onAutoStartConsumed?: () => void;
  onStarted: () => void;
  onCompleteNow: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onChiefComplaintChange?: (value: string) => void;
  deskWaitingCount?: number;
  arrivedAtMs?: number;
}

export function StartVisitForm(props: StartVisitFormProps) {
  const {
    types, visitTypeId, setVisitTypeId, loadingTypes, selectedVisitType, showReferralUpload,
    chiefComplaint, setChiefComplaint, priorityFlag, setPriorityFlag,
    hardAssignDoctorId, setHardAssignDoctorId,
    revisitPath, setRevisitPath, overrideReason, setOverrideReason,
    submitting, error, success, successMsg, awaitingNote,
    referralDocumentId, referralFilename, referralUploading, referralUploadError,
    skipModalOpen, setSkipModalOpen, skipSubmitting, skipError,
    fromAppointment, appointment, blockPlainStart, showArrivalAdvisor,
    gateBlocked, canShowVisitFields, showHardAssign,
    startLabel, gateActionLabel,
    markDirty, startVisit, handleSkipTriage, handleReferralFile, clearReferralUpload,
  } = useStartVisit({
    ajaxUrl: props.ajaxUrl,
    csrfToken: props.csrfToken,
    facilityId: props.facilityId,
    pid: props.pid,
    preview: props.preview,
    enforceCompletionOnRevisit: props.enforceCompletionOnRevisit,
    autoStart: props.autoStart,
    onAutoStartConsumed: props.onAutoStartConsumed,
    onStarted: props.onStarted,
    onCompleteNow: props.onCompleteNow,
    onDirtyChange: props.onDirtyChange,
    onChiefComplaintChange: props.onChiefComplaintChange,
    deskWaitingCount: props.deskWaitingCount,
    arrivedAtMs: props.arrivedAtMs,
  });

  const {
    preview, canSkipTriage = false, canRevisitOverride = false,
    moduleUrl, printQueueSlip, arrivedAtMs, deskWaitingCount,
    onStarted,
  } = props;
  const activeVisit = preview.active_visit;
  const StartIcon = fromAppointment ? CalendarCheck : Play;

  if (activeVisit) return null;

  if (awaitingNote) {
    return (
      <DeskAlert tone="info" className="mt-3 flex items-start gap-3" id="nc-awaiting-documents-note">
        <span className="text-sm">{awaitingNote}</span>
      </DeskAlert>
    );
  }

  if (success && successMsg) {
    return (
      <StartVisitSuccessView
        success={success}
        successMsg={successMsg}
        chiefComplaint={chiefComplaint}
        moduleUrl={moduleUrl}
        printQueueSlip={printQueueSlip}
        canSkipTriage={canSkipTriage}
        skipModalOpen={skipModalOpen}
        skipSubmitting={skipSubmitting}
        skipError={skipError}
        displayName={preview.identity.display_name}
        pubpid={preview.identity.pubpid}
        onStarted={onStarted}
        onSkipOpen={() => setSkipModalOpen(true)}
        onSkipClose={() => setSkipModalOpen(false)}
        onSkipConfirm={(reason) => void handleSkipTriage(reason)}
      />
    );
  }

  if (loadingTypes) {
    return (
      <div className="flex items-center gap-2 text-sm text-(--oe-nc-text-muted) py-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading visit types…
      </div>
    );
  }

  if (!types.length) {
    return (
      <DeskAlert tone="error" className="mt-3 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
        <span className="text-sm">
          {fromAppointment ? 'No OPD visit type available for appointment check-in.' : 'No visit types configured.'}
        </span>
      </DeskAlert>
    );
  }

  return (
    <div className="nc-start-visit-panel mt-4 pt-4 border-t border-(--oe-nc-border)" id="nc-start-visit-mount">
      <h6 className="text-sm font-semibold text-(--oe-nc-text) mb-3 m-0">{startLabel}</h6>

      {fromAppointment && (
        <DeskAlert tone="info" className="mb-3 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarCheck className="h-4 w-4 shrink-0 text-sky-600" />
            <span className="font-medium">Appointment today</span>
            {appointment?.start_time_label && (
              <span className="flex items-center gap-1 text-(--oe-nc-text-muted)">
                <Clock className="h-3 w-3" />{appointment.start_time_label}
              </span>
            )}
            {appointment?.provider_name && (
              <span className="flex items-center gap-1 text-(--oe-nc-text-muted)">
                <User className="h-3 w-3" />{appointment.provider_name}
              </span>
            )}
          </div>
          {showArrivalAdvisor && (
            <p className="text-xs mt-1.5 mb-0 text-(--oe-nc-text-muted)">
              Use <strong>Start visit &amp; check in</strong> so the calendar and visit queue stay aligned.
            </p>
          )}
        </DeskAlert>
      )}

      {blockPlainStart && (
        <DeskAlert tone="warn" className="mb-3 text-sm">
          Patient is marked arrived on the schedule but has no clinical visit yet. Open{' '}
          {preview.queue_bridge?.hub_url
            ? <a href={preview.queue_bridge.hub_url} className="font-semibold underline">Queue Bridge</a>
            : 'Queue Bridge'
          }{' '}
          to start visit &amp; check in — plain Start visit is blocked until resolved.
        </DeskAlert>
      )}

      {gateBlocked && preview.revisit_gate && (
        <RevisitGatePanel
          score={preview.revisit_gate.score}
          threshold={preview.revisit_gate.threshold}
          pediatricDobBlock={preview.revisit_gate.pediatric_dob_block}
          missingLabels={preview.revisit_gate.missing_labels ?? preview.completion.missing_labels ?? []}
          canManagerOverride={canRevisitOverride && preview.revisit_gate.can_manager_override}
          selectedPath={revisitPath}
          overrideReason={overrideReason}
          onSelectPath={(path) => {
            setRevisitPath(path);
            markDirty();
            if (path === 'complete_now') props.onCompleteNow();
          }}
          onOverrideReasonChange={(value) => { setOverrideReason(value); markDirty(); }}
        />
      )}

      {canShowVisitFields && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nc-visit-type">Visit type</Label>
            <Select value={visitTypeId} onValueChange={(val) => {
              setVisitTypeId(val);
              clearReferralUpload();
              markDirty();
            }}>
              <SelectTrigger id="nc-visit-type">
                <SelectValue placeholder="Select visit type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVisitType?.service_profile_hint && (
              <p className="text-xs text-(--oe-nc-text-muted)">{selectedVisitType.service_profile_hint}</p>
            )}
          </div>

          {showReferralUpload && (
            <ReferralUploadField
              referralRequired={selectedVisitType?.referral_required}
              documentId={referralDocumentId}
              filename={referralFilename}
              uploading={referralUploading}
              error={referralUploadError}
              disabled={submitting}
              onSelectFile={(file) => { void handleReferralFile(file); }}
              onClear={clearReferralUpload}
            />
          )}

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="nc-chief-complaint">Reason for visit</Label>
              <span className="text-xs tabular-nums text-(--oe-nc-text-muted)" aria-live="polite">
                {chiefComplaint.length}/500
              </span>
            </div>
            <Textarea
              id="nc-chief-complaint"
              rows={2}
              maxLength={500}
              placeholder="Why the patient came today…"
              value={chiefComplaint}
              onChange={(e) => {
                setChiefComplaint(e.target.value);
                props.onChiefComplaintChange?.(e.target.value);
                markDirty();
              }}
            />
            <p className="text-xs text-(--oe-nc-text-muted) m-0">
              Optional — saved on the visit and shown on the banner for triage and doctor.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Priority</Label>
            <div className="nc-priority-chips" role="group" aria-label="Visit priority">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  title={opt.title}
                  aria-pressed={priorityFlag === opt.value}
                  className={[
                    'nc-priority-chip',
                    priorityFlag === opt.value ? 'nc-priority-chip--active' : '',
                    opt.value !== 'standard' ? 'nc-priority-chip--flag' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => { setPriorityFlag(opt.value); markDirty(); }}
                >
                  {opt.value !== 'standard' && <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  {opt.label}
                </button>
              ))}
            </div>
            {priorityFlag !== 'standard' && (
              <p className="text-xs text-(--oe-nc-text-muted) m-0">
                Fast-track patient will be sorted above standard queue entries.
              </p>
            )}
          </div>

          {showHardAssign && (
            <div className="space-y-1.5">
              <Label htmlFor="nc-start-hard-assign-doctor">Assign doctor (optional)</Label>
              <HardAssignDoctorSelect
                id="nc-start-hard-assign-doctor"
                doctors={preview.assignable_doctors ?? []}
                value={hardAssignDoctorId}
                disabled={submitting}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                onChange={(value) => { setHardAssignDoctorId(value); markDirty(); }}
              />
            </div>
          )}
        </div>
      )}

      <div className="nc-start-visit-footer mt-4 flex flex-col gap-2">
        {typeof arrivedAtMs === 'number' && (
          <p className="nc-arrival-pill text-xs m-0" id="nc-arrival-time">
            <Clock className="h-3 w-3 inline mr-1" aria-hidden="true" />
            Arrived <ArrivedAgo arrivedAtMs={arrivedAtMs} />
          </p>
        )}
        {typeof deskWaitingCount === 'number' && (
          <p className="text-xs text-(--oe-nc-text-muted) m-0" id="nc-queue-hint">
            {deskWaitingCount === 0
              ? 'Queue is empty — patient will be first in line.'
              : `${deskWaitingCount} ${deskWaitingCount === 1 ? 'patient' : 'patients'} currently waiting.`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!blockPlainStart && (
            <Button
              size="lg"
              variant={fromAppointment ? 'cta' : 'default'}
              id="nc-start-visit-btn"
              disabled={submitting || (gateBlocked && !revisitPath)}
              onClick={() => void startVisit()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <StartIcon className="h-4 w-4" />}
              {submitting ? 'Starting…' : gateActionLabel}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <DeskAlert tone="error" className="mt-3 flex items-start gap-3" id="nc-start-visit-error" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </DeskAlert>
      )}
    </div>
  );
}
