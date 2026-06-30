import { useCallback, useEffect, useMemo, useState } from 'react';
import { oeFetch } from '@core/oeFetch';
import { ConfirmModal } from '@components/ConfirmModal';
import { collectAdminSettings } from './adminFieldDefs';
import { applyAdminSettingCoupling } from './adminSettingCoupling';
import type {
  AdminConfigPayload,
  AdminHubProps,
  AdminScope,
  AdminTabId,
  BillingCode,
  BillingCodeType,
  CashProfileStatus,
  FeeCategoryOption,
  FeeImportSummary,
  FeeScheduleRow,
  FeeTemplate,
  ReconciliationRun,
  VisitTypeRow,
} from './adminTypes';
import { ADMIN_TABS } from './adminTypes';
import { initialAdminTab, localDateString } from './adminUtils';
import { FeeModal } from './modals/FeeModal';
import { VisitTypeModal } from './modals/VisitTypeModal';
import { ClinicTab } from './tabs/ClinicTab';
import { CompletionTab } from './tabs/CompletionTab';
import { FeesTab } from './tabs/FeesTab';
import { QueueRolesTab } from './tabs/QueueRolesTab';
import { RolesTab } from './tabs/RolesTab';
import { VisitTypesTab } from './tabs/VisitTypesTab';
import { useAdminPageHeading } from './useAdminPageHeading';

function isAdminTabId(value: string): value is AdminTabId {
  return ADMIN_TABS.some((tab) => tab.id === value);
}

type AdminConfirm =
  | { type: 'scope_switch'; nextScope: AdminScope }
  | { type: 'archive_visit_type'; row: VisitTypeRow }
  | { type: 'archive_fee'; row: FeeScheduleRow }
  | { type: 'grant_roles' }
  | { type: 'cash_profile' };

export function AdminHub({
  ajaxUrl,
  csrfToken,
  webroot,
  clinicFacilityId,
}: AdminHubProps) {
  const [scope, setScope] = useState<AdminScope>('facility');
  const [activeTab, setActiveTab] = useState<AdminTabId>(() => {
    const tab = initialAdminTab();
    return isAdminTabId(tab) ? tab : 'queue';
  });
  const [facilityId, setFacilityId] = useState(0);
  const [scopeLabel, setScopeLabel] = useState('');
  const [clinicFacilityLabel, setClinicFacilityLabel] = useState('');
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [visitTypes, setVisitTypes] = useState<VisitTypeRow[]>([]);
  const [calendarCategories, setCalendarCategories] = useState<AdminConfigPayload['calendar_categories']>([]);
  const [feeSchedule, setFeeSchedule] = useState<FeeScheduleRow[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategoryOption[]>([]);
  const [feeTemplates, setFeeTemplates] = useState<FeeTemplate[]>([]);
  const [billingCodeTypes, setBillingCodeTypes] = useState<BillingCodeType[]>([]);
  const [defaultCodeType, setDefaultCodeType] = useState('CPT4');
  const [roleGroups, setRoleGroups] = useState<AdminConfigPayload['roles']>({});
  const [reconciliationStatus, setReconciliationStatus] = useState('Last run: not loaded yet');
  const [reconciliationRunning, setReconciliationRunning] = useState(false);
  const [cashProfile, setCashProfile] = useState<CashProfileStatus>({ applied: false });
  const [cashProfileApplying, setCashProfileApplying] = useState(false);

  const [visitTypeModalOpen, setVisitTypeModalOpen] = useState(false);
  const [visitTypeEdit, setVisitTypeEdit] = useState<VisitTypeRow | null>(null);
  const [visitTypeSaving, setVisitTypeSaving] = useState(false);
  const [visitTypeError, setVisitTypeError] = useState<string | null>(null);

  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [feeEdit, setFeeEdit] = useState<FeeScheduleRow | null>(null);
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [billingCodes, setBillingCodes] = useState<BillingCode[]>([]);
  const [billingCodesLoading, setBillingCodesLoading] = useState(false);

  const [feeCsv, setFeeCsv] = useState('');
  const [feeImporting, setFeeImporting] = useState(false);
  const [grantingRoles, setGrantingRoles] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<AdminConfirm | null>(null);

  const fetchOptions = useMemo(
    () => ({ ajaxUrl, csrfToken }),
    [ajaxUrl, csrfToken]
  );

  const scopeHint = scope === 'global'
    ? 'Applies as the default when a clinic has no override. Existing per-clinic rows still win until you save under This clinic.'
    : `Editing ${scopeLabel || clinicFacilityLabel} (ID ${facilityId}). These values override the global default for this clinic.`;

  const statusText = scopeLabel || `Facility ${facilityId}`;

  const applyPayload = useCallback((data: AdminConfigPayload) => {
    setFacilityId(data.facility_id ?? 0);
    setScope(data.scope === 'global' ? 'global' : 'facility');
    setScopeLabel(data.scope_label ?? '');
    setClinicFacilityLabel(data.clinic_facility_label ?? `Facility ${clinicFacilityId}`);
    setSettings(data.settings ?? {});
    setVisitTypes(data.visit_types ?? []);
    setCalendarCategories(data.calendar_categories ?? []);
    setFeeSchedule(data.fee_schedule ?? []);
    setFeeCategories(data.categories ?? []);
    setFeeTemplates(data.templates ?? []);
    setBillingCodeTypes(data.billing_code_types ?? []);
    setDefaultCodeType(data.default_code_type ?? 'CPT4');
    setRoleGroups(data.roles ?? {});
    setCashProfile(data.cash_profile ?? { applied: false });
    setDirty(false);
  }, [clinicFacilityId]);

  const loadReconciliationStatus = useCallback(async () => {
    try {
      const data = await oeFetch<{ latest_run?: ReconciliationRun | null }>('reports.reconciliation', {
        ...fetchOptions,
        params: { facility_id: facilityId > 0 ? facilityId : clinicFacilityId },
      });
      const latest = data.latest_run;
      if (!latest) {
        setReconciliationStatus('Last run: none yet');
        return;
      }
      setReconciliationStatus(
        `Last run: ${latest.run_date ?? ''} — ${latest.status ?? ''} (delta ${latest.delta_amount ?? '0'})`
      );
    } catch {
      setReconciliationStatus('Last run: unavailable');
    }
  }, [clinicFacilityId, facilityId, fetchOptions]);

  const loadSettings = useCallback(async (nextScope: AdminScope) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.config', {
        ...fetchOptions,
        params: { scope: nextScope },
      });
      applyPayload(data);
      await loadReconciliationStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Load failed';
      setLoadError(message);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [applyPayload, fetchOptions, loadReconciliationStatus]);

  useEffect(() => {
    void loadSettings(scope);
  }, [loadSettings, scope]);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    setSettings((prev) => applyAdminSettingCoupling(key, value, prev));
    setDirty(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  }, []);

  const handleSave = useCallback(async () => {
    const saveBtn = document.getElementById('nc-admin-save') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = true;
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.config.save', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          settings: collectAdminSettings(settings),
        },
      });
      applyPayload(data);
      setSuccessMessage('Settings saved.');
      await loadReconciliationStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setErrorMessage(message);
      setDirty(true);
    }
  }, [applyPayload, facilityId, fetchOptions, loadReconciliationStatus, scope, settings]);

  useAdminPageHeading({
    dirty,
    statusText,
    onSave: () => { void handleSave(); },
  });

  const handleScopeChange = useCallback((nextScope: AdminScope) => {
    if (dirty) {
      setPendingConfirm({ type: 'scope_switch', nextScope });
      return;
    }
    setScope(nextScope);
    setDirty(false);
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [dirty]);

  const handleTabChange = useCallback((tab: AdminTabId) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab !== 'queue') {
      url.searchParams.set('tab', tab);
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  const loadBillingCodes = useCallback(async (codeType: string, selected?: string) => {
    setBillingCodesLoading(true);
    try {
      const data = await oeFetch<{ billing_codes?: BillingCode[] }>('admin.fee.billing_codes', {
        ...fetchOptions,
        params: { code_type: codeType || defaultCodeType },
      });
      const codes = data.billing_codes ?? [];
      setBillingCodes(codes);
      if (selected && codes.some((c) => c.code === selected)) {
        return selected;
      }
      return '';
    } catch {
      setBillingCodes([]);
      return '';
    } finally {
      setBillingCodesLoading(false);
    }
  }, [defaultCodeType, fetchOptions]);

  const openVisitTypeModal = useCallback((row: VisitTypeRow | null) => {
    setVisitTypeEdit(row);
    setVisitTypeError(null);
    setVisitTypeModalOpen(true);
  }, []);

  const saveVisitType = useCallback(async (payload: {
    id: number;
    label: string;
    pc_catid: number;
    service_profile: string;
    referral_required: boolean;
    is_default: boolean;
    cashier_fee_hint_ids: number[];
  }) => {
    setVisitTypeSaving(true);
    setVisitTypeError(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.visit_type.save', {
        ...fetchOptions,
        json: {
          facility_id: facilityId,
          visit_type: payload,
        },
      });
      setVisitTypes(data.visit_types ?? []);
      setCalendarCategories(data.calendar_categories ?? calendarCategories);
      setVisitTypeModalOpen(false);
      setSuccessMessage('Visit type saved.');
      setErrorMessage(null);
    } catch (err) {
      setVisitTypeError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setVisitTypeSaving(false);
    }
  }, [calendarCategories, facilityId, fetchOptions]);

  const archiveVisitType = useCallback(async (row: VisitTypeRow) => {
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.visit_type.archive', {
        ...fetchOptions,
        json: { facility_id: facilityId, visit_type_id: row.id },
      });
      setVisitTypes(data.visit_types ?? []);
      setSuccessMessage('Visit type archived.');
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Archive failed');
    }
  }, [facilityId, fetchOptions]);

  const openFeeModal = useCallback(async (row: FeeScheduleRow | null) => {
    setFeeEdit(row);
    setFeeError(null);
    const codeType = row?.code_type ?? defaultCodeType;
    await loadBillingCodes(codeType, row?.billing_code ?? '');
    setFeeModalOpen(true);
  }, [defaultCodeType, loadBillingCodes]);

  const saveFee = useCallback(async (payload: {
    id: number;
    code: string;
    name: string;
    category: string;
    price_amount: number;
    sort_order: number;
    code_type: string;
    billing_code: string;
  }) => {
    setFeeSaving(true);
    setFeeError(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.fee.save', {
        ...fetchOptions,
        json: { facility_id: facilityId, fee: payload },
      });
      setFeeSchedule(data.fee_schedule ?? []);
      if (data.categories) setFeeCategories(data.categories);
      if (data.templates) setFeeTemplates(data.templates);
      if (data.billing_code_types) setBillingCodeTypes(data.billing_code_types);
      if (data.default_code_type) setDefaultCodeType(data.default_code_type);
      setFeeModalOpen(false);
      setSuccessMessage('Fee line saved.');
      setErrorMessage(null);
    } catch (err) {
      setFeeError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setFeeSaving(false);
    }
  }, [facilityId, fetchOptions]);

  const archiveFee = useCallback(async (row: FeeScheduleRow) => {
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.fee.archive', {
        ...fetchOptions,
        json: { facility_id: facilityId, fee_id: row.id },
      });
      setFeeSchedule(data.fee_schedule ?? []);
      setSuccessMessage('Fee line archived.');
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Archive failed');
    }
  }, [facilityId, fetchOptions]);

  const importFees = useCallback(async () => {
    if (!feeCsv.trim()) {
      setErrorMessage('Paste CSV content first.');
      return;
    }
    setFeeImporting(true);
    try {
      const data = await oeFetch<AdminConfigPayload & { import_summary?: FeeImportSummary }>(
        'admin.fee.import',
        {
          ...fetchOptions,
          json: { facility_id: facilityId, csv: feeCsv },
        }
      );
      setFeeSchedule(data.fee_schedule ?? feeSchedule);
      setFeeCsv('');
      const summary = data.import_summary ?? {};
      setSuccessMessage(
        `Imported ${summary.imported ?? 0} fee line(s), skipped ${summary.skipped ?? 0}.`
      );
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setFeeImporting(false);
    }
  }, [feeCsv, feeSchedule, facilityId, fetchOptions]);

  const grantSelfRoles = useCallback(async () => {
    setGrantingRoles(true);
    try {
      const result = await oeFetch<{ message?: string }>('admin.roles.grant_self', {
        ...fetchOptions,
        method: 'POST',
        json: {},
      });
      setSuccessMessage(result.message ?? 'Roles granted.');
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Grant failed');
    } finally {
      setGrantingRoles(false);
    }
  }, [fetchOptions]);

  const runReconciliation = useCallback(async () => {
    setReconciliationRunning(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<{
        status?: string;
        module_total_amount?: number;
        core_total_amount?: number;
        delta_amount?: number;
      }>('admin.reconciliation.run', {
        ...fetchOptions,
        json: { run_date: localDateString() },
      });
      setSuccessMessage(
        `Reconciliation ${data.status ?? 'done'} — module ${data.module_total_amount ?? 0}, ` +
        `core ${data.core_total_amount ?? 0}, delta ${data.delta_amount ?? 0}`
      );
      await loadReconciliationStatus();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setReconciliationRunning(false);
    }
  }, [fetchOptions, loadReconciliationStatus]);

  const applyCashProfile = useCallback(async () => {
    setCashProfileApplying(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.profile.apply_cash_clinic', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
        },
      });
      applyPayload(data);
      setSuccessMessage('Cash clinic profile applied.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Apply cash clinic profile failed');
    } finally {
      setCashProfileApplying(false);
    }
  }, [applyPayload, facilityId, fetchOptions, scope]);

  const roles = roleGroups ?? {};

  return (
    <div id="nc-admin-desk">
      {successMessage && (
        <div className="alert alert-success" id="nc-admin-success">{successMessage}</div>
      )}
      {errorMessage && (
        <div className="alert alert-danger" id="nc-admin-error">{errorMessage}</div>
      )}
      {loadError && !errorMessage && (
        <div className="alert alert-danger">{loadError}</div>
      )}

      <div className="d-flex flex-wrap align-items-center mb-3">
        <label className="mb-0 mr-2" htmlFor="nc-admin-scope">Settings for:</label>
        <select
          className="form-control form-control-sm w-auto mr-2"
          id="nc-admin-scope"
          value={scope}
          onChange={(e) => handleScopeChange(e.target.value === 'global' ? 'global' : 'facility')}
        >
          <option value="facility">This clinic</option>
          <option value="global">All facilities (global default)</option>
        </select>
        <span className="text-muted small" id="nc-admin-scope-hint">{scopeHint}</span>
      </div>

      <ul className="nav nav-tabs mb-3" role="tablist">
        {ADMIN_TABS.map((tab) => (
          <li className="nav-item" key={tab.id}>
            <button
              type="button"
              className={`nav-link${activeTab === tab.id ? ' active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="tab-content">
        {loading ? (
          <div className="text-muted"><em>Loading settings…</em></div>
        ) : (
          <>
            {activeTab === 'queue' && (
              <QueueRolesTab settings={settings} onFieldChange={handleFieldChange} />
            )}
            {activeTab === 'roles' && (
              <RolesTab
                webroot={webroot}
                roleGroups={roles.role_groups ?? []}
                sensitivePermissions={roles.sensitive_permissions ?? []}
                aclInventory={roles.acl_inventory ?? []}
                onGrantSelf={() => setPendingConfirm({ type: 'grant_roles' })}
                granting={grantingRoles}
              />
            )}
            {activeTab === 'completion' && (
              <CompletionTab settings={settings} onFieldChange={handleFieldChange} />
            )}
            {activeTab === 'clinic' && (
              <ClinicTab
                settings={settings}
                cashProfile={cashProfile}
                cashProfileApplying={cashProfileApplying}
                reconciliationStatus={reconciliationStatus}
                reconciliationRunning={reconciliationRunning}
                onFieldChange={handleFieldChange}
                onApplyCashProfile={() => setPendingConfirm({ type: 'cash_profile' })}
                onRunReconciliation={() => { void runReconciliation(); }}
              />
            )}
            {activeTab === 'types' && (
              <VisitTypesTab
                visitTypes={visitTypes}
                calendarCategories={calendarCategories ?? []}
                onAdd={() => openVisitTypeModal(null)}
                onEdit={(row) => openVisitTypeModal(row)}
                onArchive={(row) => setPendingConfirm({ type: 'archive_visit_type', row })}
              />
            )}
            {activeTab === 'fees' && (
              <FeesTab
                feeSchedule={feeSchedule}
                settings={settings}
                webroot={webroot}
                csv={feeCsv}
                importing={feeImporting}
                onCsvChange={setFeeCsv}
                onAdd={() => { void openFeeModal(null); }}
                onEdit={(row) => { void openFeeModal(row); }}
                onArchive={(row) => setPendingConfirm({ type: 'archive_fee', row })}
                onImport={() => { void importFees(); }}
              />
            )}
          </>
        )}
      </div>

      <VisitTypeModal
        open={visitTypeModalOpen}
        row={visitTypeEdit}
        calendarCategories={calendarCategories ?? []}
        feeSchedule={feeSchedule}
        saving={visitTypeSaving}
        error={visitTypeError}
        onClose={() => setVisitTypeModalOpen(false)}
        onSave={(payload) => { void saveVisitType(payload); }}
      />

      <FeeModal
        open={feeModalOpen}
        row={feeEdit}
        settings={settings}
        categories={feeCategories}
        templates={feeTemplates}
        billingCodeTypes={billingCodeTypes}
        defaultCodeType={defaultCodeType}
        billingCodes={billingCodes}
        billingCodesLoading={billingCodesLoading}
        saving={feeSaving}
        error={feeError}
        onClose={() => setFeeModalOpen(false)}
        onCodeTypeChange={(codeType) => { void loadBillingCodes(codeType); }}
        onSave={(payload) => { void saveFee(payload); }}
      />

      <ConfirmModal
        open={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        title={
          pendingConfirm?.type === 'scope_switch' ? 'Switch settings scope?'
            : pendingConfirm?.type === 'archive_visit_type' ? 'Archive visit type?'
              : pendingConfirm?.type === 'archive_fee' ? 'Archive fee line?'
                : pendingConfirm?.type === 'grant_roles' ? 'Grant desk roles?'
                  : 'Apply cash clinic profile?'
        }
        modalId="nc-admin-confirm-modal"
        cancelLabel="Cancel"
        confirmLabel={
          pendingConfirm?.type === 'scope_switch' ? 'Switch'
            : pendingConfirm?.type === 'grant_roles' ? 'Grant roles'
              : pendingConfirm?.type === 'cash_profile' ? 'Apply profile'
                : 'Archive'
        }
        confirmVariant={
          pendingConfirm?.type === 'archive_visit_type' || pendingConfirm?.type === 'archive_fee'
            ? 'danger'
            : 'warning'
        }
        onConfirm={() => {
          if (!pendingConfirm) return;
          if (pendingConfirm.type === 'scope_switch') {
            setScope(pendingConfirm.nextScope);
            setDirty(false);
            setSuccessMessage(null);
            setErrorMessage(null);
          } else if (pendingConfirm.type === 'archive_visit_type') {
            void archiveVisitType(pendingConfirm.row);
          } else if (pendingConfirm.type === 'archive_fee') {
            void archiveFee(pendingConfirm.row);
          } else if (pendingConfirm.type === 'grant_roles') {
            void grantSelfRoles();
          } else if (pendingConfirm.type === 'cash_profile') {
            void applyCashProfile();
          }
          setPendingConfirm(null);
        }}
      >
        {pendingConfirm?.type === 'scope_switch' && (
          <p className="mb-0">Discard unsaved changes and switch settings scope?</p>
        )}
        {pendingConfirm?.type === 'archive_visit_type' && (
          <p className="mb-0">Archive visit type &quot;{pendingConfirm.row.label}&quot;?</p>
        )}
        {pendingConfirm?.type === 'archive_fee' && (
          <p className="mb-0">Archive fee line &quot;{pendingConfirm.row.name}&quot;?</p>
        )}
        {pendingConfirm?.type === 'grant_roles' && (
          <p className="mb-0">
            Grant all New Clinic desk groups to your account? Log out and back in afterward.
          </p>
        )}
        {pendingConfirm?.type === 'cash_profile' && (
          <p className="mb-0">
            Apply the cash clinic profile? This updates OpenEMR globals (E-Sign, currency symbol,
            eligibility, search UI) and enables pinned reception preview. Changes are logged.
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}
