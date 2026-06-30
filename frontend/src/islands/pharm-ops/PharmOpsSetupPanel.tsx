import { useCallback, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import type { PharmSetupStatus } from './pharmOpsTypes';
import { PharmOpsControlledCatalog } from './PharmOpsControlledCatalog';

interface PharmOpsSetupPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  setup: PharmSetupStatus | null;
  onSetupChange: (setup: PharmSetupStatus) => void;
}

export function PharmOpsSetupPanel({
  ajaxUrl,
  csrfToken,
  setup,
  onSetupChange,
}: PharmOpsSetupPanelProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const reloadSetup = useCallback(async () => {
    const data = await oeFetch<PharmSetupStatus>('pharm_ops.setup_status', fetchOptions);
    onSetupChange(data);
  }, [fetchOptions, onSetupChange]);

  const createWarehouse = useCallback(async () => {
    try {
      setActionError(null);
      setActionSuccess(null);
      const data = await oeFetch<{ setup_status?: PharmSetupStatus } & PharmSetupStatus>(
        'pharm_ops.warehouse_create',
        { ...fetchOptions, json: {} },
      );
      onSetupChange(data.setup_status ?? data);
      setActionSuccess('Warehouse created.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create warehouse');
      await reloadSetup();
    }
  }, [fetchOptions, onSetupChange, reloadSetup]);

  const importStarter = useCallback(async () => {
    try {
      setActionError(null);
      setActionSuccess(null);
      const data = await oeFetch<{
        imported?: number;
        updated?: number;
        setup_status?: PharmSetupStatus;
      } & PharmSetupStatus>('pharm_ops.formulary_import', {
        ...fetchOptions,
        json: { use_starter: true },
      });
      const imported = (data.imported ?? 0) + (data.updated ?? 0);
      if (imported > 0) {
        setActionSuccess(`Formulary import complete (${imported} product row(s) processed).`);
      }
      onSetupChange(data.setup_status ?? data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not import formulary');
    }
  }, [fetchOptions, onSetupChange]);

  if (!setup) return null;

  const needsWarehouse = (setup.warehouse_count ?? 0) === 0;
  const needsFormulary = !setup.has_starter_formulary;

  return (
    <div className="oe-nc-pharmops-setup card mb-3" id="nc-pharmops-setup">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start mb-2">
          <div>
            <h2 className="h6 mb-1">Pharmacy setup</h2>
            <p className="small text-muted mb-0">
              In-house level:
              {' '}
              {setup.inhouse_pharmacy_label ?? 'Unknown'}
              {' · '}
              {setup.drug_count ?? 0}
              {' active products'}
            </p>
          </div>
          {setup.can_manage_catalog ? (
            <span className="badge badge-light">Catalog admin</span>
          ) : null}
        </div>

        {actionError ? (
          <div className="alert alert-warning py-2 mb-2" role="alert">{actionError}</div>
        ) : null}
        {actionSuccess ? (
          <div className="alert alert-success py-2 mb-2" role="status">{actionSuccess}</div>
        ) : null}

        {needsWarehouse ? (
          <div className="mb-3">
            <p className="small mb-2">Step 1 — Create a default warehouse for receiving stock.</p>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              id="nc-pharmops-setup-warehouse"
              disabled={!setup.can_manage_catalog}
              onClick={() => { void createWarehouse(); }}
            >
              Create warehouse
            </button>
          </div>
        ) : (
          <div className="small text-muted mb-3">
            Warehouse ready
            {setup.default_warehouse_id ? ` (${setup.default_warehouse_id})` : ''}.
          </div>
        )}

        {needsFormulary ? (
          <div className="mb-3">
            <p className="small mb-2">
              Step 2 — Import the OPD starter formulary (10 essential products with templates and prices).
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm mr-2"
              id="nc-pharmops-setup-import"
              disabled={!setup.can_manage_catalog || !setup.starter_csv_available}
              onClick={() => { void importStarter(); }}
            >
              Import starter formulary
            </button>
          </div>
        ) : (
          <div className="alert alert-success py-2 px-3 small mb-3">
            Starter formulary imported ({setup.drug_count} active products).
          </div>
        )}

        <div className="small text-muted">
          Step 3 — Map fees in
          {' '}
          {setup.admin_hub_url ? (
            <a href={setup.admin_hub_url} target="_top">Clinic Setup → Fee schedule</a>
          ) : (
            'Clinic Setup → Fee schedule'
          )}
          . Disable legacy min/max months in globals when using reorder points (M6-F26).
        </div>

        <PharmOpsControlledCatalog
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          enabled={!!setup.can_manage_catalog && !needsFormulary}
        />
      </div>
    </div>
  );
}
