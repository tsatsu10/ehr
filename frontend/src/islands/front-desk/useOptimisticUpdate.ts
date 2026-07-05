/**
 * useOptimisticUpdate — generic hook for managing optimistic UI updates
 * with automatic rollback on failure
 */

import { useCallback, useRef, useState } from 'react';

export type OptimisticState = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface OptimisticUpdate<T> {
  data: T | null;
  state: OptimisticState;
  error: string | null;
}

export interface UseOptimisticUpdateReturn<T> {
  /** Current optimistic data */
  data: T | null;
  /** Current state: idle, pending (optimistic), confirmed, or failed */
  state: OptimisticState;
  /** Error message if the operation failed */
  error: string | null;
  /** Whether the operation is pending confirmation */
  isPending: boolean;
  /** Whether the operation confirmed successfully */
  isConfirmed: boolean;
  /** Whether the operation failed */
  isFailed: boolean;
  /** Execute an optimistic update */
  execute: (optimisticData: T, operation: () => Promise<T>) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
  /** Manually set confirmed data (for external updates) */
  setConfirmed: (data: T) => void;
}

/**
 * Hook for managing optimistic updates with automatic rollback
 * 
 * @example
 * const preview = useOptimisticUpdate<PatientPreview>();
 * 
 * // Optimistically show patient data, then confirm/rollback
 * await preview.execute(
 *   cachedData,  // Show this immediately
 *   () => fetchPatientPreview(pid)  // Then fetch real data
 * );
 */
export function useOptimisticUpdate<T>(): UseOptimisticUpdateReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<OptimisticState>('idle');
  const [error, setError] = useState<string | null>(null);
  const previousDataRef = useRef<T | null>(null);

  const execute = useCallback(async (optimisticData: T, operation: () => Promise<T>) => {
    // Save current data for potential rollback
    previousDataRef.current = data;
    
    // Apply optimistic update immediately
    setData(optimisticData);
    setState('pending');
    setError(null);

    try {
      // Execute the actual operation
      const confirmedData = await operation();
      
      // Confirm with real data
      setData(confirmedData);
      setState('confirmed');
    } catch (err) {
      // Rollback to previous data on failure
      setData(previousDataRef.current);
      setState('failed');
      setError(err instanceof Error ? err.message : 'Operation failed');
      
      // Reset to idle after a delay to allow error display
      setTimeout(() => {
        if (previousDataRef.current !== null) {
          setState('idle');
        }
      }, 3000);
    }
  }, [data]);

  const reset = useCallback(() => {
    setData(null);
    setState('idle');
    setError(null);
    previousDataRef.current = null;
  }, []);

  const setConfirmed = useCallback((confirmedData: T) => {
    setData(confirmedData);
    setState('confirmed');
    setError(null);
  }, []);

  return {
    data,
    state,
    error,
    isPending: state === 'pending',
    isConfirmed: state === 'confirmed',
    isFailed: state === 'failed',
    execute,
    reset,
    setConfirmed,
  };
}
