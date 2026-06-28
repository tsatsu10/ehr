/**
 * LabDesk — Phase 5A React island replacing jQuery NewClinicLab.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { oeFetch } from '@core/oeFetch';
import { resolveActionConflict, applyPostDeskConflict, type DeskInterrupt } from '@core/deskConflict';
import { useInterval } from '@core/useInterval';
import { usePageHeadingToolbar } from '@core/usePageHeadingToolbar';
import { setDeskActiveVisitId, clearDeskActiveVisitId } from '@core/deskSessionStorage';
import { useSharedDeviceSession } from '@core/useSharedDeviceSession';
import { DeskInterruptBanner } from '@components/DeskInterruptBanner';
import { DeskSharedDeviceBanner } from '@components/DeskSharedDeviceBanner';
import { EsignOverrideModal } from '@components/EsignOverrideModal';
import { SkipToPaymentModal } from '@components/SkipToPaymentModal';
import { handleDeskCompleteResult } from '@core/deskCompleteAction';
import { postDeskAction } from '@core/postDeskAction';
import type {
  LabDeskProps,
  LabQueueCard,
  LabQueueData,
  LabSelectData,
} from '@core/types';
import { LabQueue } from './LabQueue';
import { LabActivePane, type LabActiveMode } from './LabActivePane';
import { LabOpsResultDrawer } from '@islands/lab-ops/LabOpsResultDrawer';

const STORAGE_KEY = 'lab_desk_active_visit_id';

export function LabDesk({
  ajaxUrl,
  csrfToken,
  facilityId,
  pollMs = 30_000,
  visitBoardUrl,
  labOpsUrl,
  labOpsEnabled = false,
  canEnterResults = false,
  canReleaseResults = false,
  canSkipToPayment = false,
  sharedDeviceWarning = false,
  canEsignOverride = false,
}: LabDeskProps) {
  const [cards, setCards] = useState<LabQueueCard[]>([]);
  const [counts, setCounts] = useState<LabQueueData['counts'] | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [hasActiveWork, setHasActiveWork] = useState(false);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [mode, setMode] = useState<LabActiveMode>('idle');
  const [selectData, setSelectData] = useState<LabSelectData | null>(null);
  const [interrupt, setInterrupt] = useState<DeskInterrupt | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [skipOpen, setSkipOpen] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [esignOpen, setEsignOpen] = useState(false);
  const [labOpsDrawerOpen, setLabOpsDrawerOpen] = useState(false);
  const [labOpsOrderId, setLabOpsOrderId] = useState<number | null>(null);

  const queueSeq = useRef(0);
  const activeVisitIdRef = useRef<number | null>(null);
  const hasActiveWorkRef = useRef(false);

  const facilityParams = useMemo(
    () => (facilityId > 0 ? { facility_id: facilityId } : undefined),
    [facilityId],
  );

  const resetActivePane = useCallback(() => {
    setMode('idle');
    setSelectData(null);
    setActionError(null);
    activeVisitIdRef.current = null;
    clearDeskActiveVisitId(STORAGE_KEY);
  }, []);

  const sharedSession = useSharedDeviceSession({
    enabled: sharedDeviceWarning,
    ajaxUrl,
    csrfToken,
    facilityId,
    storageKey: STORAGE_KEY,
    compareMode: 'clinical',
    restoreAction: 'lab.restore_session',
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

  const applySelectData = useCallback((data: LabSelectData) => {
    setSelectData(data);
    setMode('active');
    setInterrupt(null);
    sharedSession.setActiveVisitId(data.visit.id);
    activeVisitIdRef.current = data.visit.id;
  }, [sharedSession]);

  const fetchQueue = useCallback(async () => {
    queueSeq.current += 1;
    const token = queueSeq.current;

    try {
      const data = await oeFetch<LabQueueData>('lab.queue', {
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
      setHasActiveWork(!!data.has_active_work);
      hasActiveWorkRef.current = !!data.has_active_work;
      setQueueError(null);
      setLastUpdated(new Date());

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
        if (!match && !stillMine) {
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
      const data = await oeFetch<LabSelectData>('lab.take', {
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
      const data = await oeFetch<LabSelectData>('lab.select', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId },
      });

      if (data.visit.state === 'ready_for_lab' && !activeWork) {
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

  useInterval(() => {
    if (!document.hidden) void fetchQueue();
  }, pollMs);

  usePageHeadingToolbar({
    dateElementId: 'nc-lab-date',
    updatedElementId: 'nc-lab-updated',
    refreshButtonId: 'nc-lab-refresh',
    visitDate,
    lastUpdated,
    onRefresh: fetchQueue,
  });

  const handleComplete = useCallback(async (esignOverrideReason?: string) => {
    if (!selectData || sharedSession.blocked || submitting) return;

    setSubmitting(true);
    setActionError(null);

    const result = await postDeskAction({
      ajaxUrl,
      csrfToken,
      facilityId,
      action: 'lab.complete',
      body: {
        visit_id: selectData.visit.id,
        row_version: selectData.visit.row_version ?? 0,
        ...(esignOverrideReason ? { esign_override_reason: esignOverrideReason } : {}),
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
    }

    handleDeskCompleteResult(result, {
      canEsignOverride,
      onSuccess: () => {
        resetActivePane();
        setHasActiveWork(false);
        hasActiveWorkRef.current = false;
        void fetchQueueRef.current();
      },
      onEsignRequired: () => setEsignOpen(true),
      onError: (message) => {
        if (esignOverrideReason) {
          setEsignOpen(true);
        }
        setActionError(message);
      },
    });
  }, [ajaxUrl, canEsignOverride, csrfToken, facilityId, resetActivePane, selectData, sharedSession, submitting]);

  const handleSkip = useCallback(async (reason: string) => {
    if (!selectData || submitting) return;

    setSubmitting(true);
    setSkipError(null);

    try {
      await oeFetch('lab.skip_to_payment', {
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
      if (msg.toLowerCase().includes('not on the lab queue')) {
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

  const runShortcut = useCallback(async (shortcut: string) => {
    if (!selectData || sharedSession.blocked) return;

    setDeskActiveVisitId(STORAGE_KEY, selectData.visit.id);

    try {
      const data = await oeFetch<{ redirect_url: string }>('lab.shortcut_preflight', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: selectData.visit.id, shortcut },
      });
      window.location.assign(data.redirect_url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Shortcut failed');
    }
  }, [ajaxUrl, csrfToken, selectData, sharedSession.blocked]);

  const handleOpenResults = useCallback((orderId?: number) => {
    if (labOpsEnabled && orderId) {
      setLabOpsOrderId(orderId);
      setLabOpsDrawerOpen(true);
      return;
    }
    void runShortcut('results');
  }, [labOpsEnabled, runShortcut]);

  return (
    <div id="nc-lab-desk" className="oe-nc-lab-react-active">
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
          prefix="nc-lab"
          probeData={sharedSession.probeData}
          compareMode="clinical"
          restoring={sharedSession.restoring}
          hint="Restore encounter session or return to the queue before saving."
          onRestore={() => void sharedSession.restoreSession()}
          onReturnToQueue={sharedSession.returnToQueue}
        />
      )}

      <div className="row">
        <div className="col-lg-4 mb-3">
          <LabQueue
            cards={cards}
            counts={counts}
            hasActiveWork={hasActiveWork}
            loading={queueLoading}
            error={queueError}
            labOpsUrl={labOpsUrl}
            onSelectVisit={(card) => void selectVisit(card.id)}
          />
        </div>

        <div className="col-lg-8 mb-3">
          <LabActivePane
            mode={mode}
            data={selectData}
            hasActiveWork={hasActiveWork}
            labOpsEnabled={labOpsEnabled}
            canSkipToPayment={canSkipToPayment}
            visitBoardUrl={visitBoardUrl}
            blocked={sharedSession.blocked}
            actionError={actionError}
            submitting={submitting}
            onTakePatient={() => {
              if (selectData) void takePatient(selectData.visit.id, selectData.visit.row_version ?? 0);
            }}
            onComplete={() => void handleComplete()}
            onSkip={() => setSkipOpen(true)}
            onOpenOrders={() => void runShortcut('orders')}
            onOpenResults={handleOpenResults}
          />
        </div>
      </div>

      <SkipToPaymentModal
        open={skipOpen}
        preview={selectData?.preview ?? null}
        visit={selectData?.visit ?? null}
        deskLabel="lab"
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
        reasonFieldId="nc-lab-esign-reason"
        onClose={() => setEsignOpen(false)}
        onConfirm={(reason) => void handleComplete(reason)}
      />

      {labOpsEnabled && (
        <LabOpsResultDrawer
          open={labOpsDrawerOpen}
          orderId={labOpsOrderId}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          canEnter={canEnterResults}
          canRelease={canReleaseResults}
          onClose={() => {
            setLabOpsDrawerOpen(false);
            setLabOpsOrderId(null);
          }}
          onSaved={() => {
            if (activeVisitIdRef.current) {
              void selectVisitRef.current(activeVisitIdRef.current, true);
            }
            void fetchQueueRef.current();
          }}
        />
      )}
    </div>
  );
}
