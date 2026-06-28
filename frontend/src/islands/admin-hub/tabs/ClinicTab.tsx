import {
  CLINIC_PRINT_FIELDS,
  CLINIC_RECONCILIATION_FIELDS,
} from '../adminFieldDefs';
import { AdminConfigField } from '../AdminConfigField';

interface ClinicTabProps {
  settings: Record<string, unknown>;
  reconciliationStatus: string;
  reconciliationRunning: boolean;
  onFieldChange: (key: string, value: unknown) => void;
  onRunReconciliation: () => void;
}

export function ClinicTab({
  settings,
  reconciliationStatus,
  reconciliationRunning,
  onFieldChange,
  onRunReconciliation,
}: ClinicTabProps) {
  return (
    <>
      <div className="card mb-3">
        <div className="card-body">
          <p className="text-muted">Currency display settings (read-only in V1).</p>
          <dl className="row mb-0">
            <dt className="col-sm-4">Currency code</dt>
            <dd className="col-sm-8" id="nc-admin-currency-code">
              {String(settings.currency_code ?? '—')}
            </dd>
            <dt className="col-sm-4">Symbol</dt>
            <dd className="col-sm-8" id="nc-admin-currency-symbol">
              {String(settings.currency_symbol ?? '—')}
            </dd>
            <dt className="col-sm-4">Decimal places</dt>
            <dd className="col-sm-8" id="nc-admin-currency-decimals">
              {settings.currency_decimals !== undefined ? String(settings.currency_decimals) : '—'}
            </dd>
          </dl>
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
