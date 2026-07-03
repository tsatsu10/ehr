import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { ChartSearchResponse } from './patientChartTypes';

interface UseChartInChartSearchOptions {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  enabled: boolean;
}

export function useChartInChartSearch({
  ajaxUrl,
  csrfToken,
  pid,
  enabled,
}: UseChartInChartSearchOptions) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChartSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const runSearch = useCallback(
    async (value: string) => {
      if (!enabled) {
        return;
      }

      const trimmed = value.trim();
      if (trimmed.length < 2) {
        setResults(null);
        setError(null);
        setLoading(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const data = await oeFetch<ChartSearchResponse>('patients.chart.search', {
          ajaxUrl,
          csrfToken,
          params: { pid, q: trimmed },
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        setResults(data);
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setResults(null);
        setError(err instanceof Error ? err.message : 'Search failed.');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [ajaxUrl, csrfToken, enabled, pid]
  );

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        void runSearch(value);
      }, 300);
    },
    [runSearch]
  );

  const clearSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    requestIdRef.current += 1;
    setQuery('');
    setResults(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    query,
    results,
    loading,
    error,
    handleInput,
    clearSearch,
  };
}
