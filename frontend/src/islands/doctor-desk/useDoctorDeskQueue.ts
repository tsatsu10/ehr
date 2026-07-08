import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { DoctorConsultPayload, DoctorQueueCard, DoctorQueueData } from '@core/types';
import { useInterval } from '@core/useInterval';
import { useQueueVisibilityRefresh } from '@core/useQueueVisibilityRefresh';
import { usePageHeadingToolbar } from '@core/usePageHeadingToolbar';
import { showDeskNotice } from '@components/deskToast';
import type { ActiveMode } from './DoctorActivePane';
import {
  buildLabResultsReadyNotice,
  scanQueueCardsForLabResultsToast,
  seedResultsReadyState,
} from './labResultsToast';
import { pickDoctorReadyNotice } from './doctorReadyToast';

export interface UseDoctorDeskQueueOptions {
  ajaxUrl: string;
  csrfToken: string;
  scope: 'me' | 'all';
  facilityParams: Record<string, string | number> | undefined;
  advisoryRoutingEnabled: boolean;
  labResultsToastEnabled: boolean;
  pollMs: number;
  resetActivePane: () => void;
  clearActiveVisitId: () => void;
  setActiveVisit: Dispatch<SetStateAction<DoctorConsultPayload['visit'] | null>>;
  modeRef: MutableRefObject<ActiveMode>;
  activeVisitRef: MutableRefObject<DoctorConsultPayload['visit'] | null>;
  modalOpenRef: MutableRefObject<boolean>;
  loadActiveConsultRef: MutableRefObject<(visitId: number) => Promise<DoctorConsultPayload | null>>;
}

export function useDoctorDeskQueue({
  ajaxUrl,
  csrfToken,
  scope,
  facilityParams,
  advisoryRoutingEnabled,
  labResultsToastEnabled,
  pollMs,
  resetActivePane,
  clearActiveVisitId,
  setActiveVisit,
  modeRef,
  activeVisitRef,
  modalOpenRef,
  loadActiveConsultRef,
}: UseDoctorDeskQueueOptions) {
  const [cards, setCards] = useState<DoctorQueueCard[]>([]);
  const [counts, setCounts] = useState<DoctorQueueData['counts'] | null>(null);
  const [visitDate, setVisitDate] = useState<string | null>(null);
  const [doneToday, setDoneToday] = useState<DoctorQueueData['done_today']>([]);
  const [reopenableToday, setReopenableToday] = useState<DoctorQueueData['reopenable_today']>([]);
  const [canReopenConsult, setCanReopenConsult] = useState(false);
  const [hasActiveConsult, setHasActiveConsult] = useState(false);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [queueRefreshToken, setQueueRefreshToken] = useState(0);
  const [myUserId, setMyUserId] = useState(0);
  const [requireOverrideReason, setRequireOverrideReason] = useState(false);
  const [advisoryEnabled, setAdvisoryEnabled] = useState(advisoryRoutingEnabled);
  const [canTakeAssignedOverride, setCanTakeAssignedOverride] = useState(false);

  const queueSeq = useRef(0);
  const resultsReadyRef = useRef<Record<number, boolean>>({});
  const resultsReadyBaselinedRef = useRef(false);

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
      setMyUserId(data.my_user_id ?? 0);
      setRequireOverrideReason(!!data.require_override_reason);
      setAdvisoryEnabled(data.advisory_routing_enabled ?? advisoryRoutingEnabled);
      setCanTakeAssignedOverride(!!data.can_take_assigned_override);
      const readyNotice = pickDoctorReadyNotice(
        data.ready_notify_pending ?? [],
        !!data.doctor_ready_notify_enabled,
      );
      if (readyNotice) {
        showDeskNotice(readyNotice);
      }
      setQueueError(null);
      setLastUpdated(new Date());
      setQueueRefreshToken((prev) => prev + 1);

      const activeConsult = data.active_consult;

      if (!resultsReadyBaselinedRef.current) {
        resultsReadyRef.current = seedResultsReadyState(
          merged,
          activeConsult,
          resultsReadyRef.current,
        );
        resultsReadyBaselinedRef.current = true;
      } else {
        let toastScan = scanQueueCardsForLabResultsToast(
          merged,
          resultsReadyRef.current,
          labResultsToastEnabled,
        );
        resultsReadyRef.current = toastScan.nextState;

        if (!toastScan.notice && activeConsult) {
          const isReady = !!activeConsult.routing_chips?.results_ready;
          const activeNotice = buildLabResultsReadyNotice(
            activeConsult.id,
            activeConsult.display_name,
            activeConsult.queue_number,
            resultsReadyRef.current[activeConsult.id] ?? false,
            isReady,
            labResultsToastEnabled,
          );
          resultsReadyRef.current[activeConsult.id] = isReady;
          if (activeNotice) {
            toastScan = { ...toastScan, notice: activeNotice };
          }
        }

        if (toastScan.notice) {
          showDeskNotice(toastScan.notice);
        }
      }

      const current = activeVisitRef.current;

      if (data.active_consult && !current && modeRef.current !== 'consult' && modeRef.current !== 'loading') {
        void loadActiveConsultRef.current(data.active_consult.id);
      }

      if (current) {
        const activeId = current.id;
        const queueMatch = merged.find((c) => c.id === activeId);
        if (queueMatch?.row_version != null) {
          setActiveVisit((v) => (v ? { ...v, row_version: queueMatch.row_version } : v));
        } else if (data.active_consult?.id === activeId && data.active_consult.row_version != null) {
          setActiveVisit((v) =>
            v ? { ...v, row_version: data.active_consult!.row_version } : v,
          );
        }

        const onQueue = !!queueMatch;
        const stillMine = data.active_consult?.id === activeId;
        const consultLocallyActive = current.state === 'with_doctor';
        if (!onQueue && !stillMine && !consultLocallyActive && !modalOpenRef.current) {
          resetActivePane();
          clearActiveVisitId();
          setHasActiveConsult(!!data.has_active_consult);
        }
      }

      return { merged, data, current };
    } catch (err) {
      if (token !== queueSeq.current) return undefined;
      setQueueError(err instanceof Error ? err.message : 'Queue load failed');
      return undefined;
    } finally {
      if (token === queueSeq.current) setQueueLoading(false);
    }
  }, [ajaxUrl, csrfToken, scope, facilityParams, labResultsToastEnabled, advisoryRoutingEnabled, clearActiveVisitId, loadActiveConsultRef, modalOpenRef, modeRef, resetActivePane, setActiveVisit, activeVisitRef]);

  const fetchQueueRef = useRef(fetchQueue);
  useEffect(() => {
    fetchQueueRef.current = fetchQueue;
  }, [fetchQueue]);

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
    dateElementId: 'nc-doctor-date',
    updatedElementId: 'nc-doctor-updated',
    refreshButtonId: 'nc-doctor-refresh',
    visitDate,
    lastUpdated,
    onRefresh: fetchQueue,
  });

  return {
    cards,
    counts,
    visitDate,
    doneToday,
    reopenableToday,
    canReopenConsult,
    hasActiveConsult,
    setHasActiveConsult,
    queueLoading,
    queueError,
    lastUpdated,
    queueRefreshToken,
    myUserId,
    requireOverrideReason,
    advisoryEnabled,
    canTakeAssignedOverride,
    fetchQueue,
    fetchQueueRef,
    resultsReadyRef,
    resultsReadyBaselinedRef,
  };
}
