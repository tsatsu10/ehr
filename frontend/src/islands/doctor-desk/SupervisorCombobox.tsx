/**
 * SupervisorCombobox — search and set supervising provider for the encounter.
 *
 * Mirrors renderSupervisorCombobox() + wireSupervisorCombobox() from doctor.js.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { X } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import { t } from '@core/i18n';
import type { DoctorProviderSearchResult, DoctorSupervisorMeta, DoctorVisit } from '@core/types';

interface SupervisorComboboxProps {
  visit: DoctorVisit;
  supervisor: DoctorSupervisorMeta;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  blocked: boolean;
  onUpdated: (meta: DoctorSupervisorMeta) => void;
  onNotice: (message: string, variant: 'success' | 'danger') => void;
}

export function SupervisorCombobox({
  visit,
  supervisor,
  ajaxUrl,
  csrfToken,
  facilityId,
  blocked,
  onUpdated,
  onNotice,
}: SupervisorComboboxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DoctorProviderSearchResult[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const facilityParams: Record<string, string | number> | undefined =
    facilityId > 0 ? { facility_id: facilityId } : undefined;

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const setSupervisor = useCallback(async (supervisorId: number | null) => {
    if (blocked || submitting) return;

    setSubmitting(true);
    try {
      const meta = await oeFetch<DoctorSupervisorMeta>('doctor.set_supervisor', {
        ajaxUrl,
        csrfToken,
        method: 'POST',
        json: {
          encounter_id: visit.encounter,
          supervisor_id: supervisorId,
        },
      });
      setQuery('');
      setResults([]);
      setResultsOpen(false);
      onUpdated(meta);
      if (meta.supervisor_id && meta.supervisor_display_name) {
        onNotice(t('Supervising provider updated: {name}', { name: meta.supervisor_display_name }), 'success');
      } else {
        onNotice(t('Supervising provider cleared'), 'success');
      }
    } catch (err) {
      onNotice(
        t('Failed to update supervisor: {reason}', {
          reason: err instanceof Error ? err.message : t('Unknown error'),
        }),
        'danger',
      );
    } finally {
      setSubmitting(false);
    }
  }, [ajaxUrl, blocked, csrfToken, onNotice, onUpdated, submitting, visit.encounter]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (value.trim().length < 2) {
      setResults([]);
      setResultsOpen(false);
      setSearchError(null);
      return;
    }

    searchTimer.current = setTimeout(() => {
      void (async () => {
        searchSeq.current += 1;
        const token = searchSeq.current;

        try {
          const data = await oeFetch<{ providers: DoctorProviderSearchResult[] }>(
            'doctor.search_providers',
            {
              ajaxUrl,
              csrfToken,
              params: { q: value.trim(), ...(facilityParams ?? {}) },
            },
          );
          if (token !== searchSeq.current) return;
          setResults(data.providers ?? []);
          setResultsOpen(true);
          setSearchError(null);
        } catch {
          if (token !== searchSeq.current) return;
          setResults([]);
          setResultsOpen(true);
          setSearchError('Search failed');
        }
      })();
    }, 300);
  };

  const handleBlur = () => {
    window.setTimeout(() => setResultsOpen(false), 200);
  };

  return (
    <div className="nc-supervisor-combobox mb-3">
      <Label htmlFor="nc-supervisor-search" className="mb-1.5 block">
        <strong>{t('Supervising provider')}</strong>
      </Label>
      <div className="flex">
        <Input
          type="text"
          className="rounded-r-none"
          id="nc-supervisor-search"
          placeholder={t('Search providers...')}
          autoComplete="off"
          value={query}
          disabled={blocked || submitting}
          onChange={(e) => handleQueryChange(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => results.length > 0 && setResultsOpen(true)}
        />
        {supervisor.supervisor_id ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-l-none border-l-0 px-3"
            id="nc-supervisor-clear"
            title={t('Clear')}
            disabled={blocked || submitting}
            onClick={() => void setSupervisor(null)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {resultsOpen && (
        <div
          id="nc-supervisor-results"
          className="nc-list-group mt-1"
          style={{ maxHeight: 200, overflowY: 'auto' }}
        >
          {searchError ? (
            <div className="nc-list-group-item text-[var(--oe-nc-danger,#dc2626)] text-sm">{searchError}</div>
          ) : results.length === 0 ? (
            <div className="nc-list-group-item text-[var(--oe-nc-text-muted)] text-sm">{t('No providers found')}</div>
          ) : (
            results.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="nc-list-group-item nc-list-group-item-action"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void setSupervisor(provider.id)}
              >
                {provider.display_name}
                {' '}
                <span className="text-[var(--oe-nc-text-muted)] text-sm">({provider.username})</span>
              </button>
            ))
          )}
        </div>
      )}

      {supervisor.supervisor_display_name && (
        <div className="mt-2">
          <Badge variant="info">
            {supervisor.supervisor_display_name}
          </Badge>
          {supervisor.supervisor_from_profile && (
            <span className="text-sm text-[var(--oe-nc-text-muted)] ml-2">{t('(Default from your profile)')}</span>
          )}
        </div>
      )}
    </div>
  );
}
