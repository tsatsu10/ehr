import { useState } from 'react';
import { Input } from '@components/ui/input';
import { cn } from '@/lib/utils';
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
  inputClassName,
  label,
  labelClassName = 'text-sm font-bold mb-1',
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
      <Input
        type="search"
        className={cn('h-8', inputClassName)}
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
          className="nc-list-group absolute w-full shadow-sm"
          id={resultsId}
          style={{ zIndex: 20, maxHeight: 240, overflowY: 'auto' }}
        >
          {results.length === 0 ? (
            <div className="nc-list-group-item text-[var(--oe-nc-text-muted)]">No patients found</div>
          ) : (
            results.map((row) => (
              <button
                key={row.pid}
                type="button"
                className="nc-list-group-item nc-list-group-item-action text-left"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(row)}
              >
                <strong>{row.display_name}</strong>
                {row.pubpid && <span className="text-[var(--oe-nc-text-muted)] ml-2">{row.pubpid}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
