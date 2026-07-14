import { useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { DrugSearchRow } from './rxEditTypes';

interface UseRxDrugSearchOptions {
  pid: number;
  query: string;
  ajaxUrl: string;
  csrfToken: string;
  minLength?: number;
}

export function useRxDrugSearch({
  pid,
  query,
  ajaxUrl,
  csrfToken,
  minLength = 2,
}: UseRxDrugSearchOptions) {
  const [results, setResults] = useState<DrugSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setResults([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const seq = ++searchSeq.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void oeFetch<{ rows: DrugSearchRow[] }>('pharmacy.rx_search_drugs', {
        ...fetchOptions,
        params: { pid: String(pid), query: trimmed },
      })
        .then((data) => {
          if (seq !== searchSeq.current) return;
          setResults(data.rows ?? []);
        })
        .catch((err) => {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setError(err instanceof Error ? err.message : 'Medication search failed');
        })
        .finally(() => {
          if (seq === searchSeq.current) setLoading(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchOptions, minLength, pid, query]);

  return { results, loading, error };
}
