/**
 * DoctorDesk — Phase 3A/3B React island replacing jQuery NewClinicDoctor.
 *
 * Layout: col-span-12 lg:col-span-8 active pane (left) | col-span-12 lg:col-span-4 queue (right).
 * Mutations: doctor.take, doctor.active, doctor.complete, doctor.reopen,
 * doctor.set_supervisor, doctor.lab_panel_place
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { oeFetch, OeFetchError } from '@core/oeFetch';
import { resolveActionConflict, type DeskInterrupt } from '@core/deskConflict';
import { getDeskActiveVisitId } from '@core/deskSessionStorage';
import { useSharedDeviceSession } from '@core/useSharedDeviceSession';
import type {
  DoctorConsultPayload,
  DoctorDeskProps,
  DoctorQueueCard,
  DoctorQueueData,
  DoctorReopenableRow,
  DoctorSupervisorMeta,
  FormularyRxPlaceResult,
  LabPanelPlaceResult,
  PharmacyPrescriptionLine,
  RoutingPreview,
  VisitType,
} from '@core/types';
import { DoctorQueue } from './DoctorQueue';
import { DoctorMobileQueueBar, DoctorMobileQueueSheet } from './DoctorMobileQueueSheet';
import { DoctorDutyToggle } from './DoctorDutyToggle';
import { DoctorTeamRoster } from './DoctorTeamRoster';
import { useDoctorRoster } from './useDoctorRoster';
import { DoctorActivePane, type ActiveMode } from './DoctorActivePane';
import { DoctorWalkInModal } from './DoctorWalkInModal';
import { DeskInterruptBanner } from '@components/DeskInterruptBanner';
import { DeskSharedDeviceBanner } from '@components/DeskSharedDeviceBanner';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { NativeSelect } from '@components/ui/native-select';
import { showDeskNotice, showDeskToast } from '@components/deskToast';
import { FindPatientDrawer } from '@components/FindPatientDrawer';
import { usePageHeadingButton } from '@core/usePageHeadingToolbar';
import { labPanelPlaceNotice, labReturnNotice } from './LabPanelModal';
import { formularyRxPlaceNotice } from './FormularyRxModal';
import { rxReturnNotice } from './doctorDeskUtils';
import {
  buildLabResultsReadyNotice,
} from './labResultsToast';
import { printRxWithNotice } from '../pharm-ops/pharmOpsPrintRx';
import { useDoctorShortcutNav } from './useDoctorShortcutNav';
import { DOCTOR_LEFT_VIA_KEY } from './doctorShortcutNav';
import { setDoctorDeskCurrencyFormat } from './doctorDeskUtils';
import type { DoctorSignMeta } from './DoctorPatientBanner';
import { DoctorDeskLayout } from './doctorDeskUi';
import { applyConsultPayload } from './doctorDeskPayload';
import { postDoctorAction } from './postDoctorAction';
import { useNarrowDoctorDesk } from './useNarrowDoctorDesk';
import { useDoctorDeskQueue } from './useDoctorDeskQueue';
import { DoctorDeskModals } from './DoctorDeskModals';

const STORAGE_KEY = 'doctor_desk_active_visit_id';

export function DoctorDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  pollMs = 30_000,
  visitBoardUrl,
  multiDoctorFilters = false,
  doctorRosterEnabled = false,
  advisoryRoutingEnabled = false,
  sharedDeviceWarning = false,
  labPanelOrderEnabled = false,
  formularyRxEnabled = false,
  currencyFormat,
  labResultsToastEnabled = false,
  canRxAllergyOverride = false,
}: DoctorDeskProps) {
  useEffect(() => {
    if (currencyFormat) {
      setDoctorDeskCurrencyFormat({
        currency_symbol: currencyFormat.currency_symbol ?? '',
        currency_decimals: currencyFormat.currency_decimals ?? 2,
        currency_symbol_position: currencyFormat.currency_symbol_position === 'after' ? 'after' : 'before',
      });
    }
  }, [currencyFormat]);

  const [scope, setScope] = useState<'me' | 'all'>(multiDoctorFilters ? 'me' : 'all');
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const narrowDesk = useNarrowDoctorDesk();

  const [mode, setMode] = useState<ActiveMode>('idle');
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const [activeVisit, setActiveVisit] = useState<DoctorConsultPayload['visit'] | null>(null);
  const [activePreview, setActivePreview] = useState<DoctorConsultPayload['preview'] | null>(null);
  const [routingPreview, setRoutingPreview] = useState<RoutingPreview | null>(null);
  const [signMeta, setSignMeta] = useState<DoctorSignMeta | null>(null);
  const [pharmOpsConsult, setPharmOpsConsult] = useState<{
    pharm_ops_enabled?: boolean;
    rx_print_enabled?: boolean;
    can_print_rx?: boolean;
    prescriptions?: PharmacyPrescriptionLine[];
    rx_list_url?: string;
  }>({});
  const [interrupt, setInterrupt] = useState<DeskInterrupt | null>(null);

  const [routingOpen, setRoutingOpen] = useState(false);
  const [labPanelOpen, setLabPanelOpen] = useState(false);
  const [formularyRxOpen, setFormularyRxOpen] = useState(false);
  const [docFavoritesOpen, setDocFavoritesOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<DoctorReopenableRow | null>(null);
  const [overrideCard, setOverrideCard] = useState<DoctorQueueCard | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [hardAssignOverrideCard, setHardAssignOverrideCard] = useState<DoctorQueueCard | null>(null);
  const [findDrawerOpen, setFindDrawerOpen] = useState(false);
  const [walkIn, setWalkIn] = useState<{
    pid: number;
    patientName: string;
    patientMrn: string;
    visitTypes: VisitType[];
    submitting: boolean;
    error: string | null;
  } | null>(null);

  const activeVisitRef = useRef(activeVisit);
  useEffect(() => {
    activeVisitRef.current = activeVisit;
  }, [activeVisit]);

  const modalOpenRef = useRef(false);
  useEffect(() => {
    modalOpenRef.current = labPanelOpen || formularyRxOpen || routingOpen || docFavoritesOpen;
  }, [labPanelOpen, formularyRxOpen, routingOpen, docFavoritesOpen]);

  const facilityParams = useMemo<Record<string, string | number> | undefined>(
    () => (facilityId > 0 ? { facility_id: facilityId } : undefined),
    [facilityId],
  );

  const resetActivePane = useCallback(() => {
    setMode('idle');
    activeVisitRef.current = null;
    setActiveVisit(null);
    setActivePreview(null);
    setRoutingPreview(null);
    setSignMeta(null);
    setPharmOpsConsult({});
    setRoutingOpen(false);
    setLabPanelOpen(false);
    setFormularyRxOpen(false);
  }, []);

  const loadActiveConsultRef = useRef<(visitId: number) => Promise<DoctorConsultPayload | null>>(async () => null);

  usePageHeadingButton('nc-doctor-find-patient', () => setFindDrawerOpen(true));

  const sharedSession = useSharedDeviceSession({
    enabled: sharedDeviceWarning,
    ajaxUrl,
    csrfToken,
    facilityId,
    storageKey: STORAGE_KEY,
    compareMode: 'clinical',
    restoreAction: 'doctor.restore_session',
    onReturnToQueue: resetActivePane,
    onSessionRestored: () => {
      const storedId = getDeskActiveVisitId(STORAGE_KEY);
      if (storedId > 0) void loadActiveConsultRef.current(storedId);
    },
  });

  const queue = useDoctorDeskQueue({
    ajaxUrl,
    csrfToken,
    scope,
    facilityParams,
    advisoryRoutingEnabled,
    labResultsToastEnabled,
    pollMs,
    resetActivePane,
    clearActiveVisitId: sharedSession.clearActiveVisitId,
    setActiveVisit,
    modeRef,
    activeVisitRef,
    modalOpenRef,
    loadActiveConsultRef,
  });

  const {
    resultsReadyRef,
    resultsReadyBaselinedRef,
    fetchQueue,
    fetchQueueRef,
  } = queue;

  const roster = useDoctorRoster({
    ajaxUrl,
    csrfToken,
    facilityId,
    visitDate: queue.visitDate,
    refreshToken: queue.queueRefreshToken,
    enabled: doctorRosterEnabled,
  });

  const teamRosterExtra = doctorRosterEnabled ? (
    <DoctorTeamRoster
      doctors={roster.doctors}
      myUserId={roster.myUserId}
      loading={roster.loading}
    />
  ) : null;

  const shortcutNav = useDoctorShortcutNav({
    ajaxUrl,
    csrfToken,
    canRxAllergyOverride,
    preview: activePreview,
    visit: activeVisit,
    onError: (message) => showDeskToast(message, 'danger'),
  });

  const loadActiveConsult = useCallback(async (visitId: number): Promise<DoctorConsultPayload | null> => {
    setMode('loading');
    setInterrupt(null);

    try {
      const data = await oeFetch<DoctorConsultPayload>('doctor.active', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId },
      });

      applyConsultPayload(
        data,
        setActiveVisit,
        setActivePreview,
        setRoutingPreview,
        setSignMeta,
        sharedSession.setActiveVisitId,
        setPharmOpsConsult,
        activeVisitRef,
      );
      setMode('consult');

      const isReady = !!data.routing_chips?.results_ready;
      const previousReady = resultsReadyRef.current[data.visit.id] ?? false;
      resultsReadyRef.current[data.visit.id] = isReady;
      if (resultsReadyBaselinedRef.current) {
        const labNotice = buildLabResultsReadyNotice(
          data.visit.id,
          data.preview.identity.display_name,
          data.visit.queue_number,
          previousReady,
          isReady,
          labResultsToastEnabled,
        );
        if (labNotice) {
          showDeskNotice(labNotice);
        }
      }

      return data;
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedSession.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePane();
        sharedSession.clearActiveVisitId();
        return null;
      }
      if (err instanceof OeFetchError && err.status === 400) {
        sharedSession.clearActiveVisitId();
      }
      setMode('error');
      return null;
    }
  }, [ajaxUrl, csrfToken, resetActivePane, sharedSession, labResultsToastEnabled, resultsReadyRef, resultsReadyBaselinedRef]);

  useEffect(() => {
    loadActiveConsultRef.current = loadActiveConsult;
  }, [loadActiveConsult]);

  useEffect(() => {
    const storedId = getDeskActiveVisitId(STORAGE_KEY);
    if (storedId > 0 && mode === 'idle') {
      void loadActiveConsult(storedId);
    }
  // mount-only session restore
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPageShow = () => {
      const storedId = getDeskActiveVisitId(STORAGE_KEY);
      const leftVia = window.sessionStorage.getItem(DOCTOR_LEFT_VIA_KEY);
      if (storedId <= 0) return;

      void loadActiveConsultRef.current(storedId).then((payload) => {
        if (!payload) return;

        if (leftVia === 'lab') {
          window.sessionStorage.removeItem(DOCTOR_LEFT_VIA_KEY);
          const returnNotice = labReturnNotice(payload.routing_chips);
          if (returnNotice) showDeskNotice(returnNotice);
          void fetchQueueRef.current();
          return;
        }

        if (leftVia === 'rx') {
          window.sessionStorage.removeItem(DOCTOR_LEFT_VIA_KEY);
          const returnNotice = rxReturnNotice(payload);
          if (returnNotice) showDeskNotice(returnNotice);
          void fetchQueueRef.current();
        }
      });
    };

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [fetchQueueRef]);

  const executeTakePatient = useCallback(async (card: DoctorQueueCard, overrideReason?: string) => {
    if (sharedSession.blocked || queue.hasActiveConsult) return;

    setMode('loading');
    setInterrupt(null);

    try {
      const fresh = await oeFetch<DoctorQueueData>('doctor.queue', {
        ajaxUrl,
        csrfToken,
        params: { scope, ...(facilityParams ?? {}) },
      });
      const match = [...(fresh.visits ?? []), ...(fresh.claim_lost_cards ?? [])]
        .find((v) => v.id === card.id);

      if (!match || match.claim_lost) {
        setInterrupt({ type: 'visit_not_takeable', message: 'Visit is no longer in the queue.' });
        resetActivePane();
        void fetchQueue();
        return;
      }

      const data = await oeFetch<DoctorConsultPayload>('doctor.take', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: card.id,
          row_version: match.row_version ?? 0,
          ...(overrideReason ? { override_reason: overrideReason } : {}),
        },
      });

      applyConsultPayload(
        data,
        setActiveVisit,
        setActivePreview,
        setRoutingPreview,
        setSignMeta,
        sharedSession.setActiveVisitId,
        setPharmOpsConsult,
        activeVisitRef,
      );
      setMode('consult');
      void fetchQueue();
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedSession.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePane();
        void fetchQueue();
        return;
      }
      setMode('error');
    }
  }, [
    ajaxUrl,
    csrfToken,
    facilityParams,
    fetchQueue,
    queue.hasActiveConsult,
    resetActivePane,
    scope,
    sharedSession,
  ]);

  const handleTakePatient = useCallback((card: DoctorQueueCard) => {
    const hardAssignedId = card.hard_assigned_provider_id ?? 0;
    const needsHardOverride = hardAssignedId > 0
      && queue.myUserId > 0
      && hardAssignedId !== queue.myUserId
      && queue.canTakeAssignedOverride;

    if (needsHardOverride) {
      setHardAssignOverrideCard(card);
      return;
    }

    const suggestedId = card.routing_suggested_provider_id ?? 0;
    const needsRoutingOverride = queue.advisoryEnabled
      && queue.requireOverrideReason
      && suggestedId > 0
      && queue.myUserId > 0
      && suggestedId !== queue.myUserId;

    if (needsRoutingOverride) {
      setOverrideCard(card);
      return;
    }

    void executeTakePatient(card);
  }, [executeTakePatient, queue]);

  const handleInterruptDismiss = useCallback(() => {
    setInterrupt(null);
    resetActivePane();
    sharedSession.clearActiveVisitId();
    void fetchQueue();
  }, [fetchQueue, resetActivePane, sharedSession]);

  const handleComplete = useCallback(() => {
    if (sharedSession.blocked) return;
    setRoutingOpen(true);
  }, [sharedSession.blocked]);

  const handleRoutingCompleted = useCallback(() => {
    setRoutingOpen(false);
    setInterrupt(null);
    resetActivePane();
    sharedSession.clearActiveVisitId();
    void fetchQueue();
  }, [fetchQueue, resetActivePane, sharedSession]);

  const handleReopened = useCallback((payload: DoctorConsultPayload) => {
    setReopenTarget(null);
    showDeskToast('Consult reopened — you can order lab or Rx. Signed notes stay locked.', 'success');
    applyConsultPayload(
      payload,
      setActiveVisit,
      setActivePreview,
      setRoutingPreview,
      setSignMeta,
      sharedSession.setActiveVisitId,
      setPharmOpsConsult,
      activeVisitRef,
    );
    setMode('consult');
    void fetchQueue();
  }, [fetchQueue, sharedSession]);

  const selfReopenInFlightRef = useRef(false);

  /**
   * Reopening your own patient is frictionless — no reason prompt, one click. The reopenable-today
   * list is already scoped to the current doctor's own visits (regular doctors never see someone
   * else's patient here), so this only ever fires for your own encounter; the reason-required
   * ReopenModal stays reserved for the admin-viewing-someone-else's-patient case.
   */
  const handleReopenClick = useCallback((row: DoctorReopenableRow) => {
    const isOwnVisit = queue.myUserId > 0 && row.assigned_provider_id === queue.myUserId;
    if (!isOwnVisit) {
      setReopenTarget(row);
      return;
    }
    if (selfReopenInFlightRef.current) return;
    selfReopenInFlightRef.current = true;

    void (async () => {
      const result = await postDoctorAction<DoctorConsultPayload>({
        ajaxUrl,
        csrfToken,
        facilityId,
        action: 'doctor.reopen',
        body: { visit_id: row.id, row_version: row.row_version ?? 0 },
      });

      selfReopenInFlightRef.current = false;

      if (!result.ok) {
        const msg = result.message.toLowerCase();
        if (msg.includes('stale') || msg.includes('updated elsewhere') || msg.includes('not takeable')) {
          setInterrupt({ type: 'generic', message: result.message });
          resetActivePane();
          void fetchQueue();
          return;
        }
        showDeskToast(result.message || 'Reopen failed', 'danger');
        return;
      }

      handleReopened(result.data);
    })();
  }, [ajaxUrl, csrfToken, facilityId, fetchQueue, handleReopened, queue.myUserId, resetActivePane]);

  /**
   * Doctor's own walk-in / self-serve reopen search — scoped to patients with a visit already
   * on the books today; if it's reopenable, jump straight to Reopen Consult (frictionless when
   * it's this doctor's own patient, matching handleReopenClick); if there's no visit at all,
   * offer the walk-in bypass for patients who never passed through Front Desk or Triage.
   */
  const handleFindPatient = useCallback(async (pid: number) => {
    if (!pid) return;

    try {
      const data = await oeFetch<{
        identity: { display_name: string; pubpid: string };
        active_visit?: {
          state: string;
          visit_id: number;
          row_version?: number;
          assigned_provider_id?: number | null;
        };
      }>('patients.preview', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { pid, context: 'doctor' },
      });

      const active = data.active_visit;
      const reopenStates = ['ready_for_lab', 'ready_for_pharmacy', 'ready_for_payment', 'lab_complete', 'pharmacy_complete'];

      if (active && reopenStates.includes(active.state)) {
        const result = await postDoctorAction<DoctorConsultPayload>({
          ajaxUrl,
          csrfToken,
          facilityId,
          action: 'doctor.reopen',
          body: { visit_id: active.visit_id, row_version: active.row_version ?? 0 },
        });
        if (!result.ok) {
          setInterrupt({ type: 'generic', message: result.message || 'Could not reopen this patient' });
          return;
        }
        handleReopened(result.data);
        return;
      }

      if (active) {
        const STATE_LABELS: Record<string, string> = {
          waiting: 'waiting for triage',
          in_triage: 'in triage',
          ready_for_doctor: 'waiting for a doctor',
          with_doctor: 'with a doctor',
          in_lab: 'in the lab',
          in_pharmacy: 'in pharmacy',
        };
        const label = STATE_LABELS[active.state] ?? `in state "${active.state}"`;
        setInterrupt({
          type: 'visit_not_takeable',
          message: `${data.identity.display_name} already has an active visit (${label}).`,
        });
        return;
      }

      const vtData = await oeFetch<{ visit_types: VisitType[] }>('visit.types', {
        ajaxUrl,
        csrfToken,
        params: facilityParams,
      });

      setWalkIn({
        pid,
        patientName: data.identity.display_name,
        patientMrn: data.identity.pubpid,
        visitTypes: vtData.visit_types ?? [],
        submitting: false,
        error: null,
      });
    } catch (err) {
      setInterrupt({
        type: 'generic',
        message: err instanceof Error ? err.message : 'Failed to look up patient',
      });
    }
  }, [ajaxUrl, csrfToken, facilityId, facilityParams, handleReopened]);

  const handleWalkInConfirm = useCallback(async (visitTypeId: number) => {
    if (!walkIn) return;
    setWalkIn((prev) => (prev ? { ...prev, submitting: true, error: null } : prev));

    try {
      const data = await oeFetch<DoctorConsultPayload>('doctor.start_walk_in', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          pid: walkIn.pid,
          visit_type_id: visitTypeId,
          ...(facilityId > 0 ? { facility_id: facilityId } : {}),
        },
      });

      setWalkIn(null);
      applyConsultPayload(
        data,
        setActiveVisit,
        setActivePreview,
        setRoutingPreview,
        setSignMeta,
        sharedSession.setActiveVisitId,
        setPharmOpsConsult,
        activeVisitRef,
      );
      setMode('consult');
      void fetchQueue();
    } catch (err) {
      setWalkIn((prev) =>
        prev ? { ...prev, submitting: false, error: err instanceof Error ? err.message : 'Failed to start visit' } : prev
      );
    }
  }, [walkIn, ajaxUrl, csrfToken, facilityId, fetchQueue, sharedSession]);

  const handleSupervisorUpdated = useCallback((meta: DoctorSupervisorMeta) => {
    setSignMeta((prev) => (prev ? {
      ...prev,
      supervisor_id: meta.supervisor_id,
      supervisor_display_name: meta.supervisor_display_name,
      supervisor_from_profile: meta.supervisor_from_profile,
    } : prev));
  }, []);

  const handleLabPlaced = useCallback((result: LabPanelPlaceResult) => {
    setLabPanelOpen(false);
    setSignMeta((prev) => (prev ? { ...prev, routing_chips: result.routing_chips } : prev));
    showDeskNotice(labPanelPlaceNotice(result));
    void fetchQueue();
  }, [fetchQueue]);

  const handleFormularyRxPlaced = useCallback((result: FormularyRxPlaceResult) => {
    setFormularyRxOpen(false);
    setPharmOpsConsult((prev) => ({
      ...prev,
      prescriptions: result.prescriptions ?? prev.prescriptions,
    }));
    showDeskNotice(formularyRxPlaceNotice(result));
    void fetchQueue();
  }, [fetchQueue]);

  const handlePrintRx = useCallback(async (prescriptionId: number) => {
    await printRxWithNotice(ajaxUrl, csrfToken, prescriptionId, (message) => {
      showDeskToast(message, 'danger');
    });
  }, [ajaxUrl, csrfToken]);

  const consultPayload: DoctorConsultPayload | null =
    activeVisit && activePreview
      ? {
          visit: activeVisit,
          preview: activePreview,
          routing_preview: routingPreview ?? undefined,
          encounter_signed: signMeta?.encounter_signed ?? false,
          require_esign_before_complete_consult: signMeta?.require_esign_before_complete_consult ?? false,
          encounter_url: signMeta?.encounter_url,
          routing_chips: signMeta?.routing_chips,
          supervisor_id: signMeta?.supervisor_id,
          supervisor_display_name: signMeta?.supervisor_display_name,
          supervisor_from_profile: signMeta?.supervisor_from_profile,
          pharm_ops_enabled: pharmOpsConsult.pharm_ops_enabled,
          rx_print_enabled: pharmOpsConsult.rx_print_enabled,
          can_print_rx: pharmOpsConsult.can_print_rx,
          prescriptions: pharmOpsConsult.prescriptions,
          rx_list_url: pharmOpsConsult.rx_list_url,
          clinical_doc_hub_enabled: signMeta?.documentation_status?.hub_enabled ?? false,
          documentation_status: signMeta?.documentation_status ?? undefined,
        }
      : null;

  const statusBarTrailing = useMemo(() => {
    const showDuty = doctorRosterEnabled && roster.self;
    const showScope = multiDoctorFilters;
    if (!showDuty && !showScope) return undefined;
    return (
      <>
        {showDuty && (
          <DoctorDutyToggle
            taking={roster.self!.taking_patients}
            saving={roster.saving}
            onToggle={(next) => { void roster.toggleTaking(next); }}
          />
        )}
        {showScope && (
          <NativeSelect
            className="h-7 w-auto"
            style={{ maxWidth: 120 }}
            id="nc-doctor-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value === 'all' ? 'all' : 'me')}
            aria-label="Queue scope"
          >
            <option value="me">Me</option>
            <option value="all">All</option>
          </NativeSelect>
        )}
      </>
    );
  }, [doctorRosterEnabled, roster, multiDoctorFilters, scope]);

  return (
    <div id="nc-doctor-desk" className="nc-doctor-react-active">
      <DeskInterruptBanner interrupt={interrupt} onDismiss={handleInterruptDismiss} />

      {sharedSession.probeData && (
        <DeskSharedDeviceBanner
          prefix="nc-doctor"
          probeData={sharedSession.probeData}
          compareMode="clinical"
          restoring={sharedSession.restoring}
          onRestore={() => void sharedSession.restoreSession()}
          onReturnToQueue={sharedSession.returnToQueue}
        />
      )}

      <DeskQueueStatusBar
        id="nc-doctor-status-bar"
        ariaLabel="Doctor desk status"
        items={[
          {
            label: 'Waiting',
            value: queue.counts?.waiting ?? 0,
            href: (queue.counts?.waiting ?? 0) > 0 ? visitBoardUrl : undefined,
          },
          { label: 'Done today', value: queue.counts?.done_today ?? 0 },
          ...(queue.canReopenConsult
            ? [{ label: 'Reopenable', value: queue.counts?.reopenable_today ?? 0 }]
            : []),
        ]}
        loading={queue.queueLoading}
        trailing={statusBarTrailing}
      />

      <div className="nc-doctor-desk">
        <DoctorDeskLayout
          activePane={(
            <DoctorActivePane
              mode={mode}
              payload={consultPayload}
              signMeta={signMeta}
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              facilityId={facilityId}
              visitBoardUrl={visitBoardUrl}
              blocked={sharedSession.blocked}
              labPanelOrderEnabled={labPanelOrderEnabled}
              formularyRxEnabled={formularyRxEnabled}
              onComplete={handleComplete}
              onOpenLabPanel={() => setLabPanelOpen(true)}
              onOpenFormularyRx={() => setFormularyRxOpen(true)}
              onOpenDocFavorites={
                consultPayload?.clinical_doc_hub_enabled ? () => setDocFavoritesOpen(true) : undefined
              }
              runShortcut={shortcutNav.runShortcut}
              onShortcutError={(msg) => showDeskToast(msg, 'danger')}
              onPrintRx={(id) => { void handlePrintRx(id); }}
              onSupervisorUpdated={handleSupervisorUpdated}
              onSupervisorNotice={(message, variant) => showDeskToast(message, variant)}
            />
          )}
          queue={(
            <DoctorQueue
              cards={queue.cards}
              doneToday={queue.doneToday ?? []}
              reopenableToday={queue.reopenableToday ?? []}
              canReopenConsult={queue.canReopenConsult}
              hasActiveConsult={queue.hasActiveConsult}
              loading={queue.queueLoading}
              error={queue.queueError}
              queueHeaderExtra={teamRosterExtra}
              onTakePatient={(card) => void handleTakePatient(card)}
              onReopenClick={handleReopenClick}
            />
          )}
        />
      </div>

      {narrowDesk && !queue.hasActiveConsult && (
        <>
          <DoctorMobileQueueBar
            waitingCount={queue.counts?.waiting ?? queue.cards.length}
            hasActiveConsult={queue.hasActiveConsult}
            onOpen={() => setMobileQueueOpen(true)}
          />
          <DoctorMobileQueueSheet
            open={mobileQueueOpen}
            onClose={() => setMobileQueueOpen(false)}
            waitingCount={queue.counts?.waiting ?? queue.cards.length}
            cards={queue.cards}
            doneToday={queue.doneToday ?? []}
            reopenableToday={queue.reopenableToday ?? []}
            canReopenConsult={queue.canReopenConsult}
            hasActiveConsult={queue.hasActiveConsult}
            loading={queue.queueLoading}
            error={queue.queueError}
            onTakePatient={(card) => void handleTakePatient(card)}
            onReopenClick={setReopenTarget}
            queueHeaderExtra={teamRosterExtra}
          />
        </>
      )}

      <DoctorDeskModals
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={sharedSession.blocked}
        activeVisit={activeVisit}
        activePreview={activePreview}
        routingPreview={routingPreview ?? null}
        routingOpen={routingOpen}
        labPanelOpen={labPanelOpen}
        formularyRxOpen={formularyRxOpen}
        docFavoritesOpen={docFavoritesOpen}
        reopenTarget={reopenTarget}
        overrideCard={overrideCard}
        overrideSubmitting={overrideSubmitting}
        hardAssignOverrideCard={hardAssignOverrideCard}
        shortcutNav={shortcutNav}
        onRoutingClose={() => setRoutingOpen(false)}
        onRoutingCompleted={handleRoutingCompleted}
        onReopenClose={() => setReopenTarget(null)}
        onReopened={handleReopened}
        onReopenConflict={(msg) => {
          setInterrupt({ type: 'generic', message: msg });
          resetActivePane();
          void fetchQueue();
        }}
        onOverrideClose={() => {
          if (!overrideSubmitting) setOverrideCard(null);
        }}
        onOverrideConfirm={(reason) => {
          if (!overrideCard) return;
          setOverrideSubmitting(true);
          void executeTakePatient(overrideCard, reason).finally(() => {
            setOverrideSubmitting(false);
            setOverrideCard(null);
          });
        }}
        onHardAssignClose={() => {
          if (!overrideSubmitting) setHardAssignOverrideCard(null);
        }}
        onHardAssignConfirm={(reason) => {
          if (!hardAssignOverrideCard) return;
          setOverrideSubmitting(true);
          void executeTakePatient(hardAssignOverrideCard, reason).finally(() => {
            setOverrideSubmitting(false);
            setHardAssignOverrideCard(null);
          });
        }}
        onLabPanelClose={() => setLabPanelOpen(false)}
        onLabPlaced={handleLabPlaced}
        onLabFullForm={() => {
          setLabPanelOpen(false);
          if (activeVisit) {
            void shortcutNav.runShortcut('lab');
          }
        }}
        onFormularyRxClose={() => setFormularyRxOpen(false)}
        onFormularyRxPlaced={handleFormularyRxPlaced}
        onFormularyRxFullForm={() => {
          setFormularyRxOpen(false);
          if (activeVisit) {
            void shortcutNav.runShortcut('rx');
          }
        }}
        onDocFavoritesClose={() => setDocFavoritesOpen(false)}
        onDocFavoritesError={(msg) => showDeskToast(msg, 'danger')}
      />

      <FindPatientDrawer
        open={findDrawerOpen}
        onClose={() => setFindDrawerOpen(false)}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        onSelectPatient={(pid) => void handleFindPatient(pid)}
      />

      {walkIn && (
        <DoctorWalkInModal
          open
          patientName={walkIn.patientName}
          patientMrn={walkIn.patientMrn}
          visitTypes={walkIn.visitTypes}
          submitting={walkIn.submitting}
          error={walkIn.error}
          onConfirm={(visitTypeId) => void handleWalkInConfirm(visitTypeId)}
          onClose={() => setWalkIn(null)}
        />
      )}
    </div>
  );
}
