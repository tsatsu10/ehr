import { useCallback, useEffect, useMemo, useState } from 'react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { oeFetch } from '@core/oeFetch';
import { SegmentedControl } from '@components/SegmentedControl';
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
  ReferralHospitalLbfPackStatus,
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
  DirectoryContactRow,
  DirectoryContactType,
  FacilityRow,
  FeeCategoryOption,
  FeeImportSummary,
  FeeScheduleRow,
  FeeTemplate,
  ReconciliationRun,
  VisitTypeRow,
} from './adminTypes';
import { ADMIN_TABS } from './adminTypes';
import { initialAdminTab, localDateString } from './adminUtils';
import { DirectoryModal } from './modals/DirectoryModal';
import { FacilityModal } from './modals/FacilityModal';
import { FeeModal } from './modals/FeeModal';
import { BulkPriceModal } from './modals/BulkPriceModal';
import { VisitTypeModal } from './modals/VisitTypeModal';
import { AdminHubConfirmModal } from './AdminHubConfirmModal';
import { AdminHubTabPanels } from './AdminHubTabPanels';
import type { AdminConfirm } from './adminHubConfirm';
import { useAdminPageHeading } from './useAdminPageHeading';
import {
  AdminLoadingState,
  AdminMetricChip,
  AdminScopeBar,
  AdminShell,
  AdminStickyTabs,
} from './adminUi';

function isAdminTabId(value: string): value is AdminTabId {
  return ADMIN_TABS.some((tab) => tab.id === value);
}

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
  const [directoryContacts, setDirectoryContacts] = useState<DirectoryContactRow[]>([]);
  const [directoryTypes, setDirectoryTypes] = useState<DirectoryContactType[]>([]);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
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
  const [referralHospitalLbfPack, setReferralHospitalLbfPack] = useState<ReferralHospitalLbfPackStatus>({ installed: false });
  const [referralHospitalLbfImporting, setReferralHospitalLbfImporting] = useState(false);
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

  const [directoryModalOpen, setDirectoryModalOpen] = useState(false);
  const [directoryEdit, setDirectoryEdit] = useState<DirectoryContactRow | null>(null);
  const [directorySaving, setDirectorySaving] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const [facilityModalOpen, setFacilityModalOpen] = useState(false);
  const [facilityEdit, setFacilityEdit] = useState<FacilityRow | null>(null);
  const [facilitySaving, setFacilitySaving] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);

  const [feeCsv, setFeeCsv] = useState('');
  const [feeImporting, setFeeImporting] = useState(false);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [grantingRoles, setGrantingRoles] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<AdminConfirm | null>(null);

  const fetchOptions = useMemo(
    () => ({ ajaxUrl, csrfToken }),
    [ajaxUrl, csrfToken]
  );

  const adminHubEnabled = settings.enable_admin_hub === true;
  const patientImportEnabled = settings.enable_patient_import === true;
  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => {
      if (tab.id === 'system' || tab.id === 'forms') {
        return adminHubEnabled;
      }
      if (tab.id === 'import') {
        return patientImportEnabled;
      }
      return true;
    }),
    [adminHubEnabled, patientImportEnabled]
  );

  useEffect(() => {
    if (!adminHubEnabled && (activeTab === 'system' || activeTab === 'forms')) {
      setActiveTab('queue');
    }
    if (!patientImportEnabled && activeTab === 'import') {
      setActiveTab('queue');
    }
  }, [adminHubEnabled, patientImportEnabled, activeTab]);

  const clinicName = clinicFacilityLabel || 'your clinic';
  const scopeHint = scope === 'global'
    ? `Applies as the default when a clinic has no override. Existing per-clinic rows still win until you save under ${clinicName}.`
    : `Editing ${scopeLabel || clinicFacilityLabel} (ID ${facilityId}). These values override the global default for this clinic.`;

  const statusText = scopeLabel || `Facility ${facilityId}`;

  const applyPayload = useCallback((data: AdminConfigPayload) => {
    setFacilityId(data.facility_id ?? 0);
    setScope(data.scope === 'global' ? 'global' : 'facility');
    setScopeLabel(data.scope_label ?? '');
    setClinicFacilityLabel(data.clinic_facility_label ?? `Facility ${clinicFacilityId}`);
    setSettings(data.settings ?? {});
    setVisitTypes(data.visit_types ?? []);
    setDirectoryContacts(data.directory_contacts ?? []);
    setDirectoryTypes(data.directory_types ?? []);
    setFacilities(data.facilities ?? []);
    setFeeSchedule(data.fee_schedule ?? []);
    setFeeCategories(data.categories ?? []);
    setFeeTemplates(data.templates ?? []);
    setBillingCodeTypes(data.billing_code_types ?? []);
    setDefaultCodeType(data.default_code_type ?? 'CPT4');
    setRoleGroups(data.roles ?? {});
    setCashProfile(data.cash_profile ?? { applied: false });
    setGhanaLbfPack(data.ghana_lbf_pack ?? { installed: false });
    setReferralHospitalLbfPack(data.referral_hospital_lbf_pack ?? { installed: false });
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
      if (tab !== 'people') {
        url.searchParams.delete('sub');
      }
    } else {
      url.searchParams.delete('tab');
      url.searchParams.delete('sub');
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
      setVisitTypeModalOpen(false);
      setSuccessMessage('Visit type saved.');
      setErrorMessage(null);
    } catch (err) {
      setVisitTypeError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setVisitTypeSaving(false);
    }
  }, [facilityId, fetchOptions]);

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

  const openDirectoryModal = useCallback((row: DirectoryContactRow | null) => {
    setDirectoryEdit(row);
    setDirectoryError(null);
    setDirectoryModalOpen(true);
  }, []);

  const saveDirectoryContact = useCallback(async (payload: {
    id: number;
    abook_type: string;
    organization: string;
    title: string;
    fname: string;
    lname: string;
    phone: string;
    fax: string;
    email: string;
    notes: string;
  }) => {
    setDirectorySaving(true);
    setDirectoryError(null);
    try {
      const data = await oeFetch<{ directory_contacts: DirectoryContactRow[] }>('admin.directory.save', {
        ...fetchOptions,
        json: { contact: payload },
      });
      setDirectoryContacts(data.directory_contacts ?? []);
      setDirectoryModalOpen(false);
      setSuccessMessage('Contact saved.');
      setErrorMessage(null);
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setDirectorySaving(false);
    }
  }, [fetchOptions]);

  const deleteDirectoryContact = useCallback(async (row: DirectoryContactRow) => {
    try {
      const data = await oeFetch<{ directory_contacts: DirectoryContactRow[] }>('admin.directory.delete', {
        ...fetchOptions,
        json: { id: row.id },
      });
      setDirectoryContacts(data.directory_contacts ?? []);
      setSuccessMessage('Contact deleted.');
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [fetchOptions]);

  const openFacilityModal = useCallback((row: FacilityRow | null) => {
    setFacilityEdit(row);
    setFacilityError(null);
    setFacilityModalOpen(true);
  }, []);

  const saveFacility = useCallback(async (payload: {
    id: number;
    name: string;
    phone: string;
    email: string;
    website: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country_code: string;
    color: string;
    service_location: boolean;
    billing_location: boolean;
    inactive: boolean;
  }) => {
    setFacilitySaving(true);
    setFacilityError(null);
    try {
      const data = await oeFetch<{
        facilities: FacilityRow[];
        scope_label?: string;
        clinic_facility_label?: string;
      }>('admin.facility.save', {
        ...fetchOptions,
        json: { facility: payload, scope, facility_id: facilityId },
      });
      setFacilities(data.facilities ?? []);
      // Renaming the clinic facility changes the name shown in the scope bar —
      // refresh those labels in place without reloading the whole settings form.
      if (data.scope_label !== undefined) {
        setScopeLabel(data.scope_label);
      }
      if (data.clinic_facility_label !== undefined) {
        setClinicFacilityLabel(data.clinic_facility_label);
      }
      setFacilityModalOpen(false);
      setSuccessMessage('Facility saved.');
      setErrorMessage(null);
    } catch (err) {
      setFacilityError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setFacilitySaving(false);
    }
  }, [facilityId, fetchOptions, scope]);

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

  const systemHealthBackupRunId = systemHealth?.backup_run_id;
  const completeBackup = useCallback(async (runId?: number | null) => {
    setBackupCompleting(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('admin_hub.backup_complete', {
        ...fetchOptions,
        json: {
          scope,
          facility_id: facilityId,
          run_id: runId ?? systemHealthBackupRunId ?? 0,
        },
      });
      applyPayload(data);
      setSuccessMessage('Backup marked complete.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not mark backup complete');
    } finally {
      setBackupCompleting(false);
    }
  }, [applyPayload, facilityId, fetchOptions, scope, systemHealthBackupRunId]);

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

  const importReferralHospitalLbfPack = useCallback(async (setAsConsultNote: boolean) => {
    setReferralHospitalLbfImporting(true);
    setErrorMessage(null);
    try {
      const data = await oeFetch<AdminConfigPayload>('clinical_doc.import_referral_hospital_pack', {
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
          ? 'Referral hospital LBF pack imported and set as primary consult note.'
          : 'Referral hospital LBF pack imported.'
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Referral hospital LBF import failed');
    } finally {
      setReferralHospitalLbfImporting(false);
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

  const healthTone = systemHealth?.overall_status === 'ok'
    ? 'success'
    : systemHealth?.overall_status === 'warning'
      ? 'warning'
      : systemHealth?.overall_status === 'critical'
        ? 'danger'
        : 'default';

  return (
    <AdminShell id="nc-admin-desk">
      {successMessage && (
        <div className={deskCalloutClass('success')} id="nc-admin-success">{successMessage}</div>
      )}
      {errorMessage && (
        <div className={deskCalloutClass('error')} id="nc-admin-error">{errorMessage}</div>
      )}
      {loadError && !errorMessage && (
        <div className={deskCalloutClass('error')}>{loadError}</div>
      )}

      <AdminScopeBar
        scopeControl={
          <>
            <Label className="mb-0 mr-1 normal-case" htmlFor="nc-admin-scope">Settings for:</Label>
            <Select
              value={scope}
              onValueChange={(val) => handleScopeChange(val === 'global' ? 'global' : 'facility')}
            >
              <SelectTrigger id="nc-admin-scope" className="h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facility">{clinicFacilityLabel || 'This clinic'}</SelectItem>
                <SelectItem value="global">All facilities (global default)</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        hint={scopeHint}
        metrics={
          adminHubEnabled ? (
            <>
              {setupProgress && (
                <AdminMetricChip
                  label="Setup"
                  value={`${setupProgress.score_percent}%`}
                  tone={setupProgress.setup_complete ? 'success' : 'default'}
                />
              )}
              {systemHealth && (
                <AdminMetricChip
                  label="System"
                  value={systemHealth.overall_status === 'ok' ? 'Healthy' : systemHealth.overall_status ?? 'Unknown'}
                  tone={healthTone}
                />
              )}
            </>
          ) : undefined
        }
      />

      <AdminStickyTabs>
        <SegmentedControl
          segments={visibleTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
          value={activeTab}
          onChange={(id) => handleTabChange(id as AdminTabId)}
          ariaLabel="Admin configuration sections"
        />
      </AdminStickyTabs>

      {loading ? (
        <AdminLoadingState />
      ) : (
        <>
          <AdminHubTabPanels
            activeTab={activeTab}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            webroot={webroot}
            facilityId={facilityId}
            clinicFacilityId={clinicFacilityId}
            settings={settings}
            ghanaLbfPack={ghanaLbfPack}
            ghanaLbfImporting={ghanaLbfImporting}
            referralHospitalLbfPack={referralHospitalLbfPack}
            referralHospitalLbfImporting={referralHospitalLbfImporting}
            ancillaryLbfPacks={ancillaryLbfPacks}
            ancillaryLbfImporting={ancillaryLbfImporting}
            roleGroups={roles}
            grantingRoles={grantingRoles}
            completionFieldWeights={completionFieldWeights}
            weightsSaving={weightsSaving}
            weightsError={weightsError}
            cashProfile={cashProfile}
            cashProfileApplying={cashProfileApplying}
            reconciliationStatus={reconciliationStatus}
            reconciliationRunning={reconciliationRunning}
            formBundleBoard={formBundleBoard}
            formsCatalog={formsCatalog}
            installingAllAncillary={installingAllAncillary}
            catalogTogglingId={catalogTogglingId}
            systemHealth={systemHealth}
            runbooks={runbooks}
            setupProgress={setupProgress}
            configExport={configExport}
            scopeLabel={scopeLabel}
            configExporting={configExporting}
            configImportPreview={configImportPreview}
            configImportPreviewing={configImportPreviewing}
            configImporting={configImporting}
            backupRunning={backupRunning}
            backupCompleting={backupCompleting}
            setupMarkingKey={setupMarkingKey}
            setupCompleting={setupCompleting}
            healthRefreshing={healthRefreshing}
            visitTypes={visitTypes}
            directoryContacts={directoryContacts}
            directoryTypes={directoryTypes}
            facilities={facilities}
            feeSchedule={feeSchedule}
            feeCsv={feeCsv}
            feeImporting={feeImporting}
            onFieldChange={handleFieldChange}
            onImportGhanaLbfPack={(setAsConsultNote) => { void importGhanaLbfPack(setAsConsultNote); }}
            onImportReferralHospitalLbfPack={(setAsConsultNote) => { void importReferralHospitalLbfPack(setAsConsultNote); }}
            onImportAncillaryLbfPack={(packKey) => { void importAncillaryLbfPack(packKey); }}
            onGrantSelf={() => setPendingConfirm({ type: 'grant_roles' })}
            onGoQueueTab={() => handleTabChange('queue')}
            onSaveWeights={(items) => { void saveCompletionWeights(items); }}
            onApplyCashProfile={() => setPendingConfirm({ type: 'cash_profile' })}
            onRunReconciliation={() => { void runReconciliation(); }}
            onInstallAllMissing={() => { void installAllMissingAncillary(); }}
            onToggleCatalogForm={(item, enabled) => { void toggleCatalogForm(item, enabled); }}
            onExportConfig={() => { void exportConfig(); }}
            onConfigImportPreview={(snapshot) => { void previewConfigImport(snapshot); }}
            onConfigImportConfirm={() => { void confirmConfigImport(); }}
            onConfigImportClearPreview={clearConfigImportPreview}
            onRunBackup={() => { void runBackup(); }}
            onCompleteBackup={() => { void completeBackup(); }}
            onRefreshHealth={() => { void refreshSystemHealth(); }}
            onMarkSetupItem={(key) => { void markSetupItem(key); }}
            onMarkSetupComplete={() => { void markSetupComplete(); }}
            onAddVisitType={() => openVisitTypeModal(null)}
            onEditVisitType={(row) => openVisitTypeModal(row)}
            onArchiveVisitType={(row) => setPendingConfirm({ type: 'archive_visit_type', row })}
            onFeeCsvChange={setFeeCsv}
            onAddFee={() => { void openFeeModal(null); }}
            onEditFee={(row) => { void openFeeModal(row); }}
            onArchiveFee={(row) => setPendingConfirm({ type: 'archive_fee', row })}
            onImportFees={() => { void importFees(); }}
            onBulkPriceFees={() => setBulkPriceOpen(true)}
            onAddDirectoryContact={() => openDirectoryModal(null)}
            onEditDirectoryContact={(row) => openDirectoryModal(row)}
            onDeleteDirectoryContact={(row) => setPendingConfirm({ type: 'delete_directory_contact', row })}
            onEditFacility={(row) => openFacilityModal(row)}
          />
        </>
      )}

      <VisitTypeModal
        open={visitTypeModalOpen}
        row={visitTypeEdit}
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

      <BulkPriceModal
        open={bulkPriceOpen}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        facilityId={facilityId}
        categories={feeCategories}
        settings={settings}
        onClose={() => setBulkPriceOpen(false)}
        onApplied={(changed) => {
          setSuccessMessage(`Updated ${changed} fee price${changed === 1 ? '' : 's'}.`);
          setErrorMessage(null);
        }}
        // Payload's fee_schedule is untyped at the modal boundary; the service
        // returns the same FeeScheduleRow[] shape the rest of the tab uses.
        onRefreshSchedule={(fs) => setFeeSchedule((fs as FeeScheduleRow[]) ?? [])}
      />

      <AdminHubConfirmModal
        pendingConfirm={pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={(confirm) => {
          if (confirm.type === 'scope_switch') {
            setScope(confirm.nextScope);
            setDirty(false);
            setSuccessMessage(null);
            setErrorMessage(null);
          } else if (confirm.type === 'archive_visit_type') {
            void archiveVisitType(confirm.row);
          } else if (confirm.type === 'archive_fee') {
            void archiveFee(confirm.row);
          } else if (confirm.type === 'grant_roles') {
            void grantSelfRoles();
          } else if (confirm.type === 'cash_profile') {
            void applyCashProfile();
          } else if (confirm.type === 'catalog_enable') {
            void applyCatalogEnable(confirm.item);
          } else if (confirm.type === 'delete_directory_contact') {
            void deleteDirectoryContact(confirm.row);
          }
          setPendingConfirm(null);
        }}
      />

      <DirectoryModal
        open={directoryModalOpen}
        row={directoryEdit}
        types={directoryTypes}
        saving={directorySaving}
        error={directoryError}
        onClose={() => setDirectoryModalOpen(false)}
        onSave={(payload) => { void saveDirectoryContact(payload); }}
      />

      <FacilityModal
        open={facilityModalOpen}
        row={facilityEdit}
        saving={facilitySaving}
        error={facilityError}
        onClose={() => setFacilityModalOpen(false)}
        onSave={(payload) => { void saveFacility(payload); }}
      />
    </AdminShell>
  );
}
