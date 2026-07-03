import {
  CLINIC_CURRENCY_FIELDS,
  CLINIC_PRINT_FIELDS,
  CLINIC_RECONCILIATION_FIELDS,
} from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';
import type { CashProfileStatus } from '../adminTypes';
import { formatPrice } from '../adminUtils';

interface ClinicTabProps {
  settings: Record<string, unknown>;
  cashProfile: CashProfileStatus;
  cashProfileApplying: boolean;
  reconciliationStatus: string;
  reconciliationRunning: boolean;
  onFieldChange: (key: string, value: unknown) => void;
  onApplyCashProfile: () => void;
  onRunReconciliation: () => void;
}

function formatAppliedAt(value?: string | null): string {
  if (!value) {
    return 'Not applied yet';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function ClinicTab({
  settings,
  cashProfile,
  cashProfileApplying,
  reconciliationStatus,
  reconciliationRunning,
  onFieldChange,
  onApplyCashProfile,
  onRunReconciliation,
}: ClinicTabProps) {
  return (
    <>
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-start justify-content-between">
            <div className="mb-2 mb-md-0">
              <h5 className="card-title mb-1">Cash clinic profile</h5>
              <p className="text-muted small mb-2">
                Applies recommended OpenEMR globals for a private cash clinic (Appendix E):
                disables insurance eligibility noise, enables E-Sign defaults, syncs currency
                symbol, and turns on pinned reception preview plus print Rx.
              </p>
              <p className="small mb-0" id="nc-admin-cash-profile-status">
                <span className={`badge badge-${cashProfile.applied ? 'success' : 'secondary'} mr-2`}>
                  {cashProfile.applied ? 'Applied' : 'Not applied'}
                </span>
                Last applied: {formatAppliedAt(cashProfile.last_applied_at)}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              id="nc-admin-apply-cash-profile"
              disabled={cashProfileApplying}
              onClick={onApplyCashProfile}
            >
              {cashProfileApplying ? 'Applying…' : 'Apply cash clinic profile'}
            </button>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Clinic currency</h5>
          <p className="text-muted small">
            Example: {formatPrice(160, settings)}
          </p>
          {CLINIC_CURRENCY_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">Queue slip & receipt print</h5>
          {CLINIC_PRINT_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Cashier reconciliation</h5>
          {CLINIC_RECONCILIATION_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
          <p className="text-muted small mb-2" id="nc-admin-reconciliation-status">
            {reconciliationStatus}
          </p>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            id="nc-admin-run-reconciliation"
            disabled={reconciliationRunning}
            onClick={onRunReconciliation}
          >
            {reconciliationRunning ? 'Running…' : 'Run reconciliation now'}
          </button>
        </div>
      </div>
    </>
  );
}
