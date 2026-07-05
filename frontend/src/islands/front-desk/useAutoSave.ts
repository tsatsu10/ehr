/**
 * Auto-save hook for registration form
 * Periodically saves form state to localStorage to prevent data loss
 */
import { useEffect, useRef, useCallback } from 'react';

export interface AutoSaveOptions {
    /** Unique key for localStorage */
    storageKey: string;
    /** Auto-save interval in milliseconds (default: 30000 = 30 seconds) */
    saveIntervalMs?: number;
    /** Debounce delay after user stops typing (default: 2000 = 2 seconds) */
    debounceMs?: number;
    /** Whether auto-save is enabled */
    enabled?: boolean;
}

export interface AutoSaveState {
    /** Timestamp of last auto-save */
    lastSaved: number | null;
    /** Whether auto-save is currently active */
    isAutoSaving: boolean;
    /** Whether there is a draft available to restore */
    hasDraft: boolean;
}

/**
 * Auto-save form data to localStorage with debouncing and periodic saves
 */
export function useAutoSave<T extends Record<string, unknown>>(
    data: T,
    isDirty: boolean,
    options: AutoSaveOptions,
    onAutoSave?: (timestamp: number) => void
): {
    autoSaveState: AutoSaveState;
    getDraft: () => T | null;
    clearDraft: () => void;
    forceSave: () => void;
} {
    const {
        storageKey,
        saveIntervalMs = 30000,
        debounceMs = 2000,
        enabled = true,
    } = options;

    const lastSavedRef = useRef<number | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const periodicTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isAutoSavingRef = useRef(false);

    // Check if draft exists in localStorage
    const hasDraft = useCallback((): boolean => {
        try {
            const stored = localStorage.getItem(storageKey);
            return stored !== null;
        } catch {
            return false;
        }
    }, [storageKey]);

    // Get draft from localStorage
    const getDraft = useCallback((): T | null => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (!stored) return null;
            const parsed = JSON.parse(stored);
            return parsed.data as T;
        } catch {
            return null;
        }
    }, [storageKey]);

    // Clear draft from localStorage
    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
            lastSavedRef.current = null;
        } catch {
            // Ignore localStorage errors
        }
    }, [storageKey]);

    // Save data to localStorage
    const saveDraft = useCallback(() => {
        if (!enabled || !isDirty) return;

        try {
            isAutoSavingRef.current = true;
            const timestamp = Date.now();
            const draft = {
                data,
                timestamp,
                version: 1,
            };
            localStorage.setItem(storageKey, JSON.stringify(draft));
            lastSavedRef.current = timestamp;
            onAutoSave?.(timestamp);
        } catch (error) {
            console.warn('Auto-save failed:', error);
        } finally {
            isAutoSavingRef.current = false;
        }
    }, [enabled, isDirty, data, storageKey, onAutoSave]);

    // Force immediate save (used on blur or before navigation)
    const forceSave = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        saveDraft();
    }, [saveDraft]);

    // Debounced auto-save (triggered on data change)
    useEffect(() => {
        if (!enabled || !isDirty) return;

        // Clear existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Set new debounce timer
        debounceTimerRef.current = setTimeout(() => {
            saveDraft();
        }, debounceMs);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [data, isDirty, enabled, debounceMs, saveDraft]);

    // Periodic auto-save (runs every saveIntervalMs)
    useEffect(() => {
        if (!enabled || !isDirty) return;

        periodicTimerRef.current = setInterval(() => {
            saveDraft();
        }, saveIntervalMs);

        return () => {
            if (periodicTimerRef.current) {
                clearInterval(periodicTimerRef.current);
            }
        };
    }, [enabled, isDirty, saveIntervalMs, saveDraft]);

    // Save before page unload
    useEffect(() => {
        if (!enabled) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                forceSave();
                // Show browser warning
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [enabled, isDirty, forceSave]);

    return {
        autoSaveState: {
            lastSaved: lastSavedRef.current,
            isAutoSaving: isAutoSavingRef.current,
            hasDraft: hasDraft(),
        },
        getDraft,
        clearDraft,
        forceSave,
    };
}
