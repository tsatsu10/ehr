import type { PharmacyExternalRxStatus } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';

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
    <div className="nc-pharm-external-rx mb-3 rounded-lg border border-[var(--oe-nc-border)] bg-white p-3">
      <h6 className="mb-2">External paper Rx metadata</h6>
      <p className="mb-3 text-sm text-[var(--oe-nc-text-muted)]">
        Enter prescriber name, registration/ID, and Rx date on the pharmacy service note before
        completing. Rx date must be within the last {status.max_age_days} days and cannot be in the
        future.
      </p>

      <dl className="grid grid-cols-12 gap-3 text-sm mb-3">
        {(['prescriber_name', 'prescriber_reg_id', 'rx_date'] as const).map((key) => {
          const missing = status.missing.includes(key);
          const error = status.field_errors[key];

          return (
            <div key={key} className="col-span-12 md:col-span-4 mb-2">
              <dt className="mb-0 text-[var(--oe-nc-text-muted)]">{FIELD_LABELS[key]}</dt>
              <dd className="mb-0">
                <span className={missing ? 'font-semibold text-red-600' : undefined}>
                  {fieldDisplay(status.fields[key])}
                </span>
                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {status.valid ? (
        <Badge variant="success" className="mb-2">External Rx metadata complete</Badge>
      ) : (
        <div className={deskCalloutClass('warn', 'mb-3 text-sm')} role="alert">
          Complete the required fields on the pharmacy service note, or ask a supervisor to override
          if the script is illegible or the prescriber cannot be verified.
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onOpenPharmacyService}
      >
        {status.pharmacy_service_started ? 'Open pharmacy service note' : 'Start pharmacy service note'}
      </Button>
    </div>
  );
}
