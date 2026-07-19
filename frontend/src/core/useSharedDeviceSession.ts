/**
 * useSharedDeviceSession — React port of NewClinicUI.wireSharedDeviceSessionWarning().
 *
 * Probes desk.shared_session_probe when a visit is stored in sessionStorage,
 * surfaces a mismatch banner, and supports restore via desk-specific action.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { oeFetch, OeFetchError } from './oeFetch';
import {
  clearDeskActiveVisitId,
  getDeskActiveVisitId,
  setDeskActiveVisitId,
} from './deskSessionStorage';

export interface SharedDevicePatient {
  pid: number;
  encounter?: number;
  display_name: string;
  pubpid: string;
}

export interface SharedDeviceVisit {
  visit_id: number;
  pid: number;
  encounter?: number;
  queue_number: number | string;
  display_name: string;
  pubpid: string;
}

export interface SharedDeviceProbeData {
  enabled: boolean;
  mismatch: boolean;
  compare_mode?: string;
  can_restore?: boolean;
  session?: SharedDevicePatient;
  visit?: SharedDeviceVisit;
}

export interface UseSharedDeviceSessionOptions {
  enabled: boolean;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  storageKey: string;
  compareMode?: 'clinical' | 'pid_only';
  restoreAction?: string;
  onReturnToQueue?: () => void;
  onSessionRestored?: () => void;
}

export interface UseSharedDeviceSessionResult {
  blocked: boolean;
  probeData: SharedDeviceProbeData | null;
  restoring: boolean;
  setActiveVisitId: (visitId: number) => void;
  clearActiveVisitId: () => void;
  restoreSession: () => Promise<void>;
  returnToQueue: () => void;
  probe: () => Promise<void>;
}

export function useSharedDeviceSession({
  enabled,
  ajaxUrl,
  csrfToken,
  facilityId,
  storageKey,
  compareMode = 'clinical',
  restoreAction,
  onReturnToQueue,
  onSessionRestored,
}: UseSharedDeviceSessionOptions): UseSharedDeviceSessionResult {
  const [probeData, setProbeData] = useState<SharedDeviceProbeData | null>(null);
  const [restoring, setRestoring] = useState(false);

  const blocked = !!(probeData?.enabled && probeData.mismatch);

  const facilityParams: Record<string, string | number> | undefined =
    facilityId > 0 ? { facility_id: facilityId } : undefined;

  const probe = useCallback(async () => {
    if (!enabled) {
      setProbeData(null);
      return;
    }

    const visitId = getDeskActiveVisitId(storageKey);
    if (visitId <= 0) {
      setProbeData(null);
      return;
    }

    try {
      const data = await oeFetch<SharedDeviceProbeData>('desk.shared_session_probe', {
        ajaxUrl,
        csrfToken,
        params: {
          visit_id: visitId,
          compare_mode: compareMode,
          ...(facilityParams ?? {}),
        },
      });

      if (!data.enabled || !data.mismatch) {
        setProbeData(null);
      } else {
        setProbeData(data);
      }
    } catch {
      setProbeData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ajaxUrl, csrfToken, storageKey, compareMode, facilityId]);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void probe();
    };
    const onPageShow = () => void probe();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [probe]);

  const setActiveVisitId = useCallback((visitId: number) => {
    setDeskActiveVisitId(storageKey, visitId);
    void probe();
  }, [storageKey, probe]);

  const clearActiveVisitId = useCallback(() => {
    clearDeskActiveVisitId(storageKey);
    setProbeData(null);
  }, [storageKey]);

  const restoreSession = useCallback(async () => {
    if (!restoreAction || restoring) return;

    const visitId = getDeskActiveVisitId(storageKey);
    if (visitId <= 0) return;

    setRestoring(true);
    try {
      await oeFetch(restoreAction, {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: { visit_id: visitId },
      });
      setProbeData(null);
      onSessionRestored?.();
      void probe();
    } catch (err) {
      // Stored visit no longer restorable (cancelled/completed elsewhere) —
      // drop the stale reference so the banner and desk return to the queue.
      if (err instanceof OeFetchError && err.status === 400) {
        clearDeskActiveVisitId(storageKey);
        setProbeData(null);
        onReturnToQueue?.();
      }
    } finally {
      setRestoring(false);
    }
  }, [restoreAction, restoring, storageKey, ajaxUrl, csrfToken, onSessionRestored, onReturnToQueue, probe]);

  const returnToQueue = useCallback(() => {
    clearActiveVisitId();
    onReturnToQueue?.();
  }, [clearActiveVisitId, onReturnToQueue]);

  return useMemo(
    () => ({
      blocked,
      probeData,
      restoring,
      setActiveVisitId,
      clearActiveVisitId,
      restoreSession,
      returnToQueue,
      probe,
    }),
    [
      blocked,
      probeData,
      restoring,
      setActiveVisitId,
      clearActiveVisitId,
      restoreSession,
      returnToQueue,
      probe,
    ],
  );
}
