import type { PharmacyExternalRxStatus } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';

const FIELD_LABELS: Record<string, string> = {
  prescriber_name: 'Prescriber name',
  prescriber_reg_id: 'Prescriber registration / ID',
  rx_date: 'Rx date',
};

interface PharmacyExternalRxPanelProps {
  status: PharmacyExternalRxStatus;
}

function fieldDisplay(value: string): string {
  return value.trim() !== '' ? value : '—';
}

/** Metadata status only — open note via PharmacyShortcuts. */
export function PharmacyExternalRxPanel({ status }: PharmacyExternalRxPanelProps) {
  return (
    <details className="nc-pharm-external-rx" open={!status.valid}>
      <summary className="nc-pharm-external-rx__summary">External paper Rx</summary>
      <div className="nc-pharm-external-rx__body">
        <p className="nc-pharm-external-rx__hint">
          Prescriber name, registration/ID, and Rx date must be on the pharmacy service note.
          Rx date within {status.max_age_days} days, not in the future.
        </p>

        <dl className="nc-pharm-external-rx__fields">
          {(['prescriber_name', 'prescriber_reg_id', 'rx_date'] as const).map((key) => {
            const missing = status.missing.includes(key);
            const error = status.field_errors[key];

            return (
              <div key={key} className="nc-pharm-external-rx__field">
                <dt className="nc-pharm-external-rx__label">{FIELD_LABELS[key]}</dt>
                <dd className="nc-pharm-external-rx__value">
                  <span className={missing ? 'nc-pharm-external-rx__missing' : undefined}>
                    {fieldDisplay(status.fields[key])}
                  </span>
                  {error && <div className="nc-pharm-external-rx__error">{error}</div>}
                </dd>
              </div>
            );
          })}
        </dl>

        {status.valid ? (
          <Badge variant="success">External Rx metadata complete</Badge>
        ) : (
          <div className={deskCalloutClass('warn', 'text-sm')} role="alert">
            Complete required fields on the service note, or request a supervisor override.
          </div>
        )}
      </div>
    </details>
  );
}
