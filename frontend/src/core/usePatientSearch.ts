import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from './oeFetch';
import type { PatientSearchRow } from './types';

export interface UsePatientSearchOptions {
  ajaxUrl: string;
  csrfToken: string;
  limit?: number;
  /** Auto-select first result (front desk behaviour). */
  autoSelectFirst?: boolean;
  onSelectPatient?: (pid: number) => void;
  initialQuery?: string;
}

export function usePatientSearch({
  ajaxUrl,
  csrfToken,
  limit = 8,
  autoSelectFirst = false,
  onSelectPatient,
  initialQuery = '',
}: UsePatientSearchOptions) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PatientSearchRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelectRef = useRef(onSelectPatient);

  useEffect(() => {
    onSelectRef.current = onSelectPatient;
  }, [onSelectPatient]);

  const fetchPatients = useCallback(async (q: string): Promise<PatientSearchRow[]> => {
    const data = await oeFetch<{ patients: PatientSearchRow[] }>('patients.search', {
      ajaxUrl,
      csrfToken,
      method: 'POST',
      json: { q, limit },
    });
    return data.patients ?? [];
  }, [ajaxUrl, csrfToken, limit]);

  const applySearchSuccess = useCallback((patients: PatientSearchRow[]) => {
    setResults(patients);
    setSelectedIndex(patients.length ? 0 : -1);
    if (autoSelectFirst && patients.length > 0) {
      onSelectRef.current?.(patients[0].pid);
    }
  }, [autoSelectFirst]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSelectedIndex(-1);
      setSearching(false);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const patients = await fetchPatients(q);
      applySearchSuccess(patients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setSelectedIndex(-1);
    } finally {
      setSearching(false);
    }
  }, [applySearchSuccess, fetchPatients]);

  useEffect(() => {
    const q = initialQuery.trim();
    if (q.length < 2) return undefined;

    let cancelled = false;

    const loadInitial = async () => {
      setSearching(true);
      setError(null);
      try {
        const patients = await fetchPatients(q);
        if (cancelled) return;
        applySearchSuccess(patients);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
        setSelectedIndex(-1);
      } finally {
        if (!cancelled) setSearching(false);
      }
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [initialQuery, fetchPatients, applySearchSuccess]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(value.trim()), 250);
  }, [runSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    setError(null);
  }, []);

  const findPatient = useCallback(
    (pid: number) => results.find((row) => row.pid === pid) ?? null,
    [results],
  );

  return {
    query,
    setQuery,
    results,
    selectedIndex,
    setSelectedIndex,
    searching,
    error,
    runSearch,
    handleInput,
    clearSearch,
    findPatient,
  };
}
