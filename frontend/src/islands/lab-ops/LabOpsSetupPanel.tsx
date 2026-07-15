import { useCallback, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { NativeSelect } from '@components/ui/native-select';
import { oeFetch } from '@core/oeFetch';
import { LabQcRangesEditor } from './LabQcRangesEditor';
import type { SetupModel, SetupStatus } from './labOpsTypes';

interface LabOpsSetupPanelProps {
  ajaxUrl: string;
  csrfToken: string;
  setup: SetupStatus | null;
  onSetupChange: (setup: SetupStatus) => void;
}

export function LabOpsSetupPanel({
  ajaxUrl,
  csrfToken,
  setup,
  onSetupChange,
}: LabOpsSetupPanelProps) {
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);
  const [addingPartner, setAddingPartner] = useState(false);
  const [partnerName, setPartnerName] = useState('External reference lab');

  const reloadSetup = useCallback(async () => {
    const data = await oeFetch<SetupStatus>('lab_ops.setup_status', fetchOptions);
    onSetupChange(data);
  }, [fetchOptions, onSetupChange]);

  const saveSetupModel = useCallback(async (model: SetupModel) => {
    try {
      const data = await oeFetch<{ setup_status?: SetupStatus } & SetupStatus>('lab_ops.setup_model', {
        ...fetchOptions,
        json: { setup_model: model },
      });
      onSetupChange(data.setup_status ?? data);
    } catch {
      showDeskToast('Could not save lab model', 'danger');
      await reloadSetup();
    }
  }, [fetchOptions, onSetupChange, reloadSetup]);

  const createProvider = useCallback(async () => {
    await oeFetch('lab_ops.provider_create', { ...fetchOptions, json: {} });
    await reloadSetup();
  }, [fetchOptions, reloadSetup]);

  const createSendOutProvider = useCallback(async () => {
    const name = partnerName.trim();
    if (name === '') return;
    try {
      await oeFetch('lab_ops.sendout_provider_create', {
        ...fetchOptions,
        json: { lab_name: name },
      });
      setAddingPartner(false);
      await reloadSetup();
    } catch (err) {
      showDeskToast(err instanceof Error ? err.message : 'Could not add lab partner', 'danger');
    }
  }, [fetchOptions, partnerName, reloadSetup]);

  const importStarter = useCallback(async () => {
    await oeFetch('lab_ops.panel_import', {
      ...fetchOptions,
      json: { use_starter: true },
    });
    await reloadSetup();
  }, [fetchOptions, reloadSetup]);

  const applyStarterFees = useCallback(async () => {
    try {
      const data = await oeFetch<{ saved?: number; errors?: string[]; setup_status?: SetupStatus }>(
        'lab_ops.fee_map_save',
        { ...fetchOptions, json: { use_starter_defaults: true } }
      );
      const errors = data.errors ?? [];
      if (errors.length) {
        showDeskToast(errors.join('; '), 'danger');
      } else if ((data.saved ?? 0) > 0) {
        showDeskToast(`Mapped ${data.saved} lab test fee(s)`, 'success');
      }
      onSetupChange(data.setup_status ?? setup ?? {});
      if (!data.setup_status) await reloadSetup();
    } catch {
      showDeskToast('Could not map fees', 'danger');
    }
  }, [fetchOptions, onSetupChange, reloadSetup, setup]);

  if (!setup) return null;

  const model = setup.setup_model ?? 'in_house';

  return (
    <>
    <div className={deskCalloutClass('info', 'mb-3')}>
      <strong>Lab setup</strong>
      <div className="nc-form-group mb-2 mt-2">
        <label className="text-sm font-bold mb-1" htmlFor="nc-labops-setup-model">
          Clinic lab model
        </label>
        <NativeSelect
          className="h-8"
          id="nc-labops-setup-model"
          style={{ maxWidth: '280px' }}
          value={model}
          onChange={(e) => saveSetupModel(e.target.value as SetupModel)}
        >
          <option value="in_house">In-house bench</option>
          <option value="hybrid">Hybrid (in-house + send-out)</option>
          <option value="send_out_only">Send-out only</option>
        </NativeSelect>
      </div>

      {setup.needs_inhouse_provider ? (
        <div className="text-sm mb-2">
          {setup.provider_name
            ? `In-house: ${setup.provider_name} · ${setup.test_count ?? 0} tests`
            : <span className="text-[var(--oe-nc-text-muted)]">No in-house lab provider configured.</span>}
        </div>
      ) : null}

      {setup.needs_sendout_provider ? (
        <div className="text-sm mb-2">
          {setup.sendout_provider_name
            ? `Send-out partner: ${setup.sendout_provider_name}`
            : <span className="text-[var(--oe-nc-text-muted)]">No send-out lab partner configured.</span>}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {setup.needs_inhouse_provider && !setup.provider_id ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void createProvider()}>
            Create in-house lab
          </Button>
        ) : null}
        {setup.needs_sendout_provider && !setup.sendout_provider_id ? (
          addingPartner ? (
            <span className="flex items-center gap-2">
              <Input
                className="h-8"
                style={{ maxWidth: '220px' }}
                autoFocus
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createSendOutProvider(); }}
                aria-label="Send-out lab partner name"
                placeholder="Send-out lab partner name"
              />
              <Button type="button" size="sm" onClick={() => void createSendOutProvider()}>Save</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAddingPartner(false)}>Cancel</Button>
            </span>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setAddingPartner(true)}>
              Add send-out lab partner
            </Button>
          )
        ) : null}
        {setup.needs_inhouse_provider && setup.provider_id && !setup.has_starter_panel && setup.starter_csv_available ? (
          <Button type="button" size="sm" onClick={() => void importStarter()}>
            Import OPD starter panel
          </Button>
        ) : null}
        {setup.needs_inhouse_provider && setup.has_starter_panel ? (
          <>
            <Badge variant="success" className="self-center">Starter panel ready</Badge>
            {setup.fees_mapped ? (
              <Badge variant="success" className="self-center">Fees mapped</Badge>
            ) : (setup.unmapped_fee_count ?? 0) > 0 && setup.can_manage_catalog ? (
              <Button type="button" size="sm" onClick={() => void applyStarterFees()}>
                Apply starter fee defaults
              </Button>
            ) : null}
          </>
        ) : null}
        {setup.needs_sendout_provider && setup.sendout_provider_id && !setup.needs_inhouse_provider ? (
          <Badge variant="success" className="self-center">Send-out partner ready</Badge>
        ) : null}
      </div>

      {setup.needs_sendout_provider && setup.sendout_provider_id && !setup.needs_inhouse_provider ? (
        <div className="text-sm text-[var(--oe-nc-text-muted)] mt-2">
          Send-out test codes are loaded by an OpenEMR administrator (Administration → Lab providers, core screen).
        </div>
      ) : setup.needs_inhouse_provider && setup.has_starter_panel && !setup.fees_mapped && (setup.unmapped_fee_count ?? 0) > 0 ? (
        <div className="text-sm text-[var(--oe-nc-text-muted)] mt-2">
          {setup.unmapped_fee_count} test(s) need fee schedule mapping.
        </div>
      ) : null}
    </div>

    <LabQcRangesEditor ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
    </>
  );
}
