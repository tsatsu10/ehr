import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { t } from '@core/i18n';
import type { RxHistoryPayload, RxHistoryStatusFilter } from './rxHistoryTypes';

const PAGE_SIZE = 25;

interface UseRxHistoryOptions {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  page: number;
  status: RxHistoryStatusFilter;
  search: string;
}

export function useRxHistory({ ajaxUrl, csrfToken, pid, page, status, search }: UseRxHistoryOptions) {
  const [data, setData] = useState<RxHistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await oeFetch<RxHistoryPayload>('pharmacy.rx_history', {
        ...fetchOptions,
        params: {
          pid: String(pid),
          page: String(page),
          page_size: String(PAGE_SIZE),
          status,
          search: search.trim() || undefined,
        },
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not load prescription history'));
    } finally {
      setLoading(false);
    }
  }, [fetchOptions, page, pid, search, status]);

  useEffect(() => {
    // Debounce the search box; page/status changes fire immediately.
    const timer = window.setTimeout(() => {
      void load();
    }, search === '' ? 0 : 250);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce intentionally re-runs on `load` identity change only
  }, [load]);

  return { data, loading, error, pageSize: PAGE_SIZE, reload: load };
}
