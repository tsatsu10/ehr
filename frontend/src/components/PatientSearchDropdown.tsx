import { useState } from 'react';
import { usePatientSearch } from '@core/usePatientSearch';
import type { PatientSearchRow } from '@core/types';

export interface PatientSearchDropdownProps {
  ajaxUrl: string;
  csrfToken: string;
  inputId: string;
  resultsId: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  label?: string;
  labelClassName?: string;
  onSelectPatient: (pid: number, row?: PatientSearchRow) => void;
}

export function PatientSearchDropdown({
  ajaxUrl,
  csrfToken,
  inputId,
  resultsId,
  placeholder = 'Name or MRN',
  disabled = false,
  inputClassName = 'form-control form-control-sm',
  label,
  labelClassName = 'small font-weight-bold mb-1',
  onSelectPatient,
}: PatientSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const { query, results, handleInput, clearSearch } = usePatientSearch({ ajaxUrl, csrfToken });

  const handlePick = (row: PatientSearchRow) => {
    clearSearch();
    setOpen(false);
    onSelectPatient(row.pid, row);
  };

  return (
    <div className="mb-3 position-relative">
      {label && (
        <label className={labelClassName} htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        type="search"
        className={inputClassName}
        id={inputId}
        placeholder={placeholder}
        autoComplete="off"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          handleInput(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
      />
      {open && query.length >= 2 && (
        <div
          className="list-group position-absolute w-100 shadow-sm"
          id={resultsId}
          style={{ zIndex: 20, maxHeight: 240, overflowY: 'auto' }}
        >
          {results.length === 0 ? (
            <div className="list-group-item text-muted">No patients found</div>
          ) : (
            results.map((row) => (
              <button
                key={row.pid}
                type="button"
                className="list-group-item list-group-item-action text-left"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(row)}
              >
                <strong>{row.display_name}</strong>
                <div className="small text-muted">MRN {row.pubpid}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
