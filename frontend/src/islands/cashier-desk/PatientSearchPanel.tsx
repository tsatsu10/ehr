import { PatientSearchDropdown } from '@components/PatientSearchDropdown';

export interface PatientSearchHint {
  text: string;
  variant: 'warning' | 'muted';
}

interface PatientSearchPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  blocked: boolean;
  hint: PatientSearchHint | null;
  onSelectPatient: (pid: number) => void;
}

export function PatientSearchPanel({
  ajaxUrl,
  csrfToken,
  blocked,
  hint,
  onSelectPatient,
}: PatientSearchPanelProps) {
  return (
    <>
      <PatientSearchDropdown
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        inputId="nc-cashier-patient-search"
        resultsId="nc-cashier-search-results"
        label="Find patient"
        disabled={blocked}
        onSelectPatient={onSelectPatient}
      />
      {hint && (
        <div
          className={`small mt-2 ${hint.variant === 'warning' ? 'text-warning' : 'text-muted'}`}
          id="nc-cashier-search-hint"
        >
          {hint.text}
        </div>
      )}
    </>
  );
}
