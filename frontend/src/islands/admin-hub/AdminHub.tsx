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
  GhanaLbfPackStatus,
  AncillaryLbfPackStatus,
  FormBundleBoardPayload,
  FormsCatalogItem,
  FormsCatalogPayload,
  RunbooksPayload,
  SetupProgressPayload,
  ConfigExportMeta,
  ConfigImportResult,
  CompletionFieldWeightPayload,
  CompletionFieldWeightRow,
  SystemHealthPayload,
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
import { FormsTab } from './tabs/FormsTab';
import { SystemTab } from './tabs/SystemTab';
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
  | { type: 'cash_profile' }
  | { type: 'catalog_enable'; item: FormsCatalogItem };

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
  const [ghanaLbfPack, setGhanaLbfPack] = useState<GhanaLbfPackStatus>({ installed: false });
  const [ghanaLbfImporting, setGhanaLbfImporting] = useState(false);
  const [ancillaryLbfPacks, setAncillaryLbfPacks] = useState<AncillaryLbfPackStatus[]>([]);
  const [ancillaryLbfImporting, setAncillaryLbfImporting] = useState<string | null>(null);
  const [formBundleBoard, setFormBundleBoard] = useState<FormBundleBoardPayload | null>(null);
  const [formsCatalog, setFormsCatalog] = useState<FormsCatalogPayload | null>(null);
  const [catalogTogglingId, setCatalogTogglingId] = useState<number | null>(null);
  const [installingAllAncillary, setInstallingAllAncillary] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealthPayload | null>(null);
  const [runbooks, setRunbooks] = useState<RunbooksPayload | null>(null);
  const [setupProgress, setSetupProgress] = useState<SetupProgressPayload | null>(null);
  const [configExport, setConfigExport] = useState<ConfigExportMeta | null>(null);
  const [configExporting, setConfigExporting] = useState(false);
  const [configImportPreview, setConfigImportPreview] = useState<ConfigImportResult | null>(null);
  const [configImportSnapshot, setConfigImportSnapshot] = useState<Record<string, unknown> | null>(null);
  const [configImportPreviewing, setConfigImportPreviewing] = useState(false);
  const [configImporting, setConfigImporting] = useState(false);
  const [setupMarkingKey, setSetupMarkingKey] = useState<string | null>(null);
  const [setupCompleting, setSetupCompleting] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupCompleting, setBackupCompleting] = useState(false);
  const [healthRefreshing, setHealthRefreshing] = useState(false);
  const [completionFieldWeights, setCompletionFieldWeights] = useState<CompletionFieldWeightPayload | null>(null);
  const [weightsSaving, setWeightsSaving] = useState(false);
  const [weightsError, setWeightsError] = useState<string | null>(null);

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

  const adminHubEnabled = settings.enable_admin_hub === true;
  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => tab.id !== 'system' || adminHubEnabled),
    [adminHubEnabled]
  );

  useEffect(() => {
    if (!adminHubEnabled && activeTab === 'system') {
      setActiveTab('queue');
    }
  }, [adminHubEnabled, activeTab]);

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
    setGhanaLbfPack(data.ghana_lbf_pack ?? { installed: false });
    setAncillaryLbfPacks(data.ancillary_lbf_packs ?? []);
    setFormBundleBoard(data.form_bundle_board ?? null);
    setFormsCatalog(data.forms_catalog ?? null);
    setSystemHealth(data.system_health ?? null);
    setRunbooks(data.runbooks ?? null);
    setSetupProgress(data.setup_progress ?? null);
    setConfigExport(data.config_export ?? null);
    setCompletionFieldWeights(data.completion_field_weights ?? null);
    setWeightsError(null);
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

  const saveCompletionWeights = useCallback(
    async (items: CompletionFieldWeightRow[]) => {
      setWeightsSaving(true);
      setWeightsError(null);
      try {
        const data = await oeFetch<AdminConfigPayload>('admin.completion_weights.save', {
          ...fetchOptions,
          method: 'POST',
          json: {
            scope,
            facility_id: facilityId,
            items,
          },
        });
        applyPayload(data);
        setSuccessMessage('Completion weights saved.');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save completion weights.';
        setWeightsError(message);
        setErrorMessage(message);
      } finally {
        setWeightsSaving(false);
      }
    },
    [applyPayload, facilityId, fetchOptions, scope]
  );

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

  const refreshSystemHealth = useCallback(async () => {
    setHealthRefreshing(true);
    try {
      const data = await oeFetch<{ system_health?: SystemHealthPayload }>('admin_hub.health_status', {
        ...fetchOptions,
        params: {
          scope,
          facility_id: facilityId > 0 ? facilityId : clinicFacilityId,
        },
      });
      if (data.system_health) {
        setSystemHealth(data.system_health);
      }
    } catch {
      /* keep last known health */
    } finally {
      setHealthRefreshing(false);
    }
  }, [clinicFacilityId, facilityId, fetchOptions, scope]);

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
      await refreshSystemHealth();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setReconciliationRunning(false);
    }
  }, [fetchOptions, loadReconciliationStatus, refreshSystemHealth]);

  const runBackup = useCallback(async () => {
    setBackupRunning(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.backup_run', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
        },
      });
      applyPayload(data);
      const backupUrl = data.backup_run_result?.backup_url;
      if (backupUrl) {
        window.open(backupUrl, '_top');
      }
      setSuccessMessage('Backup started — complete the download in the stock backup screen.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setBackupRunning(false);
    }
  }, [applyPayload, facilityId, fetchOptions, scope]);

  const completeBackup = useCallback(async (runId?: number | null) => {
    setBackupCompleting(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.backup_complete', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          run_id: runId ?? systemHealth?.backup_run_id ?? 0,
        },
      });
      applyPayload(data);
      setSuccessMessage('Backup marked complete.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not mark backup complete');
    } finally {
      setBackupCompleting(false);
    }
  }, [applyPayload, facilityId, fetchOptions, scope, systemHealth?.backup_run_id]);

  const markSetupItem = useCallback(async (checklistKey: string) => {
    setSetupMarkingKey(checklistKey);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.setup_progress', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          checklist_key: checklistKey,
        },
      });
      applyPayload(data);
      setSuccessMessage('Setup checklist updated.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not update setup checklist');
    } finally {
      setSetupMarkingKey(null);
    }
  }, [applyPayload, facilityId, fetchOptions, scope]);

  const markSetupComplete = useCallback(async () => {
    setSetupCompleting(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.setup_complete', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
        },
      });
      applyPayload(data);
      setSuccessMessage('Admin hub setup marked complete.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not mark setup complete');
    } finally {
      setSetupCompleting(false);
    }
  }, [applyPayload, facilityId, fetchOptions, scope]);

  const exportConfig = useCallback(async () => {
    setConfigExporting(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.config_export', {
        ...fetchOptions,
        params: {
          scope,
          facility_id: facilityId > 0 ? facilityId : clinicFacilityId,
        },
      });
      const snapshot = data.config_export_snapshot;
      if (!snapshot) {
        throw new Error('Export snapshot missing from server response');
      }
      const facilityPart = facilityId > 0 ? `facility-${facilityId}` : 'global';
      const filename = `new-clinic-m6-config-${facilityPart}-${localDateString()}.json`;
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      if (data.config_export) {
        setConfigExport(data.config_export);
      }
      setSuccessMessage('M6 config JSON downloaded.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Config export failed');
    } finally {
      setConfigExporting(false);
    }
  }, [clinicFacilityId, facilityId, fetchOptions, scope]);

  const previewConfigImport = useCallback(async (snapshot: Record<string, unknown>) => {
    setConfigImportPreviewing(true);
    setConfigImportPreview(null);
    setConfigImportSnapshot(snapshot);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.config_import', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId > 0 ? facilityId : clinicFacilityId,
          snapshot,
          dry_run: true,
        },
      });
      applyPayload(data);
      if (data.config_import_result) {
        setConfigImportPreview(data.config_import_result);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Config import preview failed');
      setConfigImportSnapshot(null);
    } finally {
      setConfigImportPreviewing(false);
    }
  }, [applyPayload, clinicFacilityId, facilityId, fetchOptions, scope]);

  const confirmConfigImport = useCallback(async () => {
    if (!configImportSnapshot) {
      return;
    }
    setConfigImporting(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.config_import', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId > 0 ? facilityId : clinicFacilityId,
          snapshot: configImportSnapshot,
          dry_run: false,
        },
      });
      applyPayload(data);
      setConfigImportPreview(null);
      setConfigImportSnapshot(null);
      const summary = data.config_import_result?.summary;
      setSuccessMessage(
        summary
          ? `M6 config imported (${summary.settings_imported ?? 0} settings, `
            + `${summary.fees_imported ?? 0} fees, ${summary.visit_types_imported ?? 0} visit types).`
          : 'M6 config imported.',
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Config import failed');
    } finally {
      setConfigImporting(false);
    }
  }, [applyPayload, clinicFacilityId, configImportSnapshot, facilityId, fetchOptions, scope]);

  const clearConfigImportPreview = useCallback(() => {
    setConfigImportPreview(null);
    setConfigImportSnapshot(null);
  }, []);

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

  const importGhanaLbfPack = useCallback(async (setAsConsultNote: boolean) => {
    setGhanaLbfImporting(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('clinical_doc.import_ghana_pack', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          set_as_consult_note: setAsConsultNote,
        },
      });
      applyPayload(data);
      setSuccessMessage(
        setAsConsultNote
          ? 'Ghana OPD LBF pack imported and set as primary consult note.'
          : 'Ghana OPD LBF pack imported.'
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Ghana OPD LBF import failed');
    } finally {
      setGhanaLbfImporting(false);
    }
  }, [applyPayload, facilityId, fetchOptions, scope]);

  const importAncillaryLbfPack = useCallback(async (packKey: string) => {
    setAncillaryLbfImporting(packKey);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('clinical_doc.import_ancillary_pack', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          pack_key: packKey,
        },
      });
      applyPayload(data);
      setSuccessMessage(`Ancillary LBF pack "${packKey}" imported.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Ancillary LBF import failed');
    } finally {
      setAncillaryLbfImporting(null);
    }
  }, [applyPayload, facilityId, fetchOptions, scope]);

  const installAllMissingAncillary = useCallback(async () => {
    if (!formBundleBoard) {
      return;
    }
    const packKeys = formBundleBoard.rows
      .filter((row) => row.can_import && row.pack_key)
      .map((row) => row.pack_key as string);
    if (packKeys.length === 0) {
      return;
    }
    setInstallingAllAncillary(true);
    setErrorMessage(null);
    try {
      let lastPayload: AdminConfigPayload | null = null;
      for (const packKey of packKeys) {
        setAncillaryLbfImporting(packKey);
        lastPayload = await oeFetch<AdminConfigPayload>('clinical_doc.import_ancillary_pack', {
          ...fetchOptions,
          json: {
            scope,
            facility_id: facilityId,
            pack_key: packKey,
          },
        });
      }
      if (lastPayload) {
        applyPayload(lastPayload);
      }
      setSuccessMessage('Missing ancillary LBF forms imported.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Ancillary LBF import failed');
    } finally {
      setAncillaryLbfImporting(null);
      setInstallingAllAncillary(false);
    }
  }, [applyPayload, facilityId, fetchOptions, formBundleBoard, scope]);

  const applyCatalogEnable = useCallback(async (item: FormsCatalogItem) => {
    setCatalogTogglingId(item.id);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.forms_catalog.set_state', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          registry_id: item.id,
          enabled: true,
        },
      });
      applyPayload(data);
      const warning = data.forms_catalog_result?.warning;
      setSuccessMessage(warning ?? `${item.name} enabled in form registry.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not update form registry');
    } finally {
      setCatalogTogglingId(null);
    }
  }, [applyPayload, facilityId, fetchOptions, scope]);

  const toggleCatalogForm = useCallback(async (item: FormsCatalogItem, enabled: boolean) => {
    if (item.enabled === enabled) {
      return;
    }
    if (!enabled && item.disable_blocked) {
      setErrorMessage(item.disable_block_reason ?? 'This form cannot be disabled.');
      return;
    }
    if (enabled && item.enable_warning) {
      setPendingConfirm({ type: 'catalog_enable', item });
      return;
    }
    if (enabled) {
      await applyCatalogEnable(item);
      return;
    }
    setCatalogTogglingId(item.id);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin.forms_catalog.set_state', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          registry_id: item.id,
          enabled: false,
        },
      });
      applyPayload(data);
      setSuccessMessage(`${item.name} disabled in form registry.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not update form registry');
    } finally {
      setCatalogTogglingId(null);
    }
  }, [applyPayload, applyCatalogEnable, facilityId, fetchOptions, scope]);

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
        {visibleTabs.map((tab) => (
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
              <QueueRolesTab
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                facilityId={facilityId}
                settings={settings}
                ghanaLbfPack={ghanaLbfPack}
                ghanaLbfImporting={ghanaLbfImporting}
                ancillaryLbfPacks={ancillaryLbfPacks}
                ancillaryLbfImporting={ancillaryLbfImporting}
                onFieldChange={handleFieldChange}
                onImportGhanaLbfPack={(setAsConsultNote) => { void importGhanaLbfPack(setAsConsultNote); }}
                onImportAncillaryLbfPack={(packKey) => { void importAncillaryLbfPack(packKey); }}
              />
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
              <CompletionTab
                settings={settings}
                completionFieldWeights={completionFieldWeights}
                weightsSaving={weightsSaving}
                weightsError={weightsError}
                onFieldChange={handleFieldChange}
                onSaveWeights={(items) => {
                  void saveCompletionWeights(items);
                }}
              />
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
            {activeTab === 'forms' && formBundleBoard && formsCatalog && (
              <FormsTab
                board={formBundleBoard}
                catalog={formsCatalog}
                ancillaryLbfPacks={ancillaryLbfPacks}
                importingPackKey={ancillaryLbfImporting}
                installingAll={installingAllAncillary}
                catalogTogglingId={catalogTogglingId}
                onImportPack={(packKey) => { void importAncillaryLbfPack(packKey); }}
                onInstallAllMissing={() => { void installAllMissingAncillary(); }}
                onToggleCatalogForm={(item, enabled) => { void toggleCatalogForm(item, enabled); }}
              />
            )}
            {activeTab === 'forms' && (!formBundleBoard || !formsCatalog) && (
              <div className="text-muted"><em>Forms configuration unavailable.</em></div>
            )}
            {activeTab === 'system' && systemHealth && runbooks && setupProgress && (
              <SystemTab
                health={systemHealth}
                runbooks={runbooks}
                setupProgress={setupProgress}
                configExport={configExport}
                scopeLabel={scopeLabel}
                configExporting={configExporting}
                onExportConfig={() => { void exportConfig(); }}
                configImportPreview={configImportPreview}
                configImportPreviewing={configImportPreviewing}
                configImporting={configImporting}
                onConfigImportPreview={(snapshot) => { void previewConfigImport(snapshot); }}
                onConfigImportConfirm={() => { void confirmConfigImport(); }}
                onConfigImportClearPreview={clearConfigImportPreview}
                reconciliationRunning={reconciliationRunning}
                backupRunning={backupRunning}
                backupCompleting={backupCompleting}
                setupMarkingKey={setupMarkingKey}
                setupCompleting={setupCompleting}
                onRunReconciliation={() => { void runReconciliation(); }}
                onRunBackup={() => { void runBackup(); }}
                onCompleteBackup={() => { void completeBackup(); }}
                onRefreshHealth={() => { void refreshSystemHealth(); }}
                healthRefreshing={healthRefreshing}
                onMarkSetupItem={(key) => { void markSetupItem(key); }}
                onMarkSetupComplete={() => { void markSetupComplete(); }}
              />
            )}
            {activeTab === 'system' && (!systemHealth || !runbooks || !setupProgress) && (
              <div className="text-muted"><em>System configuration unavailable.</em></div>
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
                  : pendingConfirm?.type === 'catalog_enable' ? 'Enable billing form?'
                    : 'Apply cash clinic profile?'
        }
        modalId="nc-admin-confirm-modal"
        cancelLabel="Cancel"
        confirmLabel={
          pendingConfirm?.type === 'scope_switch' ? 'Switch'
            : pendingConfirm?.type === 'grant_roles' ? 'Grant roles'
              : pendingConfirm?.type === 'cash_profile' ? 'Apply profile'
                : pendingConfirm?.type === 'catalog_enable' ? 'Enable anyway'
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
          } else if (pendingConfirm.type === 'catalog_enable') {
            void applyCatalogEnable(pendingConfirm.item);
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
        {pendingConfirm?.type === 'catalog_enable' && (
          <p className="mb-0">{pendingConfirm.item.enable_warning}</p>
        )}
      </ConfirmModal>
    </div>
  );
}
