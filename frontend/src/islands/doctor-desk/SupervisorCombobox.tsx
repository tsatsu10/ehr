/**
 * SupervisorCombobox — search and set supervising provider for the encounter.
 *
 * Mirrors renderSupervisorCombobox() + wireSupervisorCombobox() from doctor.js.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
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
        onNotice(`Supervising provider updated: ${meta.supervisor_display_name}`, 'success');
      } else {
        onNotice('Supervising provider cleared', 'success');
      }
    } catch (err) {
      onNotice(
        `Failed to update supervisor: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
      <label className="form-label" htmlFor="nc-supervisor-search">
        <strong>Supervising provider</strong>
      </label>
      <div className="input-group">
        <input
          type="text"
          className="form-control"
          id="nc-supervisor-search"
          placeholder="Search providers..."
          autoComplete="off"
          value={query}
          disabled={blocked || submitting}
          onChange={(e) => handleQueryChange(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => results.length > 0 && setResultsOpen(true)}
        />
        {supervisor.supervisor_id ? (
          <button
            type="button"
            className="btn btn-outline-secondary"
            id="nc-supervisor-clear"
            title="Clear"
            disabled={blocked || submitting}
            onClick={() => void setSupervisor(null)}
          >
            <i className="fa fa-times" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {resultsOpen && (
        <div
          id="nc-supervisor-results"
          className="list-group mt-1"
          style={{ maxHeight: 200, overflowY: 'auto' }}
        >
          {searchError ? (
            <div className="list-group-item text-danger small">{searchError}</div>
          ) : results.length === 0 ? (
            <div className="list-group-item text-muted small">No providers found</div>
          ) : (
            results.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="list-group-item list-group-item-action"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void setSupervisor(provider.id)}
              >
                {provider.display_name}
                {' '}
                <span className="text-muted small">({provider.username})</span>
              </button>
            ))
          )}
        </div>
      )}

      {supervisor.supervisor_display_name && (
        <div className="mt-2">
          <span className="badge badge-info">
            <i className="fa fa-user-md" aria-hidden="true" />
            {' '}
            {supervisor.supervisor_display_name}
          </span>
          {supervisor.supervisor_from_profile && (
            <small className="text-muted ml-2">(Default from your profile)</small>
          )}
        </div>
      )}
    </div>
  );
}
