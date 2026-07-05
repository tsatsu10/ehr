/**
 * useStartVisit — encapsulates all visit-start logic: type loading, submission,
 * referral upload, hard-assign, skip-triage. StartVisitForm.tsx is left as JSX only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { hardAssignVisit } from '@core/hardAssignVisit';
import { showDeskToast } from '@components/deskToast';
import { uploadReferralDocument } from './referralUploadApi';
import { useOptimisticUpdate } from './useOptimisticUpdate';
import type {
  AppointmentTodayChip,
  DeskVisitType,
  FrontDeskPreviewData,
  VisitStartData,
  VisitState,
} from '@core/types';
import type { RevisitPath } from './RevisitGatePanel';

export type PriorityFlag = 'standard' | 'elderly' | 'pregnant' | 'under_5' | 'urgent';

export interface UseStartVisitParams {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pid: number;
  preview: FrontDeskPreviewData;
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

export interface UseStartVisitReturn {
  // Visit type state
  types: DeskVisitType[];
  visitTypeId: string;
  setVisitTypeId: (id: string) => void;
  loadingTypes: boolean;
  selectedVisitType: DeskVisitType | null;
  showReferralUpload: boolean;
  // Form state
  chiefComplaint: string;
  setChiefComplaint: (v: string) => void;
  priorityFlag: PriorityFlag;
  setPriorityFlag: (v: PriorityFlag) => void;
  hardAssignDoctorId: string;
  setHardAssignDoctorId: (v: string) => void;
  // Revisit gate state
  revisitPath: RevisitPath | null;
  setRevisitPath: (v: RevisitPath | null) => void;
  overrideReason: string;
  setOverrideReason: (v: string) => void;
  // Submission state
  submitting: boolean;
  error: string | null;
  success: VisitStartData | null;
  successMsg: string | null;
  awaitingNote: string | null;
  // Referral upload state
  referralDocumentId: number | null;
  referralFilename: string | null;
  referralUploading: boolean;
  referralUploadError: string | null;
  // Skip-triage state
  skipModalOpen: boolean;
  setSkipModalOpen: (v: boolean) => void;
  skipSubmitting: boolean;
  skipError: string | null;
  // Derived / computed
  fromAppointment: boolean;
  appointment: AppointmentTodayChip | null;
  blockPlainStart: boolean;
  showArrivalAdvisor: boolean;
  gateBlocked: boolean;
  canShowVisitFields: boolean;
  showHardAssign: boolean;
  startLabel: string;
  gateActionLabel: string;
  // Handlers
  markDirty: () => void;
  startVisit: () => Promise<void>;
  handleSkipTriage: (reason: string) => Promise<void>;
  handleReferralFile: (file: File) => Promise<void>;
  clearReferralUpload: () => void;
}
export function useStartVisit({
  ajaxUrl,
  csrfToken,
  facilityId,
  pid,
  preview,
  enforceCompletionOnRevisit = true,
  autoStart = false,
  onAutoStartConsumed,
  onStarted: _onStarted,
  onCompleteNow,
  onDirtyChange,
  onChiefComplaintChange,
}: UseStartVisitParams): UseStartVisitReturn {
  const [types, setTypes] = useState<DeskVisitType[]>([]);
  const [visitTypeId, setVisitTypeId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [priorityFlag, setPriorityFlag] = useState<PriorityFlag>('standard');
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
  const [referralDocumentId, setReferralDocumentId] = useState<number | null>(null);
  const [referralFilename, setReferralFilename] = useState<string | null>(null);
  const [referralUploading, setReferralUploading] = useState(false);
  const [hardAssignDoctorId, setHardAssignDoctorId] = useState('');
  const [referralUploadError, setReferralUploadError] = useState<string | null>(null);
  const autoStartAttemptedRef = useRef(false);
  
  // Optimistic update for visit start
  const optimisticVisitStart = useOptimisticUpdate<VisitStartData>();

  // ── Derived from preview ──────────────────────────────────────────────────

  const appointment: AppointmentTodayChip | null =
    preview.appointment_today ?? preview.chips?.appointment_today ?? null;
  const fromAppointment = !!(appointment?.pc_eid);
  const queueBridge = preview.queue_bridge;
  const blockPlainStart = !!(queueBridge?.enabled && queueBridge.block_plain_start && !fromAppointment);
  const showArrivalAdvisor = !!(queueBridge?.enabled && queueBridge.show_arrival_advisor && fromAppointment);
  const activeVisit = preview.active_visit;
  const gate = preview.revisit_gate;
  const gateBlocked = !!(enforceCompletionOnRevisit && gate?.applies && gate.blocked);
  const showHardAssign = !!(
    preview.hard_provider_assignment_enabled
    && preview.can_hard_assign_provider
    && (preview.assignable_doctors?.length ?? 0) > 0
  );

  const selectedVisitType = types.find((t) => String(t.id) === visitTypeId) ?? null;
  const showReferralUpload = !!selectedVisitType?.allows_referral_upload;
  const canShowVisitFields = !gateBlocked || revisitPath === 'manager_override';

  const startLabel = fromAppointment ? 'Start visit & check in' : 'Start visit';
  const gateActionLabel = revisitPath === 'complete_now'
    ? 'Complete profile now'
    : revisitPath === 'awaiting_documents'
      ? 'Note awaiting documents'
      : startLabel;

  // ── Reset when patient / appointment context changes ──────────────────────

  useEffect(() => {
    onDirtyChange?.(false);
    setRevisitPath(null);
    setOverrideReason('');
    setAwaitingNote(null);
    setReferralDocumentId(null);
    setReferralFilename(null);
    setReferralUploadError(null);
    setHardAssignDoctorId('');
    setChiefComplaint('');
    setPriorityFlag('standard');
    onChiefComplaintChange?.('');
    autoStartAttemptedRef.current = false;
  }, [activeVisit, fromAppointment, onChiefComplaintChange, onDirtyChange, pid]);

  // ── Load visit types ──────────────────────────────────────────────────────

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
        if (fromAppointment) list = list.filter((t) => t.service_profile === 'full_opd');
        setTypes(list);
        const defaultId = fromAppointment && appointment?.default_visit_type_id
          ? String(appointment.default_visit_type_id)
          : String(list.find((t) => t.is_default)?.id ?? list[0]?.id ?? '');
        setVisitTypeId(defaultId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load visit types');
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    }

    void loadTypes();
    return () => { cancelled = true; };
  }, [activeVisit, ajaxUrl, appointment?.default_visit_type_id, csrfToken, facilityId, fromAppointment]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const markDirty = useCallback(() => { onDirtyChange?.(true); }, [onDirtyChange]);

  const handleReferralFile = useCallback(async (file: File) => {
    setReferralUploading(true);
    setReferralUploadError(null);
    markDirty();
    try {
      const result = await uploadReferralDocument(ajaxUrl, csrfToken, pid, file, facilityId);
      setReferralDocumentId(result.document_id);
      setReferralFilename(result.filename);
    } catch (err) {
      setReferralDocumentId(null);
      setReferralFilename(null);
      setReferralUploadError(err instanceof Error ? err.message : 'Referral upload failed');
    } finally {
      setReferralUploading(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, markDirty, pid]);

  const clearReferralUpload = useCallback(() => {
    setReferralDocumentId(null);
    setReferralFilename(null);
    setReferralUploadError(null);
    markDirty();
  }, [markDirty]);

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
          ajaxUrl, csrfToken, method: 'POST', json: { pid },
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

    // Create optimistic visit data
    const optimisticData: VisitStartData = {
      visit: {
        id: 0, // Temporary ID
        queue_number: '⏳',
        state: 'awaiting_triage' as VisitState,
        row_version: 0,
      },
      appointment_status_updated: fromAppointment,
      recurring_guard_fired: false,
    };

    const queueNumberLabel = fromAppointment ? 'Queue #⏳' : 'Queue #⏳';
    const optimisticMsg = `Starting visit ${queueNumberLabel}...`;
    showDeskToast(optimisticMsg, 'info');

    try {
      // Execute optimistic update
      await optimisticVisitStart.execute(optimisticData, async () => {
        const action = fromAppointment ? 'visit.start_from_appointment' : 'visit.start';
        const body: Record<string, unknown> = {
          pid,
          visit_type_id: parseInt(visitTypeId, 10),
          chief_complaint: chiefComplaint.trim(),
          is_urgent: priorityFlag !== 'standard',
          priority_flag: priorityFlag,
        };
        if (facilityId > 0) body.facility_id = facilityId;
        if (fromAppointment && appointment) {
          body.pc_eid = appointment.pc_eid;
          body.appt_date = appointment.appt_date;
        }
        if (gateBlocked && revisitPath === 'manager_override') {
          body.revisit_override_reason = overrideReason.trim();
        }
        if (referralDocumentId != null && referralDocumentId > 0) {
          body.referral_document_id = referralDocumentId;
        }

        const data = await oeFetch<VisitStartData>(action, {
          ajaxUrl, csrfToken, method: 'POST', json: body,
        });

        const parsedDoctorId = hardAssignDoctorId ? Number.parseInt(hardAssignDoctorId, 10) : 0;
        if (parsedDoctorId > 0 && data.visit.id) {
          await hardAssignVisit({
            ajaxUrl, csrfToken, facilityId,
            visitId: data.visit.id,
            rowVersion: data.visit.row_version ?? 0,
            hardAssignedProviderId: parsedDoctorId,
          });
        }

        return data;
      });

      // Success confirmed
      if (optimisticVisitStart.isConfirmed && optimisticVisitStart.data) {
        const data = optimisticVisitStart.data;
        const queueNumber = data.visit.queue_number ?? '?';
        let msg = `Visit #${queueNumber} started — patient is now on the Triage queue.`;
        if (fromAppointment && data.recurring_guard_fired) {
          msg = `Visit #${queueNumber} started. Recurring appointment — update Flow Board if needed.`;
        } else if (fromAppointment && data.appointment_status_updated) {
          msg = `Visit #${queueNumber} started and appointment marked arrived.`;
        }

        setSuccess(data);
        setSuccessMsg(msg);
        showDeskToast(msg, 'success');
        onChiefComplaintChange?.('');
        onDirtyChange?.(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start visit';
      setError(message);
      showDeskToast(message, 'danger');
    } finally {
      setSubmitting(false);
    }
  }, [
    ajaxUrl, appointment, chiefComplaint, csrfToken, facilityId, fromAppointment,
    gateBlocked, hardAssignDoctorId, optimisticVisitStart, priorityFlag, onChiefComplaintChange,
    onCompleteNow, onDirtyChange, overrideReason, pid, referralDocumentId, revisitPath, visitTypeId,
  ]);

  const handleSkipTriage = useCallback(async (reason: string) => {
    if (!success?.visit.id) return;
    setSkipSubmitting(true);
    setSkipError(null);
    try {
      const data = await oeFetch<{ visit: { state?: string } }>('visit.skip_triage', {
        ajaxUrl, csrfToken, method: 'POST',
        json: { visit_id: success.visit.id, row_version: success.visit.row_version ?? 0, reason },
        params: facilityId > 0 ? { facility_id: facilityId } : undefined,
      });
      const skipMsg = `Visit #${success.visit.queue_number ?? '?'} sent to doctor queue (skipped triage).`;
      setSuccessMsg(skipMsg);
      showDeskToast(skipMsg, 'success');
      setSuccess((prev) =>
        prev ? { ...prev, visit: { ...prev.visit, state: (data.visit.state ?? 'ready_for_doctor') as VisitState } } : prev
      );
      setSkipModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Skip triage failed';
      setSkipError(message);
      showDeskToast(message, 'danger');
    } finally {
      setSkipSubmitting(false);
    }
  }, [ajaxUrl, csrfToken, facilityId, success]);

  // ── Auto-start ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!autoStart || autoStartAttemptedRef.current || activeVisit || loadingTypes || !types.length || success) return;
    if (gateBlocked) return;
    autoStartAttemptedRef.current = true;
    onAutoStartConsumed?.();
    void startVisit();
  }, [activeVisit, autoStart, gateBlocked, loadingTypes, onAutoStartConsumed, startVisit, success, types.length]);

  return {
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
  };
}
