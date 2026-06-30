import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type {
  AppointmentTodayChip,
  DeskVisitType,
  FrontDeskPreviewData,
  VisitStartData,
} from '@core/types';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Checkbox } from '@components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Play, CalendarCheck, Printer, CheckCircle2, AlertCircle, SkipForward, Loader2 } from 'lucide-react';
import { RevisitGatePanel, type RevisitPath } from './RevisitGatePanel';
import { SkipTriageModal } from './SkipTriageModal';

interface StartVisitFormProps {
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
}

export function StartVisitForm({
  ajaxUrl,
  csrfToken,
  facilityId,
  pid,
  preview,
  moduleUrl,
  printQueueSlip,
  visitBoardUrl: _visitBoardUrl,
  canSkipTriage = false,
  canRevisitOverride = false,
  enforceCompletionOnRevisit = true,
  autoStart = false,
  onAutoStartConsumed,
  onStarted,
  onCompleteNow,
  onDirtyChange,
}: StartVisitFormProps) {
  const [types, setTypes] = useState<DeskVisitType[]>([]);
  const [visitTypeId, setVisitTypeId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<VisitStartData | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [revisitPath, setRevisitPath] = useState<RevisitPath | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [awaitingNote, setAwaitingNote] = useState<string | null>(null);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skipSubmitting, setSkipSubmitting] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const autoStartAttemptedRef = useRef(false);

  const appointment: AppointmentTodayChip | null =
    preview.appointment_today ?? preview.chips?.appointment_today ?? null;
  const fromAppointment = !!(appointment?.pc_eid);
  const activeVisit = preview.active_visit;
  const gate = preview.revisit_gate;
  const gateBlocked = !!(
    enforceCompletionOnRevisit
    && gate?.applies
    && gate.blocked
  );

  useEffect(() => {
    onDirtyChange?.(false);
    setRevisitPath(null);
    setOverrideReason('');
    setAwaitingNote(null);
  }, [activeVisit, fromAppointment, onDirtyChange, pid]);

  useEffect(() => {
    if (activeVisit) return;

    let cancelled = false;

    async function loadTypes() {
      setLoadingTypes(true);
      try {
        const data = await oeFetch<{ visit_types: DeskVisitType[] }>('visit.types', {
          ajaxUrl,
          csrfToken,
          params: facilityId > 0 ? { facility_id: facilityId } : undefined,
        });
        if (cancelled) return;

        let list = data.visit_types ?? [];
        if (fromAppointment) {
          list = list.filter((t) => t.service_profile === 'full_opd');
        }
        setTypes(list);

        const defaultId = fromAppointment && appointment?.default_visit_type_id
          ? String(appointment.default_visit_type_id)
          : String(list.find((t) => t.is_default)?.id ?? list[0]?.id ?? '');
        setVisitTypeId(defaultId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load visit types');
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    }

    void loadTypes();
    return () => { cancelled = true; };
  }, [
    activeVisit,
    ajaxUrl,
    appointment?.default_visit_type_id,
    csrfToken,
    facilityId,
    fromAppointment,
  ]);

  const markDirty = useCallback(() => { onDirtyChange?.(true); }, [onDirtyChange]);

  const canShowVisitFields = !gateBlocked || revisitPath === 'manager_override';

  const startVisit = useCallback(async () => {
    if (gateBlocked && revisitPath === 'complete_now') {
      onCompleteNow();
      return;
    }

    if (gateBlocked && revisitPath === 'awaiting_documents') {
      setSubmitting(true);
      setError(null);
      try {
        await oeFetch('front_desk.revisit_awaiting_documents', {
          ajaxUrl,
          csrfToken,
          method: 'POST',
          json: { pid },
        });
        setAwaitingNote('Patient noted as fetching documents. Start visit when the profile is complete.');
        onDirtyChange?.(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save note');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (gateBlocked && revisitPath === 'manager_override' && overrideReason.trim() === '') {
      setError('Manager override reason is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const action = fromAppointment ? 'visit.start_from_appointment' : 'visit.start';
      const body: Record<string, unknown> = {
        pid,
        visit_type_id: parseInt(visitTypeId, 10),
        chief_complaint: chiefComplaint.trim(),
        is_urgent: isUrgent,
      };
      if (facilityId > 0) body.facility_id = facilityId;
      if (fromAppointment && appointment) {
        body.pc_eid = appointment.pc_eid;
        body.appt_date = appointment.appt_date;
      }
      if (gateBlocked && revisitPath === 'manager_override') {
        body.revisit_override_reason = overrideReason.trim();
      }

      const data = await oeFetch<VisitStartData>(action, {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: body,
      });

      const queueNumber = data.visit.queue_number ?? '?';
      let msg = `Visit #${queueNumber} started — patient is now on the Triage queue.`;
      if (fromAppointment && data.recurring_guard_fired) {
        msg = `Visit #${queueNumber} started. Recurring appointment — update Flow Board if needed.`;
      } else if (fromAppointment && data.appointment_status_updated) {
        msg = `Visit #${queueNumber} started and appointment marked arrived.`;
      }

      setSuccess(data);
      setSuccessMsg(msg);
      onDirtyChange?.(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start visit');
    } finally {
      setSubmitting(false);
    }
  }, [
    ajaxUrl, appointment, chiefComplaint, csrfToken, facilityId, fromAppointment,
    gateBlocked, isUrgent, onCompleteNow, onDirtyChange, overrideReason, pid,
    revisitPath, visitTypeId,
  ]);

  const handleSkipTriage = useCallback(async (reason: string) => {
    if (!success?.visit.id) return;
    setSkipSubmitting(true);
    setSkipError(null);
    try {
      const data = await oeFetch<{ visit: { state?: string } }>('visit.skip_triage', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: success.visit.id,
          row_version: success.visit.row_version ?? 0,
          reason,
        },
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      setSuccessMsg(`Visit #${success.visit.queue_number ?? '?'} sent to doctor queue (skipped triage).`);
      setSuccess((prev) =>
        prev
          ? { ...prev, visit: { ...prev.visit, state: (data.visit.state ?? 'ready_for_doctor') as import('@core/types').VisitState } }
          : prev
      );
      setSkipModalOpen(false);
    } catch (err) {
      setSkipError(err instanceof Error ? err.message : 'Skip triage failed');
    } finally {
      setSkipSubmitting(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, success]);

  useEffect(() => {
    if (!autoStart || autoStartAttemptedRef.current || activeVisit || loadingTypes || !types.length || success) return;
    if (gateBlocked) return;
    autoStartAttemptedRef.current = true;
    onAutoStartConsumed?.();
    void startVisit();
  }, [activeVisit, autoStart, gateBlocked, loadingTypes, onAutoStartConsumed, startVisit, success, types.length]);

  if (activeVisit) return null;

  if (awaitingNote) {
    return (
      <div className="oe-nc-info-callout mt-3 rounded-lg px-4 py-3 flex items-start gap-3" id="nc-awaiting-documents-note">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-sky-600" />
        <span className="text-sm">{awaitingNote}</span>
      </div>
    );
  }

  if (success && successMsg) {
    const visitId = success.visit.id;
    const visitState = success.visit.state;
    const showSkip = canSkipTriage && visitState === 'waiting';
    const slipUrl = success.queue_slip_url
      ?? (printQueueSlip && visitId
        ? `${moduleUrl}/queue-slip.php?visit_id=${encodeURIComponent(String(visitId))}&print=1`
        : '');
    const showPrint = printQueueSlip && success.queue_slip_enabled !== false && !!slipUrl;

    return (
      <div className="mt-3 border-t border-[var(--oe-nc-border)] pt-4" id="nc-start-visit-mount">
        <div
          className="oe-nc-success-callout mb-4 rounded-xl px-4 py-3 flex items-start gap-3"
          id="nc-start-visit-success"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <span className="text-sm font-medium text-emerald-800">{successMsg}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPrint && (
            <Button variant="default" size="sm" asChild>
              <a href={slipUrl} target="_blank" rel="noopener noreferrer">
                <Printer className="h-4 w-4" />
                Print queue slip
              </a>
            </Button>
          )}
          {showSkip && (
            <Button
              variant="warning"
              size="sm"
              id="nc-skip-to-doctor-btn"
              onClick={() => setSkipModalOpen(true)}
            >
              <SkipForward className="h-4 w-4" />
              Skip to doctor
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            id="nc-start-visit-done"
            onClick={onStarted}
          >
            Done
          </Button>
        </div>
        <SkipTriageModal
          open={skipModalOpen}
          displayName={preview.identity.display_name}
          pubpid={preview.identity.pubpid}
          submitting={skipSubmitting}
          error={skipError}
          onClose={() => setSkipModalOpen(false)}
          onConfirm={(reason) => void handleSkipTriage(reason)}
        />
      </div>
    );
  }

  if (loadingTypes) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--oe-nc-text-muted)] py-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading visit types…
      </div>
    );
  }

  if (!types.length) {
    return (
      <div className="oe-nc-error-callout mt-3 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
        <span className="text-sm">
          {fromAppointment
            ? 'No OPD visit type available for appointment check-in.'
            : 'No visit types configured.'}
        </span>
      </div>
    );
  }

  const startLabel = fromAppointment ? 'Start visit & check in' : 'Start visit';
  const StartIcon = fromAppointment ? CalendarCheck : Play;
  const gateActionLabel = revisitPath === 'complete_now'
    ? 'Complete profile now'
    : revisitPath === 'awaiting_documents'
      ? 'Note awaiting documents'
      : startLabel;

  return (
    <div className="mt-4 pt-4 border-t border-[var(--oe-nc-border)]" id="nc-start-visit-mount">
      <h6 className="text-sm font-semibold text-[var(--oe-nc-text)] mb-3">{startLabel}</h6>

      {gateBlocked && gate && (
        <RevisitGatePanel
          score={gate.score}
          threshold={gate.threshold}
          pediatricDobBlock={gate.pediatric_dob_block}
          missingLabels={gate.missing_labels ?? preview.completion.missing_labels ?? []}
          canManagerOverride={canRevisitOverride && gate.can_manager_override}
          selectedPath={revisitPath}
          overrideReason={overrideReason}
          onSelectPath={(path) => {
            setRevisitPath(path);
            markDirty();
            if (path === 'complete_now') onCompleteNow();
          }}
          onOverrideReasonChange={(value) => {
            setOverrideReason(value);
            markDirty();
          }}
        />
      )}

      {canShowVisitFields && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nc-visit-type">Visit type</Label>
            <Select
              value={visitTypeId}
              onValueChange={(val) => {
                setVisitTypeId(val);
                markDirty();
              }}
            >
              <SelectTrigger id="nc-visit-type">
                <SelectValue placeholder="Select visit type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-chief-complaint">Reason for visit</Label>
            <Textarea
              id="nc-chief-complaint"
              rows={2}
              maxLength={500}
              placeholder="Chief complaint…"
              value={chiefComplaint}
              onChange={(e) => {
                setChiefComplaint(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <Checkbox
              id="nc-is-urgent"
              checked={isUrgent}
              onCheckedChange={(checked) => {
                setIsUrgent(checked === true);
                markDirty();
              }}
            />
            <Label htmlFor="nc-is-urgent" className="normal-case tracking-normal text-sm font-medium cursor-pointer">
              Urgent
            </Label>
          </div>
        </div>
      )}

      <div className="oe-nc-start-visit__footer mt-4 flex flex-wrap gap-2">
        <Button
          size="lg"
          variant={fromAppointment ? 'cta' : 'default'}
          id="nc-start-visit-btn"
          disabled={submitting || (gateBlocked && !revisitPath)}
          onClick={() => void startVisit()}
        >
          {submitting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <StartIcon className="h-4 w-4" />
          }
          {submitting ? 'Starting…' : gateActionLabel}
        </Button>
      </div>

      {error && (
        <div className="oe-nc-error-callout mt-3 rounded-lg px-4 py-3 flex items-start gap-3" id="nc-start-visit-error" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}
    </div>
  );
}
