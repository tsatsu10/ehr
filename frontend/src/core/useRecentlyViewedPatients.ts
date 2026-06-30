import { useCallback, useEffect, useState } from 'react';
import { oeFetch } from './oeFetch';

const STORAGE_KEY = 'oe-nc:recent-patients';
const MAX_ENTRIES = 5;

export interface RecentPatient {
  pid: number;
  display_name: string;
  pubpid: string;
}

interface UseRecentlyViewedPatientsOptions {
  ajaxUrl?: string;
  csrfToken?: string;
}

function readStorage(): RecentPatient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is RecentPatient =>
        !!row && typeof row === 'object'
        && typeof (row as RecentPatient).pid === 'number'
        && typeof (row as RecentPatient).display_name === 'string'
        && typeof (row as RecentPatient).pubpid === 'string'
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeStorage(entries: RecentPatient[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Silent — quota exceeded / private mode etc.
  }
}

function normalizeRecent(rows: unknown): RecentPatient[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is RecentPatient =>
      !!row && typeof row === 'object'
      && typeof (row as RecentPatient).pid === 'number'
      && typeof (row as RecentPatient).display_name === 'string'
      && typeof (row as RecentPatient).pubpid === 'string'
    )
    .slice(0, MAX_ENTRIES);
}

/**
 * Recently viewed patients — synced per user when ajaxUrl/csrfToken are provided,
 * with localStorage as offline fallback.
 */
export function useRecentlyViewedPatients(options: UseRecentlyViewedPatientsOptions = {}) {
  const { ajaxUrl, csrfToken } = options;
  const [recent, setRecent] = useState<RecentPatient[]>(() => readStorage());

  useEffect(() => {
    if (!ajaxUrl || !csrfToken) return;

    let cancelled = false;
    void (async () => {
      try {
        const data = await oeFetch<{ recent: RecentPatient[] }>('front_desk.recently_viewed', {
          ajaxUrl,
          csrfToken,
        });
        if (cancelled) return;
        const serverRecent = normalizeRecent(data.recent);
        if (serverRecent.length > 0) {
          writeStorage(serverRecent);
          setRecent(serverRecent);
        }
      } catch {
        // Keep localStorage fallback when server unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ajaxUrl, csrfToken]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setRecent(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const remember = useCallback((patient: RecentPatient) => {
    if (!patient.pid) return;
    setRecent((current) => {
      const next = [patient, ...current.filter((row) => row.pid !== patient.pid)].slice(0, MAX_ENTRIES);
      writeStorage(next);
      return next;
    });

    if (ajaxUrl && csrfToken) {
      void oeFetch<{ recent: RecentPatient[] }>('front_desk.recently_viewed.remember', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: patient,
      }).then((data) => {
        const serverRecent = normalizeRecent(data.recent);
        if (serverRecent.length > 0) {
          writeStorage(serverRecent);
          setRecent(serverRecent);
        }
      }).catch(() => {
        // Local optimistic update already applied.
      });
    }
  }, [ajaxUrl, csrfToken]);

  const clear = useCallback(() => {
    writeStorage([]);
    setRecent([]);
    if (ajaxUrl && csrfToken) {
      void oeFetch('front_desk.recently_viewed.clear', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {},
      }).catch(() => {
        // Local clear already applied.
      });
    }
  }, [ajaxUrl, csrfToken]);

  return { recent, remember, clear };
}
