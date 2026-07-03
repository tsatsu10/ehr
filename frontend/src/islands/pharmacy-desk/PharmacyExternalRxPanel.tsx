import type { PharmacyExternalRxStatus } from '@core/types';

const FIELD_LABELS: Record<string, string> = {
  prescriber_name: 'Prescriber name',
  prescriber_reg_id: 'Prescriber registration / ID',
  rx_date: 'Rx date',
};

interface PharmacyExternalRxPanelProps {
  status: PharmacyExternalRxStatus;
  disabled?: boolean;
  onOpenPharmacyService: () => void;
}

function fieldDisplay(value: string): string {
  return value.trim() !== '' ? value : '—';
}

export function PharmacyExternalRxPanel({
  status,
  disabled = false,
  onOpenPharmacyService,
}: PharmacyExternalRxPanelProps) {
  return (
    <div className="oe-nc-pharm-external-rx border rounded p-3 mb-3 bg-white">
      <h6 className="mb-2">External paper Rx metadata</h6>
      <p className="small text-muted mb-3">
        Enter prescriber name, registration/ID, and Rx date on the pharmacy service note before
        completing. Rx date must be within the last {status.max_age_days} days and cannot be in the
        future.
      </p>

      <dl className="row small mb-3">
        {(['prescriber_name', 'prescriber_reg_id', 'rx_date'] as const).map((key) => {
          const missing = status.missing.includes(key);
          const error = status.field_errors[key];

          return (
            <div key={key} className="col-md-4 mb-2">
              <dt className="text-muted mb-0">{FIELD_LABELS[key]}</dt>
              <dd className="mb-0">
                <span className={missing ? 'text-danger font-weight-bold' : undefined}>
                  {fieldDisplay(status.fields[key])}
                </span>
                {error && (
                  <div className="text-danger small">{error}</div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {status.valid ? (
        <span className="badge badge-success mb-2">External Rx metadata complete</span>
      ) : (
        <div className="alert alert-warning py-2 mb-3 small" role="alert">
          Complete the required fields on the pharmacy service note, or ask a supervisor to override
          if the script is illegible or the prescriber cannot be verified.
        </div>
      )}

      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        disabled={disabled}
        onClick={onOpenPharmacyService}
      >
        {status.pharmacy_service_started ? 'Open pharmacy service note' : 'Start pharmacy service note'}
      </button>
    </div>
  );
}
