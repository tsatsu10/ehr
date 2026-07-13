/**
 * PharmacyDesk — Phase 6A React island replacing jQuery NewClinicPharmacy.
 */

import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { oeFetch } from '@core/oeFetch';
import { resolveActionConflict, applyPostDeskConflict, type DeskInterrupt } from '@core/deskConflict';
import { useInterval } from '@core/useInterval';
import { useQueueVisibilityRefresh } from '@core/useQueueVisibilityRefresh';
import { usePageHeadingToolbar } from '@core/usePageHeadingToolbar';
import { setDeskActiveVisitId, clearDeskActiveVisitId } from '@core/deskSessionStorage';
import { useSharedDeviceSession } from '@core/useSharedDeviceSession';
import { Button } from '@components/ui/button';
import { DeskInterruptBanner } from '@components/DeskInterruptBanner';
import { DeskQueueStatusBar } from '@components/DeskQueueStatusBar';
import { QueueTruncationBanner } from '@components/QueueTruncationBanner';
import { DeskSharedDeviceBanner } from '@components/DeskSharedDeviceBanner';
import { UndispensedRxModal } from '@components/UndispensedRxModal';
import { ExternalRxIncompleteModal } from '@components/ExternalRxIncompleteModal';
import { EsignOverrideModal } from '@components/EsignOverrideModal';
import { SkipToPaymentModal } from '@components/SkipToPaymentModal';
import { handleDeskCompleteResult } from '@core/deskCompleteAction';
import { postDeskAction } from '@core/postDeskAction';
import type {
  PharmacyDeskProps,
  PharmacyQueueCard,
  PharmacyQueueData,
  PharmacySelectData,
} from '@core/types';
import { PharmacyQueue } from './PharmacyQueue';
import { PharmacyActivePane, type PharmacyActiveMode } from './PharmacyActivePane';
import { PharmacyDeskLayout } from './pharmacyDeskUi';
import { PharmacyMobileQueueBar, PharmacyMobileQueueSheet } from './PharmacyMobileQueueSheet';
import type { OtcSaleInitialContext } from '../pharm-ops/pharmOpsTypes';
import { printRxWithNotice } from '../pharm-ops/pharmOpsPrintRx';
import { openClinicalDocForm } from '@islands/clinical-doc/clinicalDocApi';

const PharmOpsOtcSaleDrawer = lazy(() =>
  import('../pharm-ops/PharmOpsOtcSaleDrawer').then((module) => ({
    default: module.PharmOpsOtcSaleDrawer,
  }))
);

const PharmOpsDispenseDrawer = lazy(() =>
  import('../pharm-ops/PharmOpsDispenseDrawer').then((module) => ({
    default: module.PharmOpsDispenseDrawer,
  }))
);

const STORAGE_KEY = 'pharmacy_desk_active_visit_id';
const NARROW_DESK_QUERY = '(max-width: 1023px)';

function useNarrowPharmacyDesk(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_DESK_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_DESK_QUERY);
    const update = () => setNarrow(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return narrow;
}

export function PharmacyDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  pollMs = 30_000,
  visitBoardUrl,
  canSkipToPayment = false,
  sharedDeviceWarning = false,
  canEsignOverride = false,
  canSellOtc = false,
  pharmOpsEnabled: pharmOpsEnabledProp = false,
  canDispense: canDispenseProp = false,
  canUndispensedOverride: canUndispensedOverrideProp = false,
  canExternalRxOverride: canExternalRxOverrideProp = false,
}: PharmacyDeskProps) {
  const [cards, setCards] = useState<PharmacyQueueCard[]>([]);
  const [queueTruncated, setQueueTruncated] = useState(false);
  const [counts, setCounts] = useState<PharmacyQueueData['counts'] | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [hasActiveWork, setHasActiveWork] = useState(false);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [mode, setMode] = useState<PharmacyActiveMode>('idle');
  const [selectData, setSelectData] = useState<PharmacySelectData | null>(null);
  const [interrupt, setInterrupt] = useState<DeskInterrupt | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [skipOpen, setSkipOpen] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [esignOpen, setEsignOpen] = useState(false);
  const [otcOpen, setOtcOpen] = useState(false);
  const [dispenseRxId, setDispenseRxId] = useState<number | null>(null);
  const [pharmOpsEnabled, setPharmOpsEnabled] = useState(pharmOpsEnabledProp);
  const [canDispense, setCanDispense] = useState(canDispenseProp);
  const [canUndispensedOverride, setCanUndispensedOverride] = useState(canUndispensedOverrideProp);
  const [canExternalRxOverride, setCanExternalRxOverride] = useState(canExternalRxOverrideProp);
  const [undispensedOpen, setUndispensedOpen] = useState(false);
  const [undispensedCount, setUndispensedCount] = useState(0);
  const [undispensedError, setUndispensedError] = useState<string | null>(null);
  const [externalRxOpen, setExternalRxOpen] = useState(false);
  const [externalRxMissing, setExternalRxMissing] = useState<string[]>([]);
  const [externalRxError, setExternalRxError] = useState<string | null>(null);
  const [walkinOutcome, setWalkinOutcome] = useState<string | null>(null);
  const [pendingWalkinClose, setPendingWalkinClose] = useState<string | null>(null);
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const narrowDesk = useNarrowPharmacyDesk();
  const esignActionRef = useRef<'complete' | 'walkin_close'>('complete');

  const queueSeq = useRef(0);
  const revisionRef = useRef('');
  const activeVisitIdRef = useRef<number | null>(null);
  const activeWorkStateRef = useRef<PharmacySelectData['visit']['state'] | null>(null);
  const hasActiveWorkRef = useRef(false);
  const modalOpenRef = useRef(false);

  const facilityParams = useMemo(
    () => (facilityId > 0 ? { facility_id: facilityId } : undefined),
    [facilityId],
  );

  const otcInitialContext = useMemo<OtcSaleInitialContext | null>(() => {
    if (!selectData?.visit?.pid) return null;
    return {
      pid: selectData.visit.pid,
      encounterId: selectData.visit.encounter,
      patientLabel: selectData.preview.identity.display_name,
      mrn: selectData.preview.identity.pubpid,
    };
  }, [selectData]);

  const resetActivePane = useCallback(() => {
    setMode('idle');
    setSelectData(null);
    setActionError(null);
    setWalkinOutcome(null);
    setPendingWalkinClose(null);
    activeVisitIdRef.current = null;
    activeWorkStateRef.current = null;
    clearDeskActiveVisitId(STORAGE_KEY);
  }, []);

  const sharedSession = useSharedDeviceSession({
    enabled: sharedDeviceWarning,
    ajaxUrl,
    csrfToken,
    facilityId,
    storageKey: STORAGE_KEY,
    compareMode: 'clinical',
    restoreAction: 'pharmacy.restore_session',
    onReturnToQueue: () => {
      resetActivePane();
      setHasActiveWork(false);
      hasActiveWorkRef.current = false;
    },
    onSessionRestored: () => {
      const storedId = activeVisitIdRef.current;
      if (storedId && storedId > 0) {
        void selectVisitRef.current(storedId, hasActiveWorkRef.current);
      }
    },
  });

  const applySelectData = useCallback((data: PharmacySelectData) => {
    setSelectData(data);
    setMode('active');
    setInterrupt(null);
    setWalkinOutcome(null);
    if (data.pharm_ops_enabled != null) {
      setPharmOpsEnabled(data.pharm_ops_enabled);
    }
    if (data.can_dispense != null) {
      setCanDispense(data.can_dispense);
    }
    if (data.can_undispensed_override != null) {
      setCanUndispensedOverride(data.can_undispensed_override);
    }
    if (data.can_external_rx_override != null) {
      setCanExternalRxOverride(data.can_external_rx_override);
    }
    sharedSession.setActiveVisitId(data.visit.id);
    activeVisitIdRef.current = data.visit.id;
    activeWorkStateRef.current = data.visit.state;
  }, [sharedSession]);

  useEffect(() => {
    modalOpenRef.current = esignOpen || skipOpen || otcOpen || undispensedOpen || externalRxOpen || mobileQueueOpen;
  }, [esignOpen, skipOpen, otcOpen, undispensedOpen, externalRxOpen, mobileQueueOpen]);

  const fetchQueue = useCallback(async () => {
    queueSeq.current += 1;
    const token = queueSeq.current;

    try {
      const data = await oeFetch<PharmacyQueueData>('pharmacy.queue', {
        ajaxUrl,
        csrfToken,
        // SCALE-1.8 — send our last revision so an unchanged queue skips the re-render.
        params: revisionRef.current
          ? { ...facilityParams, known_revision: revisionRef.current }
          : facilityParams,
      });

      if (token !== queueSeq.current) return;
      if (data.unchanged) {
        setQueueError(null);
        setLastUpdated(new Date());
        return;
      }
      revisionRef.current = data.revision ?? '';

      const merged = [
        ...(data.visits ?? []),
        ...(data.claim_lost_cards ?? []).filter((c) => c.claim_lost),
      ];
      setCards(merged);
      setCounts(data.counts ?? null);
      setQueueTruncated(!!data.queue_truncated);
      setVisitDate(data.visit_date ?? null);
      setHasActiveWork(!!data.has_active_work);
      hasActiveWorkRef.current = !!data.has_active_work;
      setQueueError(null);
      setLastUpdated(new Date());
      if (data.pharm_ops_enabled != null) {
        setPharmOpsEnabled(data.pharm_ops_enabled);
      }

      const activeId = activeVisitIdRef.current;
      if (activeId) {
        const match = merged.find((c) => c.id === activeId);
        if (match?.row_version != null) {
          setSelectData((prev) =>
            prev && prev.visit.id === activeId
              ? { ...prev, visit: { ...prev.visit, row_version: match.row_version } }
              : prev
          );
        }
        const stillMine = data.active_work?.id === activeId;
        const workLocallyActive = activeWorkStateRef.current === 'in_pharmacy';
        if (!match && !stillMine && !workLocallyActive && !modalOpenRef.current) {
          resetActivePane();
          setHasActiveWork(!!data.has_active_work);
          hasActiveWorkRef.current = !!data.has_active_work;
        }
      }
    } catch (err) {
      if (token !== queueSeq.current) return;
      setQueueError(err instanceof Error ? err.message : 'Queue load failed');
    } finally {
      if (token === queueSeq.current) setQueueLoading(false);
    }
  }, [ajaxUrl, csrfToken, facilityParams, resetActivePane]);

  const fetchQueueRef = useRef(fetchQueue);
  useEffect(() => {
    fetchQueueRef.current = fetchQueue;
  }, [fetchQueue]);

  const takePatient = useCallback(async (visitId: number, rowVersion: number) => {
    setSubmitting(true);
    setActionError(null);

    try {
      const data = await oeFetch<PharmacySelectData>('pharmacy.take', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId, row_version: rowVersion },
      });
      applySelectData(data);
      setHasActiveWork(true);
      hasActiveWorkRef.current = true;
      void fetchQueueRef.current();
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedSession.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePane();
        void fetchQueueRef.current();
        return;
      }
      setMode('error');
      setActionError(err instanceof Error ? err.message : 'Take failed');
    } finally {
      setSubmitting(false);
    }
  }, [ajaxUrl, applySelectData, csrfToken, resetActivePane, sharedSession]);

  const selectVisit = useCallback(async (visitId: number, activeWork = hasActiveWorkRef.current) => {
    if (sharedSession.blocked) return;

    setMode('loading');
    setActionError(null);
    setInterrupt(null);

    try {
      const data = await oeFetch<PharmacySelectData>('pharmacy.select', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId },
      });

      if (data.visit.state === 'ready_for_pharmacy' && !activeWork) {
        await takePatient(visitId, data.visit.row_version ?? 0);
        return;
      }

      applySelectData(data);
    } catch (err) {
      const conflict = resolveActionConflict(err, {
        onSessionMismatch: () => void sharedSession.probe(),
      });
      if (conflict) {
        setInterrupt(conflict);
        resetActivePane();
        void fetchQueueRef.current();
        return;
      }
      setMode('error');
      setActionError(err instanceof Error ? err.message : 'Load failed');
    }
  }, [ajaxUrl, applySelectData, csrfToken, resetActivePane, sharedSession, takePatient]);

  const selectVisitRef = useRef(selectVisit);
  useEffect(() => {
    selectVisitRef.current = selectVisit;
  }, [selectVisit]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  useQueueVisibilityRefresh(() => {
    void fetchQueue();
  });

  useInterval(() => {
    if (!document.hidden) void fetchQueue();
  }, pollMs);

  usePageHeadingToolbar({
    dateElementId: 'nc-pharmacy-date',
    updatedElementId: 'nc-pharmacy-updated',
    refreshButtonId: 'nc-pharmacy-refresh',
    visitDate,
    lastUpdated,
    onRefresh: fetchQueue,
  });

  const handleComplete = useCallback(async (options?: {
    esignOverrideReason?: string;
    undispensedOverrideReason?: string;
    externalRxOverrideReason?: string;
  }) => {
    if (!selectData || sharedSession.blocked || submitting) return;

    setSubmitting(true);
    setActionError(null);
    setUndispensedError(null);
    setExternalRxError(null);
    esignActionRef.current = 'complete';

    const body: Record<string, unknown> = {
      visit_id: selectData.visit.id,
      row_version: selectData.visit.row_version ?? 0,
      ...(options?.esignOverrideReason ? { esign_override_reason: options.esignOverrideReason } : {}),
      ...(options?.undispensedOverrideReason
        ? { undispensed_override_reason: options.undispensedOverrideReason }
        : {}),
      ...(options?.externalRxOverrideReason
        ? { external_rx_override_reason: options.externalRxOverrideReason }
        : {}),
    };
    if (selectData.walkin_triage?.enabled && walkinOutcome) {
      body.pharmacy_outcome = walkinOutcome;
    }

    const result = await postDeskAction({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'pharmacy.complete',
      body,
    });

    setSubmitting(false);
    setEsignOpen(false);

    if (!result.ok) {
      if (applyPostDeskConflict(result, {
        onInterrupt: setInterrupt,
        onSessionMismatch: () => void sharedSession.probe(),
        onInlineError: setActionError,
      })) {
        return;
      }
    }

    handleDeskCompleteResult(result, {
      canEsignOverride,
      onSuccess: () => {
        setUndispensedOpen(false);
        setExternalRxOpen(false);
        resetActivePane();
        setHasActiveWork(false);
        hasActiveWorkRef.current = false;
        void fetchQueueRef.current();
      },
      onEsignRequired: () => setEsignOpen(true),
      onUndispensedRx: (data) => {
        setUndispensedCount(data.undispensed_count ?? selectData.undispensed_rx_count ?? 1);
        setUndispensedOpen(true);
      },
      onExternalRxIncomplete: (data) => {
        setExternalRxMissing(data.missing ?? []);
        setExternalRxOpen(true);
      },
      onError: (message) => {
        if (options?.esignOverrideReason) {
          setEsignOpen(true);
        }
        if (options?.undispensedOverrideReason) {
          setUndispensedError(message);
          setUndispensedOpen(true);
        } else if (options?.externalRxOverrideReason) {
          setExternalRxError(message);
          setExternalRxOpen(true);
        } else {
          setActionError(message);
        }
      },
    });
  }, [ajaxUrl, canEsignOverride, csrfToken, facilityId, resetActivePane, selectData, sharedSession, submitting, walkinOutcome]);

  const handleSkip = useCallback(async (reason: string) => {
    if (!selectData || submitting) return;

    setSubmitting(true);
    setSkipError(null);

    try {
      await oeFetch('pharmacy.skip_to_payment', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          visit_id: selectData.visit.id,
          row_version: selectData.visit.row_version ?? 0,
          reason,
        },
      });
      setSkipOpen(false);
      resetActivePane();
      setHasActiveWork(false);
      hasActiveWorkRef.current = false;
      void fetchQueueRef.current();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Skip failed';
      setSkipError(msg);
      if (msg.toLowerCase().includes('not on the pharmacy queue')) {
        setSkipOpen(false);
        resetActivePane();
        setHasActiveWork(false);
        hasActiveWorkRef.current = false;
        void fetchQueueRef.current();
      }
    } finally {
      setSubmitting(false);
    }
  }, [ajaxUrl, csrfToken, resetActivePane, selectData, submitting]);

  const handleWalkinClose = useCallback(async (
    outcome: string,
    options?: { esignOverrideReason?: string },
  ) => {
    if (!selectData || sharedSession.blocked || submitting) return;

    setSubmitting(true);
    setActionError(null);
    esignActionRef.current = 'walkin_close';
    setPendingWalkinClose(outcome);

    const result = await postDeskAction({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'pharmacy.walkin_close',
      body: {
        visit_id: selectData.visit.id,
        row_version: selectData.visit.row_version ?? 0,
        pharmacy_outcome: outcome,
        ...(options?.esignOverrideReason ? { esign_override_reason: options.esignOverrideReason } : {}),
      },
    });

    setSubmitting(false);
    setEsignOpen(false);

    if (!result.ok) {
      if (applyPostDeskConflict(result, {
        onInterrupt: setInterrupt,
        onSessionMismatch: () => void sharedSession.probe(),
        onInlineError: setActionError,
      })) {
        return;
      }
      handleDeskCompleteResult(result, {
        canEsignOverride,
        onSuccess: () => {},
        onEsignRequired: () => setEsignOpen(true),
        onError: setActionError,
      });
      return;
    }

    setPendingWalkinClose(null);
    setWalkinOutcome(null);
    resetActivePane();
    setHasActiveWork(false);
    hasActiveWorkRef.current = false;
    void fetchQueueRef.current();
  }, [ajaxUrl, canEsignOverride, csrfToken, facilityId, resetActivePane, selectData, sharedSession, submitting]);

  const refreshActiveVisit = useCallback(async () => {
    if (!activeVisitIdRef.current) return;
    try {
      const data = await oeFetch<PharmacySelectData>('pharmacy.select', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: activeVisitIdRef.current },
      });
      applySelectData(data);
    } catch {
      // Queue poll will reconcile stale state.
    }
  }, [ajaxUrl, applySelectData, csrfToken]);

  const runShortcut = useCallback(async (shortcut: string) => {
    if (!selectData || sharedSession.blocked) return;

    setDeskActiveVisitId(STORAGE_KEY, selectData.visit.id);

    try {
      const data = await oeFetch<{ redirect_url: string }>('pharmacy.shortcut_preflight', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: selectData.visit.id, shortcut },
      });
      window.location.assign(data.redirect_url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Shortcut failed');
    }
  }, [ajaxUrl, csrfToken, selectData, sharedSession]);

  const handlePrintRx = useCallback(async (prescriptionId: number) => {
    setActionError(null);
    await printRxWithNotice(ajaxUrl, csrfToken, prescriptionId, setActionError);
  }, [ajaxUrl, csrfToken]);

  const openFirstUndispensedDispense = useCallback(() => {
    const firstId = selectData?.prescriptions?.find((line) => line.status === 'to_dispense')?.id;
    setUndispensedOpen(false);
    if (firstId && pharmOpsEnabled && canDispense) {
      setDispenseRxId(firstId);
      return;
    }
    void runShortcut('dispense');
  }, [canDispense, pharmOpsEnabled, runShortcut, selectData]);

  const handleOpenPharmacyService = useCallback(async () => {
    const externalRx = selectData?.walkin_triage?.external_rx;
    if (!selectData || !externalRx) {
      return;
    }

    if (externalRx.clinical_doc_hub_enabled) {
      await openClinicalDocForm(
        ajaxUrl,
        csrfToken,
        selectData.visit.id,
        {
          id: externalRx.pharmacy_service_formdir,
          lens: 'visit',
          formdir: externalRx.pharmacy_service_formdir,
          kind: 'form',
          title: externalRx.pharmacy_service_title,
          description: 'Pharmacy walk-in service note',
          started: externalRx.pharmacy_service_started,
        },
        { returnTo: 'hub' },
      );
      return;
    }

    if (externalRx.documentation_hub_url) {
      window.location.assign(externalRx.documentation_hub_url);
    }
  }, [ajaxUrl, csrfToken, selectData]);

  const openPharmacyServiceFromModal = useCallback(() => {
    setExternalRxOpen(false);
    void handleOpenPharmacyService();
  }, [handleOpenPharmacyService]);

  return (
    <div id="nc-pharmacy-desk" className="nc-pharmacy-react-active">
      <DeskInterruptBanner
        interrupt={interrupt}
        onDismiss={() => {
          setInterrupt(null);
          resetActivePane();
          void fetchQueue();
        }}
      />

      {sharedSession.probeData && (
        <DeskSharedDeviceBanner
          prefix="nc-pharmacy"
          probeData={sharedSession.probeData}
          compareMode="clinical"
          restoring={sharedSession.restoring}
          hint="Restore encounter session or return to the queue before saving."
          onRestore={() => void sharedSession.restoreSession()}
          onReturnToQueue={sharedSession.returnToQueue}
        />
      )}

      <QueueTruncationBanner truncated={queueTruncated} cap={200} />

      <DeskQueueStatusBar
        id="nc-pharmacy-status-bar"
        ariaLabel="Pharmacy desk status"
        items={[
          {
            label: 'Waiting',
            value: counts?.waiting ?? 0,
            href: (counts?.waiting ?? 0) > 0 ? visitBoardUrl : undefined,
          },
          { label: 'In pharmacy', value: counts?.in_pharmacy ?? 0 },
        ]}
        loading={queueLoading}
        trailing={canSellOtc ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs"
            id="nc-pharmacy-sell-otc"
            onClick={() => setOtcOpen(true)}
          >
            Sell OTC
          </Button>
        ) : undefined}
      />

      <div className="nc-pharmacy-desk">
        <PharmacyDeskLayout
          activePane={(
            <PharmacyActivePane
              mode={mode}
              data={selectData}
              hasActiveWork={hasActiveWork}
              canSkipToPayment={canSkipToPayment}
              visitBoardUrl={visitBoardUrl}
              blocked={sharedSession.blocked}
              actionError={actionError}
              submitting={submitting}
              pharmOpsEnabled={pharmOpsEnabled}
              canDispense={canDispense}
              onTakePatient={() => {
                if (selectData) void takePatient(selectData.visit.id, selectData.visit.row_version ?? 0);
              }}
              onComplete={() => void handleComplete()}
              onSkip={() => setSkipOpen(true)}
              onOpenDispense={() => void runShortcut('dispense')}
              onOpenRxEdit={() => void runShortcut('rx_edit')}
              onDispenseRx={(prescriptionId) => setDispenseRxId(prescriptionId)}
              onPrintRx={(prescriptionId) => { void handlePrintRx(prescriptionId); }}
              walkinOutcome={walkinOutcome}
              onSelectWalkinOutcome={setWalkinOutcome}
              onWalkinClose={(outcome) => { void handleWalkinClose(outcome); }}
              onOpenPharmacyService={() => { void handleOpenPharmacyService(); }}
            />
          )}
          queue={(
            <PharmacyQueue
              cards={cards}
              hasActiveWork={hasActiveWork}
              loading={queueLoading}
              error={queueError}
              onSelectVisit={(card) => void selectVisit(card.id)}
            />
          )}
        />
      </div>

      {narrowDesk && !hasActiveWork && (
        <>
          <PharmacyMobileQueueBar
            waitingCount={counts?.waiting ?? cards.length}
            hasActiveWork={hasActiveWork}
            onOpen={() => setMobileQueueOpen(true)}
          />
          <PharmacyMobileQueueSheet
            open={mobileQueueOpen}
            onClose={() => setMobileQueueOpen(false)}
            waitingCount={counts?.waiting ?? cards.length}
            cards={cards}
            hasActiveWork={hasActiveWork}
            loading={queueLoading}
            error={queueError}
            onSelectVisit={(card) => void selectVisit(card.id)}
          />
        </>
      )}

      <SkipToPaymentModal
        open={skipOpen}
        preview={selectData?.preview ?? null}
        visit={selectData?.visit ?? null}
        deskLabel="pharmacy"
        submitting={submitting}
        error={skipError}
        onClose={() => {
          setSkipOpen(false);
          setSkipError(null);
        }}
        onConfirm={(reason) => void handleSkip(reason)}
      />

      <EsignOverrideModal
        open={esignOpen}
        preview={selectData?.preview ?? null}
        visit={selectData?.visit ?? null}
        confirmLabel="Complete with override"
        reasonFieldId="nc-pharmacy-esign-reason"
        onClose={() => setEsignOpen(false)}
        onConfirm={(reason) => {
          if (esignActionRef.current === 'walkin_close' && pendingWalkinClose) {
            void handleWalkinClose(pendingWalkinClose, { esignOverrideReason: reason });
            return;
          }
          void handleComplete({ esignOverrideReason: reason });
        }}
      />

      <UndispensedRxModal
        open={undispensedOpen}
        preview={selectData?.preview ?? null}
        visit={selectData?.visit ?? null}
        undispensedCount={undispensedCount || selectData?.undispensed_rx_count || 1}
        canOverride={canUndispensedOverride}
        submitting={submitting}
        error={undispensedError}
        onClose={() => {
          setUndispensedOpen(false);
          setUndispensedError(null);
        }}
        onOpenDispense={openFirstUndispensedDispense}
        onOverrideComplete={(reason) => void handleComplete({ undispensedOverrideReason: reason })}
      />

      <ExternalRxIncompleteModal
        open={externalRxOpen}
        preview={selectData?.preview ?? null}
        visit={selectData?.visit ?? null}
        missing={externalRxMissing}
        canOverride={canExternalRxOverride}
        submitting={submitting}
        error={externalRxError}
        onClose={() => {
          setExternalRxOpen(false);
          setExternalRxError(null);
        }}
        onOpenPharmacyService={openPharmacyServiceFromModal}
        onOverrideComplete={(reason) => void handleComplete({ externalRxOverrideReason: reason })}
      />

      {otcOpen ? (
        <Suspense fallback={null}>
          <PharmOpsOtcSaleDrawer
            open
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            canDispense={canSellOtc}
            initialContext={otcInitialContext}
            onClose={() => setOtcOpen(false)}
          />
        </Suspense>
      ) : null}

      {dispenseRxId != null ? (
        <Suspense fallback={null}>
          <PharmOpsDispenseDrawer
            open
            prescriptionId={dispenseRxId}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            canDispense={canDispense}
            onClose={() => setDispenseRxId(null)}
            onDispensed={() => {
              void refreshActiveVisit();
              void fetchQueue();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
