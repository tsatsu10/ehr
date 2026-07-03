import { useCallback, useEffect, useState } from 'react';

export function useVisitBoardKiosk(enabled: boolean) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const requestWakeLock = useCallback(async () => {
    if (!enabled || !('wakeLock' in navigator)) {
      return;
    }
    try {
      const lock = await navigator.wakeLock.request('screen');
      return lock;
    } catch {
      return null;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      const next = await requestWakeLock();
      if (!cancelled && next) {
        lock = next;
      }
    };

    void acquire();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void acquire();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release();
      lock = null;
    };
  }, [enabled, requestWakeLock]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [enabled]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      return;
    }
    await document.exitFullscreen?.();
  }, []);

  return { isFullscreen, toggleFullscreen };
}
