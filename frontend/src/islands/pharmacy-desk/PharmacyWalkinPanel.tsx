import type { PharmacyWalkinTriage } from '@core/types';

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
  return (
    <div className="oe-nc-pharm-walkin-panel border rounded p-3 mb-3 bg-light">
      <h5 className="mb-2">Pharmacy walk-in triage</h5>
      <p className="small text-muted mb-3">
        Reception started a pharmacy walk-in visit. Choose the pharmacist outcome before completing or closing.
      </p>

      {triage.allergies_undocumented && (
        <div className="alert alert-warning py-2 mb-3" role="alert">
          Document allergies or &quot;None known&quot; on the chart before OTC or external Rx dispense.
        </div>
      )}

      <div className="mb-3">
        <div className="small font-weight-bold mb-2">Dispense paths</div>
        <div className="d-flex flex-wrap gap-2">
          {triage.dispense_outcomes.map((outcome) => (
            <button
              key={outcome}
              type="button"
              className={`btn btn-sm ${selectedOutcome === outcome ? 'btn-primary' : 'btn-outline-primary'}`}
              disabled={disabled || (triage.allergies_undocumented ?? false) || triage.can_dispense === false}
              onClick={() => onSelectOutcome(outcome)}
            >
              {OUTCOME_LABELS[outcome] ?? outcome}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="small font-weight-bold mb-2">Close without dispense</div>
        <div className="d-flex flex-wrap gap-2">
          {triage.can_refer_to_opd && (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              disabled={disabled}
              onClick={() => onCloseWithoutDispense('rx_required_refer_to_opd')}
            >
              {OUTCOME_LABELS.rx_required_refer_to_opd}
            </button>
          )}
          {triage.can_record_no_doctor && (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              disabled={disabled}
              onClick={() => onCloseWithoutDispense('rx_required_no_doctor_available')}
            >
              {OUTCOME_LABELS.rx_required_no_doctor_available}
            </button>
          )}
          {(triage.can_close_without_dispense ?? true) && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={disabled}
              onClick={() => onCloseWithoutDispense('rx_required_patient_declined')}
            >
              {OUTCOME_LABELS.rx_required_patient_declined}
            </button>
          )}
        </div>
        {triage.roster_enabled && !triage.doctor_available && (
          <p className="small text-muted mt-2 mb-0">Doctor roster shows no taking doctors right now.</p>
        )}
      </div>
    </div>
  );
}
