import { useEffect, useMemo, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { OtcDrugSearchData, OtcDrugSearchRow } from './pharmOpsTypes';

interface UsePharmDrugSearchOptions {
  open: boolean;
  query: string;
  ajaxUrl: string;
  csrfToken: string;
  minLength?: number;
  limit?: number;
}

export function usePharmDrugSearch({
  open,
  query,
  ajaxUrl,
  csrfToken,
  minLength = 2,
  limit = 20,
}: UsePharmDrugSearchOptions) {
  const [results, setResults] = useState<OtcDrugSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  useEffect(() => {
    if (!open) {
      setResults([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

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
      void oeFetch<OtcDrugSearchData>('pharm_ops.otc_drugs_search', {
        ...fetchOptions,
        json: { q: trimmed, limit },
      })
        .then((data) => {
          if (seq !== searchSeq.current) return;
          setResults(data.rows ?? []);
        })
        .catch((err) => {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setError(err instanceof Error ? err.message : 'Product search failed');
        })
        .finally(() => {
          if (seq === searchSeq.current) setLoading(false);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchOptions, limit, minLength, open, query]);

  return { results, loading, error };
}
