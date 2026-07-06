import type { PharmacyWalkinTriage } from '@core/types';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Button } from '@components/ui/button';

const OUTCOME_LABELS: Record<string, string> = {
  otc_dispensed: 'OTC dispensed',
  external_rx_dispensed: 'External Rx dispensed',
  rx_required_refer_to_opd: 'Refer to OPD',
  rx_required_no_doctor_available: 'No doctor on duty',
  rx_required_patient_declined: 'Patient declined OPD',
};

interface PharmacyWalkinPanelProps {
  triage: PharmacyWalkinTriage;
  selectedOutcome: string | null;
  disabled?: boolean;
  onSelectOutcome: (outcome: string) => void;
  onCloseWithoutDispense: (outcome: string) => void;
}

export function PharmacyWalkinPanel({
  triage,
  selectedOutcome,
  disabled = false,
  onSelectOutcome,
  onCloseWithoutDispense,
}: PharmacyWalkinPanelProps) {
  const dispenseDisabled = disabled || (triage.allergies_undocumented ?? false) || triage.can_dispense === false;

  return (
    <div className="nc-pharm-walkin-panel">
      <h3 className="nc-pharm-walkin-panel__title">Walk-in triage</h3>
      <p className="nc-pharm-walkin-panel__hint">
        Choose a pharmacist outcome before completing or closing this visit.
      </p>

      {triage.allergies_undocumented && (
        <div className={deskCalloutClass('warn', 'mb-3 text-sm')} role="alert">
          Document allergies or &quot;None known&quot; on the chart before OTC or external Rx dispense.
        </div>
      )}

      <div className="nc-pharm-walkin-panel__section">
        <div className="nc-pharm-walkin-panel__section-title">Dispense paths</div>
        <div className="flex flex-wrap gap-2">
          {triage.dispense_outcomes.map((outcome) => (
            <Button
              key={outcome}
              type="button"
              size="sm"
              variant={selectedOutcome === outcome ? 'default' : 'outline'}
              disabled={dispenseDisabled}
              onClick={() => onSelectOutcome(outcome)}
            >
              {OUTCOME_LABELS[outcome] ?? outcome}
            </Button>
          ))}
        </div>
      </div>

      <div className="nc-pharm-walkin-panel__section">
        <div className="nc-pharm-walkin-panel__section-title">Close without dispense</div>
        <div className="flex flex-wrap gap-2">
          {triage.can_refer_to_opd && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-50"
              disabled={disabled}
              onClick={() => onCloseWithoutDispense('rx_required_refer_to_opd')}
            >
              {OUTCOME_LABELS.rx_required_refer_to_opd}
            </Button>
          )}
          {triage.can_record_no_doctor && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-50"
              disabled={disabled}
              onClick={() => onCloseWithoutDispense('rx_required_no_doctor_available')}
            >
              {OUTCOME_LABELS.rx_required_no_doctor_available}
            </Button>
          )}
          {(triage.can_close_without_dispense ?? true) && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => onCloseWithoutDispense('rx_required_patient_declined')}
            >
              {OUTCOME_LABELS.rx_required_patient_declined}
            </Button>
          )}
        </div>
        {triage.roster_enabled && !triage.doctor_available && (
          <p className="mb-0 mt-2 text-sm text-[var(--oe-nc-text-muted)]">
            Doctor roster shows no taking doctors right now.
          </p>
        )}
      </div>
    </div>
  );
}
