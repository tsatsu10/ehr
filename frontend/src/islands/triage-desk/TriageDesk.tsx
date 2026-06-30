/**
 * TriageDesk — Phase 2A React island replacing jQuery NewClinicTriage.
 *
 * Layout: two-column (col-lg-4 queue | col-lg-8 active pane).
 * State machine: idle → loading → form → saved → (back to queue).
 *
 * Mutation bridge:
 *  triage.start       waiting → in_triage
 *  triage.save_vitals in_triage → in_triage (vitals recorded)
 *  triage.send_doctor in_triage → ready_for_doctor
 *  triage.auto_start  no-visit patient → new visit + in_triage
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { oeFetch, OeFetchError } from '@core/oeFetch';
import { getDeskActiveVisitId } from '@core/deskSessionStorage';
import { resolveActionConflict, type DeskInterrupt } from '@core/deskConflict';
import { useInterval } from '@core/useInterval';
import { usePageHeadingToolbar, usePageHeadingButton } from '@core/usePageHeadingToolbar';
import type {
  TriageDeskProps,
  TriageQueueCard,
  TriageQueueData,
  TriageSelectData,
  TriageVisit,
  PatientPreview,
  VitalsData,
  VitalsRules,
  VitalName,
  VisitType,
} from '@core/types';
import { TriageQueue } from './TriageQueue';
import { TriageActivePane, type ActiveMode } from './TriageActivePane';
import { DeskInterruptBanner } from '@components/DeskInterruptBanner';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { AutoStartModal } from './AutoStartModal';
import { DeskSharedDeviceBanner } from '@components/DeskSharedDeviceBanner';
import { FindPatientDrawer } from '@components/FindPatientDrawer';
import { useSharedDeviceSession } from '@core/useSharedDeviceSession';

/** sessionStorage key — must match triage.js STORAGE_KEY */
const TRIAGE_STORAGE_KEY = 'triage_desk_active_visit_id';

/**
 * PHP/MySQL may return numeric vitals values (e.g. `{ bps: 120 }` instead of `{ bps: "120" }`).
 * Coerce every value to string so validation and input binding always deal with strings.
 */
function normaliseVitals(raw: Record<string, unknown> | undefined | null): VitalsData {
  if (!raw) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ) as VitalsData;
}

export function TriageDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  pollMs = 30_000,
  visitBoardUrl,
  vitalsRules: initialVitalsRules,
  sharedDeviceWarning = false,
}: TriageDeskProps) {
  // ── Queue state ──────────────────────────────────────────────────────────
  const [cards, setCards] = useState<TriageQueueCard[]>([]);
  const [counts, setCounts] = useState<{ waiting: number; in_triage: number } | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [queueDateFilter, setQueueDateFilter] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [vitalsRules, setVitalsRules] = useState<VitalsRules | undefined>(initialVitalsRules);

  // ── Active pane state ────────────────────────────────────────────────────
  const [mode, setMode] = useState<ActiveMode>('idle');
  const [activeVisit, setActiveVisit] = useState<TriageVisit | null>(null);
  const [activePreview, setActivePreview] = useState<PatientPreview | null>(null);
  const [vitals, setVitals] = useState<VitalsData>({});
  const [savedVitals, setSavedVitals] = useState<VitalsData>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // ── Mutation loading flags ───────────────────────────────────────────────
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Interrupt (conflict) banner ──────────────────────────────────────────
  const [interrupt, setInterrupt] = useState<DeskInterrupt | null>(null);

  // ── Auto-start modal ─────────────────────────────────────────────────────
  const [autoStart, setAutoStart] = useState<{
    pid: number;
    patientName: string;
    patientMrn: string;
    visitTypes: VisitType[];
    submitting: boolean;
    error: string | null;
  } | null>(null);
  const [findDrawerOpen, setFindDrawerOpen] = useState(false);
  const [pendingVisitSwitch, setPendingVisitSwitch] = useState<number | null>(null);

  // Stale-response guard for queue polling
  const queueSeq = useRef(0);
  const selectVisitRef = useRef<(visitId: number, force?: boolean) => Promise<void>>(async () => {});

  // ── Helpers ──────────────────────────────────────────────────────────────

  const facilityParams = useMemo(
    () => (facilityId > 0 ? { facility_id: facilityId } : undefined),
    [facilityId],
  );

  const resetActivePane = useCallback(() => {
    setMode('idle');
    setActiveVisit(null);
    setActivePreview(null);
    setVitals({});
    setSavedVitals({});
    setWarnings([]);
    setRecordCount(0);
    setSavedAt(null);
    setFormDirty(false);
    setChiefComplaint('');
    setFormError(null);
  }, []);

  // ── Queue polling ────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    queueSeq.current += 1;
    const token = queueSeq.current;

    try {
      const data = await oeFetch<TriageQueueData>('triage.queue', {
        ajaxUrl,
        csrfToken,
        params: facilityParams,
      });

      if (token !== queueSeq.current) return;

      const merged = [
        ...(data.visits ?? []),
        ...(data.claim_lost_cards ?? []).filter((c) => c.claim_lost),
      ];
      setCards(merged);
      setCounts(data.counts ?? null);
      setVisitDate(data.visit_date ?? null);
      setQueueDateFilter(data.queue_date_filter ?? null);
      if (data.vitals_unit_label && data.vitals_form_rules) {
        setVitalsRules(data.vitals_form_rules);
      }
      setQueueError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (token !== queueSeq.current) return;
      setQueueError(err instanceof Error ? err.message : 'Queue load failed');
    } finally {
      if (token === queueSeq.current) setQueueLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityParams]);

  useEffect(() => { void fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) void fetchQueue(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchQueue]);

  useInterval(fetchQueue, pollMs);

  usePageHeadingToolbar({
    dateElementId: 'nc-triage-date',
    updatedElementId: 'nc-triage-updated',
    refreshButtonId: 'nc-triage-refresh',
    visitDate,
    lastUpdated,
    onRefresh: fetchQueue,
  });

  usePageHeadingButton('nc-triage-find-patient', () => setFindDrawerOpen(true));

  const sharedDevice = useSharedDeviceSession({
    enabled: sharedDeviceWarning,
    ajaxUrl,
    csrfToken,
    facilityId,
    storageKey: TRIAGE_STORAGE_KEY,
    compareMode: 'clinical',
    restoreAction: 'triage.restore_session',
    onReturnToQueue: () => {
      resetActivePane();
      void fetchQueue();
    },
    onSessionRestored: () => {
      const storedId = getDeskActiveVisitId(TRIAGE_STORAGE_KEY);
      if (storedId > 0) void selectVisitRef.current(storedId, true);
    },
  });

  const resetActivePaneAndSession = useCallback(() => {
    resetActivePane();
    sharedDevice.clearActiveVisitId();
  }, [resetActivePane, sharedDevice]);

  // ── Keep row_version in sync from queue poll ─────────────────────────────
  // Depend only on the primitive id/row_version (not the full object) so this
  // effect does not fire on every pane state update.
  const activeVisitId = activeVisit?.id ?? null;
  const activeVisitRowVersion = activeVisit?.row_version ?? null;
  useEffect(() => {
    if (activeVisitId === null) return;
    const match = cards.find((c) => c.id === activeVisitId);
    if (match?.row_version != null && match.row_version !== activeVisitRowVersion) {
      setActiveVisit((prev) => prev ? { ...prev, row_version: match.row_version } : prev);
    }
  }, [cards, activeVisitId, activeVisitRowVersion]);

  // ── Select patient ───────────────────────────────────────────────────────

  const selectVisit = useCallback(async (visitId: number, force = false) => {
    if (!force && formDirty && activeVisit && activeVisit.id !== visitId) {
      setPendingVisitSwitch(visitId);
      return;
    }

    setMode('loading');
    setFormError(null);

    try {
      const data = await oeFetch<TriageSelectData>('triage.select', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId },
      });

      if (data.vitals_form_rules) setVitalsRules(data.vitals_form_rules);

      setActiveVisit(data.visit);
      setActivePreview(data.preview);
      setChiefComplaint(data.visit.chief_complaint ?? '');
      const normalisedVitals = normaliseVitals(data.form_vitals as Record<string, unknown>);
      setVitals(normalisedVitals);
      setWarnings(data.vitals_warnings ?? []);
      const vitalsCount = (data.vitals ?? []).length;
      setRecordCount(vitalsCount);
      setFormDirty(false);

      // If already has vitals and is in_triage → show saved panel
      const initMode: ActiveMode =
        data.visit.state === 'in_triage' && vitalsCount > 0 ? 'saved' : 'form';
      if (initMode === 'saved') setSavedVitals(normalisedVitals);
      setMode(initMode);
      setInterrupt(null);
      sharedDevice.setActiveVisitId(data.visit.id);

      // Re-poll queue to get updated active indicator
      void fetchQueue();
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedDevice.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePaneAndSession();
        void fetchQueue();
      } else {
        setMode('idle');
        setQueueError(err instanceof Error ? err.message : 'Failed to load patient');
        if (err instanceof OeFetchError && err.status === 400) {
          sharedDevice.clearActiveVisitId();
        }
      }
    }
  }, [ajaxUrl, csrfToken, formDirty, activeVisit, fetchQueue, resetActivePaneAndSession, sharedDevice]);

  useEffect(() => { selectVisitRef.current = selectVisit; }, [selectVisit]);

  useEffect(() => {
    const storedId = getDeskActiveVisitId(TRIAGE_STORAGE_KEY);
    if (storedId > 0 && mode === 'idle') {
      void selectVisitRef.current(storedId, true);
    }
  // mount-only session restore
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start triage ─────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!activeVisit || starting) return;
    setStarting(true);
    setFormError(null);
    try {
      const data = await oeFetch<{ visit: TriageVisit }>('triage.start', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: activeVisit.id, row_version: activeVisit.row_version },
      });
      setInterrupt(null);
      // Re-select to refresh full pane data
      await selectVisit(data.visit.id);
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedDevice.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePaneAndSession();
        void fetchQueue();
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to start triage');
      }
    } finally {
      setStarting(false);
    }
  }, [activeVisit, starting, ajaxUrl, csrfToken, selectVisit, resetActivePaneAndSession, fetchQueue, sharedDevice]);

  // ── Save vitals ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!activeVisit || saving || sharedDevice.blocked) return;
    setSaving(true);
    setFormError(null);
    try {
      const data = await oeFetch<{
        visit: TriageVisit;
        form_vitals: VitalsData;
        vitals_warnings: string[];
        last_vitals_today?: unknown[];
        vitals_abnormal_today?: boolean;
      }>('triage.save_vitals', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: activeVisit.id,
          vitals,
          chief_complaint: chiefComplaint.trim(),
        },
      });

      setInterrupt(null);
      setFormDirty(false);
      setActiveVisit(data.visit);
      const count = (data.last_vitals_today ?? []).length;
      const savedNorm = normaliseVitals(data.form_vitals as Record<string, unknown> ?? vitals as Record<string, unknown>);
      setSavedVitals(savedNorm);
      setVitals(savedNorm);
      setWarnings(data.vitals_warnings ?? []);
      setRecordCount(count);
      setSavedAt(new Date());
      setMode('saved');

      // Update preview vitals summary optimistically
      if (activePreview) {
        setActivePreview({
          ...activePreview,
          vitals_today: {
            vitals_missing_today: false,
            vitals_abnormal_today: !!data.vitals_abnormal_today,
          },
        });
      }

      void fetchQueue();
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedDevice.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePaneAndSession();
        void fetchQueue();
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to save vitals');
      }
    } finally {
      setSaving(false);
    }
  }, [
    activeVisit, saving, ajaxUrl, csrfToken,
    vitals, chiefComplaint, activePreview, fetchQueue, resetActivePaneAndSession, sharedDevice,
  ]);

  // ── Send to doctor ───────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!activeVisit || sending || sharedDevice.blocked) return;
    setSending(true);
    setFormError(null);
    try {
      await oeFetch('triage.send_doctor', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: activeVisit.id,
          row_version: activeVisit.row_version,
          chief_complaint: chiefComplaint.trim(),
        },
      });
      setInterrupt(null);
      resetActivePane();
      void fetchQueue();
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedDevice.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePaneAndSession();
        void fetchQueue();
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to send to doctor');
      }
    } finally {
      setSending(false);
    }
  }, [activeVisit, sending, ajaxUrl, csrfToken, chiefComplaint, resetActivePane, fetchQueue, resetActivePaneAndSession, sharedDevice]);

  // ── Record another set ───────────────────────────────────────────────────

  const handleReenter = useCallback(() => {
    setVitals(savedVitals); // prefill from last save
    setMode('form');
    setFormDirty(false);
  }, [savedVitals]);

  // ── Vitals change handlers ───────────────────────────────────────────────

  const handleVitalChange = useCallback((name: VitalName, value: string) => {
    setVitals((prev) => ({ ...prev, [name]: value }));
    setFormDirty(true);
  }, []);

  const handleChiefComplaintChange = useCallback((value: string) => {
    setChiefComplaint(value);
    setFormDirty(true);
  }, []);

  // ── Interrupt dismiss ────────────────────────────────────────────────────

  const dismissInterrupt = useCallback(() => {
    setInterrupt(null);
    resetActivePaneAndSession();
    void fetchQueue();
  }, [resetActivePaneAndSession, fetchQueue]);

  // ── Card click (queue) ───────────────────────────────────────────────────

  const handleCardClick = useCallback((card: TriageQueueCard) => {
    void selectVisit(card.id);
  }, [selectVisit]);

  const handleFindPatient = useCallback(async (pid: number) => {
    if (!pid) return;

    try {
      const data = await oeFetch<{
        identity: { display_name: string; pubpid: string };
        active_visit?: { state: string; visit_id: number };
      }>('patients.preview', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { pid, context: 'triage' },
      });

      const active = data.active_visit;

      if (active && ['waiting', 'in_triage'].includes(active.state)) {
        void selectVisitRef.current(active.visit_id);
        return;
      }

      if (active) {
        const STATE_LABELS: Record<string, string> = {
          with_doctor: 'with a doctor',
          ready_for_doctor: 'waiting for a doctor',
          in_lab: 'in the lab',
          ready_for_lab: 'waiting for lab',
          in_pharmacy: 'in pharmacy',
          ready_for_pharmacy: 'waiting for pharmacy',
          completed: 'already completed today',
          cancelled: 'cancelled today',
        };
        const label = STATE_LABELS[active.state] ?? `in state "${active.state}"`;
        setInterrupt({
          type: 'visit_not_takeable',
          message: `${data.identity.display_name} already has an active visit (${label}) — cannot start triage.`,
        });
        return;
      }

      const vtData = await oeFetch<{ visit_types: VisitType[] }>('visit.types', {
        ajaxUrl,
        csrfToken,
        params: facilityParams,
      });

      setAutoStart({
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
  }, [ajaxUrl, csrfToken, facilityParams]);

  // ── Confirm auto-start ───────────────────────────────────────────────────

  const handleAutoStartConfirm = useCallback(async (visitTypeId: number, isUrgent: boolean) => {
    if (!autoStart) return;
    setAutoStart((prev) => prev ? { ...prev, submitting: true, error: null } : prev);

    try {
      const body: Record<string, unknown> = {
        pid: autoStart.pid,
        visit_type_id: visitTypeId,
        is_urgent: isUrgent,
      };
      if (facilityId > 0) body.facility_id = facilityId;

      const data = await oeFetch<{ visit: TriageVisit }>('triage.auto_start', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: body,
      });

      setAutoStart(null);
      await fetchQueue();
      await selectVisit(data.visit.id);
    } catch (err) {
      setAutoStart((prev) =>
        prev ? { ...prev, submitting: false, error: err instanceof Error ? err.message : 'Failed to start visit' } : prev
      );
    }
  }, [autoStart, ajaxUrl, csrfToken, facilityId, fetchQueue, selectVisit]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {sharedDevice.probeData && (
        <DeskSharedDeviceBanner
          prefix="nc-triage"
          probeData={sharedDevice.probeData}
          compareMode="clinical"
          restoring={sharedDevice.restoring}
          onRestore={() => void sharedDevice.restoreSession()}
          onReturnToQueue={sharedDevice.returnToQueue}
        />
      )}

      <DeskInterruptBanner interrupt={interrupt} onDismiss={dismissInterrupt} />

      <DeskQueueStatusBar
        id="nc-triage-status-bar"
        ariaLabel="Triage desk status"
        items={[
          {
            label: 'Waiting',
            value: counts?.waiting ?? 0,
            href: (counts?.waiting ?? 0) > 0 ? visitBoardUrl : undefined,
          },
          { label: 'In triage', value: counts?.in_triage ?? 0 },
        ]}
        loading={queueLoading}
        onRefresh={() => { void fetchQueue(); }}
      />

      <div className="row">
        {/* Left: queue */}
        <div className="col-lg-4 mb-3">
          <TriageQueue
            cards={cards}
            activeVisitId={activeVisit?.id ?? null}
            loading={queueLoading}
            error={queueError}
            queueDateFilter={queueDateFilter}
            onCardClick={handleCardClick}
          />
        </div>

        {/* Right: active pane */}
        <div className="col-lg-8 mb-3">
          <TriageActivePane
            mode={mode}
            visit={activeVisit}
            preview={activePreview}
            vitals={vitals}
            chiefComplaint={chiefComplaint}
            savedVitals={savedVitals}
            warnings={warnings}
            recordCount={recordCount}
            savedAt={savedAt}
            vitalsRules={vitalsRules}
            saving={saving}
            sending={sending}
            starting={starting}
            formError={formError}
            visitBoardUrl={visitBoardUrl}
            onVitalsChange={handleVitalChange}
            onChiefComplaintChange={handleChiefComplaintChange}
            onStart={handleStart}
            onSave={handleSave}
            onSend={handleSend}
            onReenter={handleReenter}
          />
        </div>
      </div>

      {/* Auto-start modal */}
      {autoStart && (
        <AutoStartModal
          open
          patientName={autoStart.patientName}
          patientMrn={autoStart.patientMrn}
          visitTypes={autoStart.visitTypes}
          submitting={autoStart.submitting}
          error={autoStart.error}
          onConfirm={handleAutoStartConfirm}
          onClose={() => setAutoStart(null)}
        />
      )}

      <FindPatientDrawer
        open={findDrawerOpen}
        onClose={() => setFindDrawerOpen(false)}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        onSelectPatient={(pid) => void handleFindPatient(pid)}
      />

      <ConfirmModal
        open={pendingVisitSwitch !== null}
        onClose={() => setPendingVisitSwitch(null)}
        title="Switch patient?"
        modalId="nc-triage-switch-modal"
        cancelLabel="Keep editing"
        confirmLabel="Switch"
        confirmVariant="warning"
        onConfirm={() => {
          if (pendingVisitSwitch !== null) {
            void selectVisit(pendingVisitSwitch, true);
          }
          setPendingVisitSwitch(null);
        }}
        identityBanner={(() => {
          const card = pendingVisitSwitch !== null
            ? cards.find((c) => c.id === pendingVisitSwitch)
            : undefined;
          if (!card) return undefined;
          return (
            <IdentityConfirmBanner
              displayName={card.display_name}
              pubpid={card.pubpid}
              queueNumber={card.queue_number}
            />
          );
        })()}
      >
        <p className="mb-0">Discard unsaved vitals and open another patient?</p>
      </ConfirmModal>
    </>
  );
}
