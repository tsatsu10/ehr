/**
 * useOfflineRegistrationQueue
 *
 * Stores pending patient registrations in IndexedDB when the browser is offline
 * (or when the server returns a network-level error). Automatically retries when
 * connectivity is restored and the hook is mounted.
 *
 * Usage:
 *   const { enqueue, flush, pendingCount, isSyncing } = useOfflineRegistrationQueue(ajaxUrl, csrfToken);
 *
 *   // In a save handler:
 *   if (!navigator.onLine) {
 *     await enqueue(formData);
 *   } else {
 *     try { await saveOnline(formData); }
 *     catch (err) { await enqueue(formData); }
 *   }
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DB_NAME   = 'nc_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'registrations';

export interface QueuedRegistration {
  id?: number;
  payload: Record<string, unknown>;
  enqueuedAt: number;
  retries: number;
}

interface UseOfflineRegistrationQueueResult {
  pendingCount: number;
  isSyncing: boolean;
  enqueue: (payload: Record<string, unknown>) => Promise<void>;
  flush: () => Promise<void>;
  clearAll: () => Promise<void>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbPut(db: IDBDatabase, record: QueuedRegistration): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(record);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function dbGetAll(db: IDBDatabase): Promise<QueuedRegistration[]> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueuedRegistration[]);
    req.onerror   = () => reject(req.error);
  });
}

function dbClear(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export function useOfflineRegistrationQueue(
  ajaxUrl: string,
  csrfToken: string,
): UseOfflineRegistrationQueueResult {
  const dbRef      = useRef<IDBDatabase | null>(null);
  const syncingRef = useRef(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing,    setIsSyncing]    = useState(false);

  const refreshCount = useCallback(async () => {
    if (!dbRef.current) return;
    const all = await dbGetAll(dbRef.current);
    setPendingCount(all.length);
  }, []);

  useEffect(() => {
    let active = true;
    openDb()
      .then((db) => {
        if (!active) { db.close(); return; }
        dbRef.current = db;
        void refreshCount();
      })
      .catch((err: unknown) => {
        console.warn('[OfflineQueue] IndexedDB unavailable:', err);
      });
    return () => {
      active = false;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [refreshCount]);

  const enqueue = useCallback(async (payload: Record<string, unknown>) => {
    const db = dbRef.current;
    if (!db) return;
    await dbPut(db, { payload, enqueuedAt: Date.now(), retries: 0 });
    await refreshCount();
  }, [refreshCount]);

  const flush = useCallback(async () => {
    const db = dbRef.current;
    if (!db || syncingRef.current) return;
    const pending = await dbGetAll(db);
    if (pending.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);

    for (const record of pending) {
      try {
        const resp = await fetch(ajaxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...record.payload,
            csrf_token: csrfToken,
            action:     'registration.save',
          }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        if (record.id != null) await dbDelete(db, record.id);
      } catch {
        if (record.id != null) {
          await dbPut(db, { ...record, retries: record.retries + 1 });
        }
      }
    }

    syncingRef.current = false;
    setIsSyncing(false);
    await refreshCount();
  }, [ajaxUrl, csrfToken, refreshCount]);

  const clearAll = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    await dbClear(db);
    await refreshCount();
  }, [refreshCount]);

  /* Auto-flush when coming back online */
  useEffect(() => {
    const handler = () => { void flush(); };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [flush]);

  /* Flush on mount if online */
  useEffect(() => {
    if (navigator.onLine) void flush();
  }, [flush]);

  return { pendingCount, isSyncing, enqueue, flush, clearAll };
}
