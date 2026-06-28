import { useEffect, useRef } from 'react';
import { StatusPill } from '@components/StatusPill';
import { usePatientSearch } from '@core/usePatientSearch';
import type { PatientSearchRow } from '@core/types';
import { completionVariant, initialsFromName } from './frontDeskUtils';

interface PatientSearchWidgetProps {
  ajaxUrl: string;
  csrfToken: string;
  selectedPid: number | null;
  initialQuery?: string;
  autoSelectFirst?: boolean;
  showRegisterButton?: boolean;
  title?: string;
  onSelectPatient: (pid: number) => void;
  onRegisterPatient: (prefill?: string) => void;
  onResultsChange?: (results: PatientSearchRow[]) => void;
}

export function PatientSearchWidget({
  ajaxUrl,
  csrfToken,
  selectedPid,
  initialQuery = '',
  autoSelectFirst = true,
  showRegisterButton = true,
  title = 'Patient search',
  onSelectPatient,
  onRegisterPatient,
  onResultsChange,
}: PatientSearchWidgetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    query,
    results,
    selectedIndex,
    setSelectedIndex,
    searching,
    error,
    handleInput,
    clearSearch,
  } = usePatientSearch({
    ajaxUrl,
    csrfToken,
    autoSelectFirst,
    initialQuery,
    onSelectPatient,
  });

  useEffect(() => {
    onResultsChange?.(results);
  }, [onResultsChange, results]);

  return (
    <div className="oe-nc-widget-card nc-patient-search" id="nc-patient-search">
      <div className="oe-nc-widget-card__header">
        <h2 className="oe-nc-widget-card__title">{title}</h2>
        {showRegisterButton && (
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            id="nc-add-patient"
            onClick={() => onRegisterPatient(query.trim())}
          >
            <i className="fa fa-user-plus mr-1" aria-hidden="true" />
            Register patient
          </button>
        )}
      </div>
      <div className="oe-nc-widget-card__body oe-nc-widget-card__body--flush">
        <div className="p-3 border-bottom">
          <div className="oe-nc-search-input position-relative">
            <i className="fa fa-search oe-nc-search-input__icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              className="form-control oe-nc-search-input__field pl-4"
              id="nc-search-input"
              placeholder="Search by name, phone, NHIS, National ID, MRN"
              autoComplete="off"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  clearSearch();
                  inputRef.current?.focus();
                  return;
                }
                if (e.key === 'ArrowDown' && results.length) {
                  e.preventDefault();
                  setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
                }
                if (e.key === 'ArrowUp' && results.length) {
                  e.preventDefault();
                  setSelectedIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === 'Enter' && selectedIndex >= 0 && results[selectedIndex]) {
                  e.preventDefault();
                  onSelectPatient(results[selectedIndex].pid);
                }
              }}
            />
            {query && (
              <button
                type="button"
                className="btn btn-sm oe-nc-search-input__clear"
                id="nc-search-input-clear"
                aria-label="Clear search"
                onClick={() => {
                  clearSearch();
                  inputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
          <div className="small text-muted mt-1" id="nc-search-hint">
            Type at least 2 characters · press / to focus
          </div>
          {error && (
            <div className="alert alert-danger mt-2 mb-0" id="nc-search-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div
          id="nc-search-results"
          className="list-group list-group-flush nc-search-results oe-nc-desk-split__search"
          role="listbox"
          aria-label="Search results"
        >
          {searching && (
            <div className="list-group-item text-muted">Searching…</div>
          )}
          {!searching && results.length === 0 && (
            <div className="list-group-item text-muted" id="nc-search-empty" role="option">
              {query.length >= 2
                ? 'No match. Try phone or MRN, or register a new patient.'
                : 'Results appear here'}
            </div>
          )}
          {!searching && results.map((patient, index) => {
            const secondary = [
              patient.sex || '—',
              patient.age_years ?? '—',
              patient.phone_masked || '—',
              `MRN ${patient.pubpid || '—'}`,
            ].join(' · ');
            const isActive = selectedPid === patient.pid || index === selectedIndex;

            return (
              <button
                key={patient.pid}
                type="button"
                className={`list-group-item list-group-item-action nc-search-row oe-nc-search-row text-left${
                  isActive ? ' active' : ''
                }`}
                role="option"
                aria-selected={isActive}
                onClick={() => onSelectPatient(patient.pid)}
              >
                <div className="d-flex justify-content-between align-items-start gap-2 w-100">
                  <div className="oe-nc-cell-identity d-flex">
                    <div className="oe-nc-cell-identity__avatar" aria-hidden="true">
                      {initialsFromName(patient.display_name)}
                    </div>
                    <div>
                      <strong>{patient.display_name}</strong>
                      <div className="small text-muted">{secondary}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`oe-nc-status-pill oe-nc-status-pill--${
                        completionVariant(patient.completion_score ?? 0)
                      } mr-1`}
                    >
                      <span className="oe-nc-status-pill__dot" aria-hidden="true" />
                      <span>{patient.completion_score ?? 0}%</span>
                    </span>
                    {patient.active_visit && (
                      <StatusPill
                        state={patient.active_visit.state}
                        queueNumber={String(patient.active_visit.queue_number)}
                      />
                    )}
                    {patient.chips?.appointment_today && (
                      <span className="oe-nc-status-pill oe-nc-status-pill--info ml-1">
                        <span className="oe-nc-status-pill__dot" aria-hidden="true" />
                        <span>Appointment today</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
