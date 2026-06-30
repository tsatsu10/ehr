/**
 * DoctorDesk — Phase 3A/3B React island replacing jQuery NewClinicDoctor.
 *
 * Layout: col-lg-8 active pane (left) | col-lg-4 queue (right).
 * Mutations: doctor.take, doctor.active, doctor.complete, doctor.reopen,
 * doctor.set_supervisor, doctor.lab_panel_place
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { oeFetch, OeFetchError } from '@core/oeFetch';
import { resolveActionConflict, type DeskInterrupt } from '@core/deskConflict';
import { useInterval } from '@core/useInterval';
import { usePageHeadingToolbar } from '@core/usePageHeadingToolbar';
import { getDeskActiveVisitId, setDeskActiveVisitId } from '@core/deskSessionStorage';
import { useSharedDeviceSession } from '@core/useSharedDeviceSession';
import type {
  DoctorConsultPayload,
  DoctorDeskProps,
  DoctorDoneTodayRow,
  DoctorQueueCard,
  DoctorQueueData,
  DoctorReopenableRow,
  DoctorSupervisorMeta,
  LabPanelPlaceResult,
  FormularyRxPlaceResult,
  PharmacyPrescriptionLine,
  RoutingPreview,
} from '@core/types';
import { DoctorQueue } from './DoctorQueue';
import { DoctorActivePane, type ActiveMode } from './DoctorActivePane';
import { DeskInterruptBanner } from '@components/DeskInterruptBanner';
import { DeskSharedDeviceBanner } from '@components/DeskSharedDeviceBanner';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { RoutingModal } from './RoutingModal';
import { ReopenModal } from './ReopenModal';
import { LabPanelModal, labPanelPlaceNotice, labReturnNotice } from './LabPanelModal';
import { FormularyRxModal, formularyRxPlaceNotice } from './FormularyRxModal';
import { DocFavoritesDrawer } from './DocFavoritesDrawer';
import { rxReturnNotice } from './doctorDeskUtils';
import { printRxWithNotice } from '../pharm-ops/pharmOpsPrintRx';
import { DOCTOR_LEFT_VIA_KEY } from './ConsultShortcuts';
import { setDoctorDeskCurrencyFormat } from './doctorDeskUtils';
import type { DoctorSignMeta } from './DoctorPatientBanner';

const STORAGE_KEY = 'doctor_desk_active_visit_id';

type DeskNotice = { message: string; variant: 'success' | 'warning' | 'danger' | 'info' };

function payloadToSignMeta(data: DoctorConsultPayload): DoctorSignMeta {
  return {
    encounter_signed: !!data.encounter_signed,
    require_esign_before_complete_consult: !!data.require_esign_before_complete_consult,
    encounter_url: data.encounter_url,
    routing_chips: data.routing_chips,
    supervisor_id: data.supervisor_id,
    supervisor_display_name: data.supervisor_display_name,
    supervisor_from_profile: data.supervisor_from_profile,
    documentation_status: data.documentation_status ?? null,
  };
}

function applyConsultPayload(
  data: DoctorConsultPayload,
  setActiveVisit: (v: DoctorConsultPayload['visit']) => void,
  setActivePreview: (p: DoctorConsultPayload['preview']) => void,
  setRoutingPreview: (r: RoutingPreview | null) => void,
  setSignMeta: (s: DoctorSignMeta) => void,
  setActiveVisitId: (id: number) => void,
  setPharmOpsConsult: (value: {
    pharm_ops_enabled?: boolean;
    rx_print_enabled?: boolean;
    can_print_rx?: boolean;
    prescriptions?: PharmacyPrescriptionLine[];
    rx_list_url?: string;
  }) => void,
) {
  setActiveVisit(data.visit);
  setActivePreview(data.preview);
  setRoutingPreview(data.routing_preview ?? null);
  setSignMeta(payloadToSignMeta(data));
  setActiveVisitId(data.visit.id);
  setPharmOpsConsult({
    pharm_ops_enabled: data.pharm_ops_enabled,
    rx_print_enabled: data.rx_print_enabled,
    can_print_rx: data.can_print_rx,
    prescriptions: data.prescriptions,
    rx_list_url: data.rx_list_url,
  });
}

export function DoctorDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  pollMs = 30_000,
  visitBoardUrl,
  multiDoctorFilters = false,
  sharedDeviceWarning = false,
  labPanelOrderEnabled = false,
  formularyRxEnabled = false,
  currencyFormat,
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
  const [cards, setCards] = useState<DoctorQueueCard[]>([]);
  const [counts, setCounts] = useState<DoctorQueueData['counts'] | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [doneToday, setDoneToday] = useState<DoctorDoneTodayRow[]>([]);
  const [reopenableToday, setReopenableToday] = useState<DoctorReopenableRow[]>([]);
  const [canReopenConsult, setCanReopenConsult] = useState(false);
  const [hasActiveConsult, setHasActiveConsult] = useState(false);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [mode, setMode] = useState<ActiveMode>('idle');
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
  const [notice, setNotice] = useState<DeskNotice | null>(null);

  const [routingOpen, setRoutingOpen] = useState(false);
  const [labPanelOpen, setLabPanelOpen] = useState(false);
  const [formularyRxOpen, setFormularyRxOpen] = useState(false);
  const [docFavoritesOpen, setDocFavoritesOpen] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<DoctorReopenableRow | null>(null);

  const queueSeq = useRef(0);
  const activeVisitRef = useRef(activeVisit);
  useEffect(() => {
    activeVisitRef.current = activeVisit;
  }, [activeVisit]);

  const facilityParams = useMemo<Record<string, string | number> | undefined>(
    () => (facilityId > 0 ? { facility_id: facilityId } : undefined),
    [facilityId],
  );

  const resetActivePane = useCallback(() => {
    setMode('idle');
    setActiveVisit(null);
    setActivePreview(null);
    setRoutingPreview(null);
    setSignMeta(null);
    setPharmOpsConsult({});
    setRoutingOpen(false);
    setLabPanelOpen(false);
    setFormularyRxOpen(false);
  }, []);

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
      );
      setMode('consult');
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
      // Stale stored visit (e.g. consult completed elsewhere) — stop retrying on every mount.
      if (err instanceof OeFetchError && err.status === 400) {
        sharedSession.clearActiveVisitId();
      }
      setMode('error');
      return null;
    }
  }, [ajaxUrl, csrfToken, resetActivePane, sharedSession]);

  const loadActiveConsultRef = useRef(loadActiveConsult);
  useEffect(() => {
    loadActiveConsultRef.current = loadActiveConsult;
  }, [loadActiveConsult]);

  const fetchQueue = useCallback(async () => {
    queueSeq.current += 1;
    const token = queueSeq.current;

    try {
      const data = await oeFetch<DoctorQueueData>('doctor.queue', {
        ajaxUrl,
        csrfToken,
        params: { scope, ...(facilityParams ?? {}) },
      });

      if (token !== queueSeq.current) return;

      const merged = [
        ...(data.visits ?? []),
        ...(data.claim_lost_cards ?? []).filter((c) => c.claim_lost),
      ];
      setCards(merged);
      setCounts(data.counts ?? null);
      setVisitDate(data.visit_date ?? null);
      setDoneToday(data.done_today ?? []);
      setReopenableToday(data.reopenable_today ?? []);
      setCanReopenConsult(!!data.can_reopen_consult);
      setHasActiveConsult(!!data.has_active_consult);
      setQueueError(null);
      setLastUpdated(new Date());

      const current = activeVisitRef.current;

      if (data.active_consult && !current) {
        void loadActiveConsultRef.current(data.active_consult.id);
      }

      if (current) {
        const activeId = current.id;
        const queueMatch = merged.find((c) => c.id === activeId);
        if (queueMatch?.row_version != null) {
          setActiveVisit((v) => (v ? { ...v, row_version: queueMatch.row_version } : v));
        } else if (data.active_consult?.id === activeId && data.active_consult.row_version != null) {
          setActiveVisit((v) =>
            v ? { ...v, row_version: data.active_consult!.row_version } : v
          );
        }

        const onQueue = !!queueMatch;
        const stillMine = data.active_consult?.id === activeId;
        if (!onQueue && !stillMine) {
          resetActivePane();
          sharedSession.clearActiveVisitId();
          setHasActiveConsult(!!data.has_active_consult);
        }
      }
    } catch (err) {
      if (token !== queueSeq.current) return;
      setQueueError(err instanceof Error ? err.message : 'Queue load failed');
    } finally {
      if (token === queueSeq.current) setQueueLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajaxUrl, csrfToken, scope, facilityId]);

  const fetchQueueRef = useRef(fetchQueue);
  useEffect(() => {
    fetchQueueRef.current = fetchQueue;
  }, [fetchQueue]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  useInterval(() => {
    if (!document.hidden) void fetchQueue();
  }, pollMs);

  usePageHeadingToolbar({
    dateElementId: 'nc-doctor-date',
    updatedElementId: 'nc-doctor-updated',
    refreshButtonId: 'nc-doctor-refresh',
    visitDate,
    lastUpdated,
    onRefresh: fetchQueue,
  });

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
          if (returnNotice) setNotice(returnNotice);
          void fetchQueueRef.current();
          return;
        }

        if (leftVia === 'rx') {
          window.sessionStorage.removeItem(DOCTOR_LEFT_VIA_KEY);
          const returnNotice = rxReturnNotice(payload);
          if (returnNotice) setNotice(returnNotice);
          void fetchQueueRef.current();
        }
      });
    };

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleTakePatient = useCallback(async (card: DoctorQueueCard) => {
    if (sharedSession.blocked || hasActiveConsult) return;

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
    hasActiveConsult,
    resetActivePane,
    scope,
    sharedSession,
  ]);

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
    setNotice(null);
    resetActivePane();
    sharedSession.clearActiveVisitId();
    void fetchQueue();
  }, [fetchQueue, resetActivePane, sharedSession]);

  const handleReopened = useCallback((payload: DoctorConsultPayload) => {
    setReopenTarget(null);
    setNotice({
      message: 'Consult reopened — you can order lab or Rx. Signed notes stay locked.',
      variant: 'success',
    });
    applyConsultPayload(
      payload,
      setActiveVisit,
      setActivePreview,
      setRoutingPreview,
      setSignMeta,
      sharedSession.setActiveVisitId,
      setPharmOpsConsult,
    );
    setMode('consult');
    void fetchQueue();
  }, [fetchQueue, sharedSession]);

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
    setNotice(labPanelPlaceNotice(result));
    void fetchQueue();
  }, [fetchQueue]);

  const handleFormularyRxPlaced = useCallback((result: FormularyRxPlaceResult) => {
    setFormularyRxOpen(false);
    setPharmOpsConsult((prev) => ({
      ...prev,
      prescriptions: result.prescriptions ?? prev.prescriptions,
    }));
    setNotice(formularyRxPlaceNotice(result));
    void fetchQueue();
  }, [fetchQueue]);

  const handlePrintRx = useCallback(async (prescriptionId: number) => {
    await printRxWithNotice(ajaxUrl, csrfToken, prescriptionId, (message) => {
      setNotice({ variant: 'danger', message });
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
        }
      : null;

  return (
    <div id="nc-doctor-desk" className="oe-nc-doctor-react-active">
      {notice && (
        <div className={`alert alert-${notice.variant} mb-3`} role="status">
          {notice.message}
        </div>
      )}

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
            value: counts?.waiting ?? 0,
            href: (counts?.waiting ?? 0) > 0 ? visitBoardUrl : undefined,
          },
          { label: 'Done today', value: counts?.done_today ?? 0 },
          ...(canReopenConsult
            ? [{ label: 'Reopenable', value: counts?.reopenable_today ?? 0 }]
            : []),
        ]}
        loading={queueLoading}
        onRefresh={() => { void fetchQueue(); }}
        trailing={
          multiDoctorFilters ? (
            <select
              className="form-control form-control-sm"
              style={{ maxWidth: 120, height: 28 }}
              id="nc-doctor-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value === 'all' ? 'all' : 'me')}
              aria-label="Queue scope"
            >
              <option value="me">Me</option>
              <option value="all">All</option>
            </select>
          ) : undefined
        }
      />

      <div className="row">
        <div className="col-lg-8 mb-3">
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
            onShortcutError={(msg) => setNotice({ message: msg, variant: 'danger' })}
            onPrintRx={(id) => { void handlePrintRx(id); }}
            onSupervisorUpdated={handleSupervisorUpdated}
            onSupervisorNotice={(message, variant) => setNotice({ message, variant })}
          />
        </div>

        <div className="col-lg-4 mb-3">
          <DoctorQueue
            cards={cards}
            doneToday={doneToday}
            reopenableToday={reopenableToday}
            canReopenConsult={canReopenConsult}
            hasActiveConsult={hasActiveConsult}
            loading={queueLoading}
            error={queueError}
            onTakePatient={(card) => void handleTakePatient(card)}
            onReopenClick={setReopenTarget}
          />
        </div>
      </div>

      <RoutingModal
        open={routingOpen}
        visit={activeVisit}
        preview={activePreview}
        routingPreview={routingPreview}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={sharedSession.blocked}
        onClose={() => setRoutingOpen(false)}
        onCompleted={handleRoutingCompleted}
      />

      <ReopenModal
        open={reopenTarget !== null}
        target={reopenTarget}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={sharedSession.blocked}
        onClose={() => setReopenTarget(null)}
        onReopened={handleReopened}
        onConflict={(msg) => {
          setInterrupt({ type: 'generic', message: msg });
          resetActivePane();
          void fetchQueue();
        }}
      />

      <LabPanelModal
        open={labPanelOpen}
        visit={activeVisit}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={sharedSession.blocked}
        onClose={() => setLabPanelOpen(false)}
        onPlaced={handleLabPlaced}
        onFullLabForm={() => {
          setLabPanelOpen(false);
          if (activeVisit) {
            setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
            window.sessionStorage.setItem(DOCTOR_LEFT_VIA_KEY, 'lab');
            void oeFetch<{ redirect_url: string }>('doctor.shortcut_preflight', {
              ajaxUrl,
              csrfToken,
              method: 'POST',
              json: { visit_id: activeVisit.id, shortcut: 'lab' },
            }).then((data) => {
              window.location.assign(data.redirect_url);
            }).catch((err) => {
              setNotice({
                message: err instanceof Error ? err.message : 'Shortcut failed',
                variant: 'danger',
              });
            });
          }
        }}
      />

      <FormularyRxModal
        open={formularyRxOpen}
        visit={activeVisit}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        blocked={sharedSession.blocked}
        onClose={() => setFormularyRxOpen(false)}
        onPlaced={handleFormularyRxPlaced}
        onFullRxForm={() => {
          setFormularyRxOpen(false);
          if (activeVisit) {
            setDeskActiveVisitId(STORAGE_KEY, activeVisit.id);
            window.sessionStorage.setItem(DOCTOR_LEFT_VIA_KEY, 'rx');
            void oeFetch<{ redirect_url: string }>('doctor.shortcut_preflight', {
              ajaxUrl,
              csrfToken,
              method: 'POST',
              json: { visit_id: activeVisit.id, shortcut: 'rx' },
            }).then((data) => {
              window.location.assign(data.redirect_url);
            }).catch((err) => {
              setNotice({
                message: err instanceof Error ? err.message : 'Shortcut failed',
                variant: 'danger',
              });
            });
          }
        }}
      />

      <DocFavoritesDrawer
        open={docFavoritesOpen}
        visit={activeVisit}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        blocked={sharedSession.blocked}
        onClose={() => setDocFavoritesOpen(false)}
        onError={(msg) => setNotice({ message: msg, variant: 'danger' })}
      />
    </div>
  );
}
