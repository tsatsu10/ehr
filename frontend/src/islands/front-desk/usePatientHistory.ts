/**
 * usePatientHistory — manages navigation history for undo/redo patient switches
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PatientHistoryEntry {
  pid: number;
  displayName: string;
  pubpid: string;
  timestamp: number;
}

export interface UsePatientHistoryReturn {
  /** Current history stack */
  history: PatientHistoryEntry[];
  /** Current position in history */
  currentIndex: number;
  /** Can undo to previous patient */
  canUndo: boolean;
  /** Can redo to next patient */
  canRedo: boolean;
  /** Add a new patient to history */
  push: (entry: Omit<PatientHistoryEntry, 'timestamp'>) => void;
  /** Undo to previous patient */
  undo: () => PatientHistoryEntry | null;
  /** Redo to next patient */
  redo: () => PatientHistoryEntry | null;
  /** Clear all history */
  clear: () => void;
  /** Get the previous patient entry */
  getPrevious: () => PatientHistoryEntry | null;
  /** Get the next patient entry */
  getNext: () => PatientHistoryEntry | null;
}

const MAX_HISTORY_SIZE = 20;

/**
 * Hook for managing patient navigation history with undo/redo support
 * 
 * @example
 * const history = usePatientHistory();
 * 
 * // Add patient to history when selecting
 * history.push({ pid: 123, displayName: "John Doe", pubpid: "PT-001" });
 * 
 * // Undo to previous patient
 * const previous = history.undo();
 * if (previous) loadPreview(previous.pid);
 * 
 * // Listen to keyboard shortcuts
 * useEffect(() => {
 *   const handler = (e: KeyboardEvent) => {
 *     if (e.ctrlKey && e.key === 'z' && history.canUndo) {
 *       e.preventDefault();
 *       const prev = history.undo();
 *       if (prev) loadPreview(prev.pid);
 *     }
 *   };
 *   window.addEventListener('keydown', handler);
 *   return () => window.removeEventListener('keydown', handler);
 * }, [history]);
 */
export function usePatientHistory(): UsePatientHistoryReturn {
  const [history, setHistory] = useState<PatientHistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const isNavigatingRef = useRef(false);

  const push = useCallback((entry: Omit<PatientHistoryEntry, 'timestamp'>) => {
    // Don't add to history if we're currently navigating (undo/redo)
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    setHistory((prev) => {
      // Remove any forward history when pushing new entry
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Don't add duplicate consecutive entries
      const lastEntry = newHistory[newHistory.length - 1];
      if (lastEntry && lastEntry.pid === entry.pid) {
        return prev;
      }

      const newEntry: PatientHistoryEntry = {
        ...entry,
        timestamp: Date.now(),
      };

      // Add new entry and trim if exceeds max size
      const updatedHistory = [...newHistory, newEntry];
      if (updatedHistory.length > MAX_HISTORY_SIZE) {
        return updatedHistory.slice(-MAX_HISTORY_SIZE);
      }

      return updatedHistory;
    });

    // Update index to point to the new entry
    setCurrentIndex((prev) => {
      const newHistory = history.slice(0, prev + 1);
      const nextIndex = newHistory.length;
      return Math.min(nextIndex, MAX_HISTORY_SIZE - 1);
    });
  }, [currentIndex, history]);

  const undo = useCallback((): PatientHistoryEntry | null => {
    if (currentIndex <= 0) return null;

    isNavigatingRef.current = true;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [currentIndex, history]);

  const redo = useCallback((): PatientHistoryEntry | null => {
    if (currentIndex >= history.length - 1) return null;

    isNavigatingRef.current = true;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [currentIndex, history]);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    isNavigatingRef.current = false;
  }, []);

  const getPrevious = useCallback((): PatientHistoryEntry | null => {
    if (currentIndex <= 0) return null;
    return history[currentIndex - 1];
  }, [currentIndex, history]);

  const getNext = useCallback((): PatientHistoryEntry | null => {
    if (currentIndex >= history.length - 1) return null;
    return history[currentIndex + 1];
  }, [currentIndex, history]);

  // Update currentIndex when history changes (via push)
  useEffect(() => {
    if (!isNavigatingRef.current && history.length > 0) {
      setCurrentIndex(history.length - 1);
    }
  }, [history.length]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    history,
    currentIndex,
    canUndo,
    canRedo,
    push,
    undo,
    redo,
    clear,
    getPrevious,
    getNext,
  };
}
