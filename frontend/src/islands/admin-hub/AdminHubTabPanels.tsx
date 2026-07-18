import type {
  AdminTabId,
  AncillaryLbfPackStatus,
  CashProfileStatus,
  CompletionFieldWeightPayload,
  CompletionFieldWeightRow,
  ConfigExportMeta,
  ConfigImportResult,
  DirectoryContactRow,
  DirectoryContactType,
  FacilityRow,
  FormBundleBoardPayload,
  FormsCatalogItem,
  FormsCatalogPayload,
  GhanaLbfPackStatus,
  ReferralHospitalLbfPackStatus,
  RunbooksPayload,
  SetupProgressPayload,
  SystemHealthPayload,
  FeeScheduleRow,
  VisitTypeRow,
} from './adminTypes';
import { AdminEmptyState, AdminTabPanel } from './adminUi';
import { ClinicTab } from './tabs/ClinicTab';
import { CompletionTab } from './tabs/CompletionTab';
import { DirectoryTab } from './tabs/DirectoryTab';
import { FeesTab } from './tabs/FeesTab';
import { FormsTab } from './tabs/FormsTab';
import { PatientImportPanel } from './patientImport/PatientImportPanel';
import { PeopleAccessTab } from './tabs/PeopleAccessTab';
import { QueueRolesTab } from './tabs/QueueRolesTab';
import { SystemTab } from './tabs/SystemTab';
import { VisitTypesTab } from './tabs/VisitTypesTab';

export interface AdminHubTabPanelsProps {
  activeTab: AdminTabId;
  ajaxUrl: string;
  csrfToken: string;
  webroot: string;
  facilityId: number;
  clinicFacilityId: number;
  settings: Record<string, unknown>;
  ghanaLbfPack: GhanaLbfPackStatus;
  ghanaLbfImporting: boolean;
  referralHospitalLbfPack: ReferralHospitalLbfPackStatus;
  referralHospitalLbfImporting: boolean;
  ancillaryLbfPacks: AncillaryLbfPackStatus[];
  ancillaryLbfImporting: string | null;
  roleGroups: NonNullable<import('./adminTypes').AdminConfigPayload['roles']>;
  grantingRoles: boolean;
  completionFieldWeights: CompletionFieldWeightPayload | null;
  weightsSaving: boolean;
  weightsError: string | null;
  cashProfile: CashProfileStatus;
  cashProfileApplying: boolean;
  reconciliationStatus: string;
  reconciliationRunning: boolean;
  formBundleBoard: FormBundleBoardPayload | null;
  formsCatalog: FormsCatalogPayload | null;
  installingAllAncillary: boolean;
  catalogTogglingId: number | null;
  systemHealth: SystemHealthPayload | null;
  runbooks: RunbooksPayload | null;
  setupProgress: SetupProgressPayload | null;
  configExport: ConfigExportMeta | null;
  scopeLabel: string;
  configExporting: boolean;
  configImportPreview: ConfigImportResult | null;
  configImportPreviewing: boolean;
  configImporting: boolean;
  backupRunning: boolean;
  backupCompleting: boolean;
  setupMarkingKey: string | null;
  setupCompleting: boolean;
  setupReopening: boolean;
  healthRefreshing: boolean;
  visitTypes: VisitTypeRow[];
  feeSchedule: FeeScheduleRow[];
  feeCsv: string;
  feeImporting: boolean;
  directoryContacts: DirectoryContactRow[];
  directoryTypes: DirectoryContactType[];
  facilities: FacilityRow[];
  onFieldChange: (key: string, value: unknown) => void;
  onImportGhanaLbfPack: (setAsConsultNote: boolean) => void;
  onImportReferralHospitalLbfPack: (setAsConsultNote: boolean) => void;
  onImportAncillaryLbfPack: (packKey: string) => void;
  onGrantSelf: () => void;
  onGoQueueTab: () => void;
  onSaveWeights: (items: CompletionFieldWeightRow[]) => void;
  onApplyCashProfile: () => void;
  onRunReconciliation: () => void;
  onInstallAllMissing: () => void;
  onToggleCatalogForm: (item: FormsCatalogItem, enabled: boolean) => void;
  onExportConfig: () => void;
  onConfigImportPreview: (snapshot: Record<string, unknown>) => void;
  onConfigImportConfirm: () => void;
  onConfigImportClearPreview: () => void;
  onRunBackup: () => void;
  onCompleteBackup: () => void;
  onRefreshHealth: () => void;
  onMarkSetupItem: (key: string) => void;
  onUnmarkSetupItem: (key: string) => void;
  onMarkSetupComplete: () => void;
  onReopenSetup: () => void;
  onNavigateTab: (tab: AdminTabId) => void;
  onAddVisitType: () => void;
  onEditVisitType: (row: VisitTypeRow) => void;
  onArchiveVisitType: (row: VisitTypeRow) => void;
  onFeeCsvChange: (csv: string) => void;
  onAddFee: () => void;
  onEditFee: (row: FeeScheduleRow) => void;
  onArchiveFee: (row: FeeScheduleRow) => void;
  onBulkPriceFees: () => void;
  onImportFees: () => void;
  onAddDirectoryContact: () => void;
  onEditDirectoryContact: (row: DirectoryContactRow) => void;
  onDeleteDirectoryContact: (row: DirectoryContactRow) => void;
  onEditFacility: (row: FacilityRow) => void;
}

export function AdminHubTabPanels({
  activeTab,
  ajaxUrl,
  csrfToken,
  webroot,
  facilityId,
  clinicFacilityId,
  settings,
  ghanaLbfPack,
  ghanaLbfImporting,
  referralHospitalLbfPack,
  referralHospitalLbfImporting,
  ancillaryLbfPacks,
  ancillaryLbfImporting,
  roleGroups,
  grantingRoles,
  completionFieldWeights,
  weightsSaving,
  weightsError,
  cashProfile,
  cashProfileApplying,
  reconciliationStatus,
  reconciliationRunning,
  formBundleBoard,
  formsCatalog,
  installingAllAncillary,
  catalogTogglingId,
  systemHealth,
  runbooks,
  setupProgress,
  configExport,
  scopeLabel,
  configExporting,
  configImportPreview,
  configImportPreviewing,
  configImporting,
  backupRunning,
  backupCompleting,
  setupMarkingKey,
  setupCompleting,
  setupReopening,
  healthRefreshing,
  visitTypes,
  feeSchedule,
  feeCsv,
  feeImporting,
  directoryContacts,
  directoryTypes,
  facilities,
  onFieldChange,
  onImportGhanaLbfPack,
  onImportReferralHospitalLbfPack,
  onImportAncillaryLbfPack,
  onGrantSelf,
  onGoQueueTab,
  onSaveWeights,
  onApplyCashProfile,
  onRunReconciliation,
  onInstallAllMissing,
  onToggleCatalogForm,
  onExportConfig,
  onConfigImportPreview,
  onConfigImportConfirm,
  onConfigImportClearPreview,
  onRunBackup,
  onCompleteBackup,
  onRefreshHealth,
  onMarkSetupItem,
  onUnmarkSetupItem,
  onMarkSetupComplete,
  onReopenSetup,
  onNavigateTab,
  onAddVisitType,
  onEditVisitType,
  onArchiveVisitType,
  onFeeCsvChange,
  onAddFee,
  onEditFee,
  onArchiveFee,
  onBulkPriceFees,
  onImportFees,
  onAddDirectoryContact,
  onEditDirectoryContact,
  onDeleteDirectoryContact,
  onEditFacility,
}: AdminHubTabPanelsProps) {
  const roles = roleGroups ?? {};

  return (
    <>
      <AdminTabPanel tabId="queue" active={activeTab === 'queue'}>
        <QueueRolesTab
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId}
          settings={settings}
          ghanaLbfPack={ghanaLbfPack}
          ghanaLbfImporting={ghanaLbfImporting}
          referralHospitalLbfPack={referralHospitalLbfPack}
          referralHospitalLbfImporting={referralHospitalLbfImporting}
          ancillaryLbfPacks={ancillaryLbfPacks}
          ancillaryLbfImporting={ancillaryLbfImporting}
          onFieldChange={onFieldChange}
          onImportGhanaLbfPack={onImportGhanaLbfPack}
          onImportReferralHospitalLbfPack={onImportReferralHospitalLbfPack}
          onImportAncillaryLbfPack={onImportAncillaryLbfPack}
        />
      </AdminTabPanel>

      <AdminTabPanel tabId="people" active={activeTab === 'people'}>
        <PeopleAccessTab
          webroot={webroot}
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
          facilityId={facilityId > 0 ? facilityId : clinicFacilityId}
          roleGroups={roles.role_groups ?? []}
          sensitivePermissions={roles.sensitive_permissions ?? []}
          aclInventory={roles.acl_inventory ?? []}
          onGrantSelf={onGrantSelf}
          granting={grantingRoles}
          onGoQueueTab={onGoQueueTab}
        />
      </AdminTabPanel>

      <AdminTabPanel tabId="completion" active={activeTab === 'completion'}>
        <CompletionTab
          settings={settings}
          completionFieldWeights={completionFieldWeights}
          weightsSaving={weightsSaving}
          weightsError={weightsError}
          onFieldChange={onFieldChange}
          onSaveWeights={onSaveWeights}
        />
      </AdminTabPanel>

      <AdminTabPanel tabId="clinic" active={activeTab === 'clinic'}>
        <ClinicTab
          settings={settings}
          cashProfile={cashProfile}
          cashProfileApplying={cashProfileApplying}
          reconciliationStatus={reconciliationStatus}
          reconciliationRunning={reconciliationRunning}
          facilities={facilities}
          currentFacilityId={facilityId > 0 ? facilityId : clinicFacilityId}
          onFieldChange={onFieldChange}
          onApplyCashProfile={onApplyCashProfile}
          onRunReconciliation={onRunReconciliation}
          onEditFacility={onEditFacility}
        />
      </AdminTabPanel>

      <AdminTabPanel tabId="forms" active={activeTab === 'forms'}>
        {formBundleBoard && formsCatalog ? (
          <FormsTab
            board={formBundleBoard}
            catalog={formsCatalog}
            ancillaryLbfPacks={ancillaryLbfPacks}
            importingPackKey={ancillaryLbfImporting}
            installingAll={installingAllAncillary}
            catalogTogglingId={catalogTogglingId}
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            onImportPack={onImportAncillaryLbfPack}
            onInstallAllMissing={onInstallAllMissing}
            onToggleCatalogForm={onToggleCatalogForm}
          />
        ) : (
          <AdminEmptyState
            title="Forms configuration unavailable"
            description="Enable the Admin Operations Hub or reload settings to manage form bundles."
          />
        )}
      </AdminTabPanel>

      <AdminTabPanel tabId="system" active={activeTab === 'system'}>
        {systemHealth && runbooks && setupProgress ? (
          <SystemTab
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            health={systemHealth}
            runbooks={runbooks}
            setupProgress={setupProgress}
            configExport={configExport}
            scopeLabel={scopeLabel}
            configExporting={configExporting}
            onExportConfig={onExportConfig}
            configImportPreview={configImportPreview}
            configImportPreviewing={configImportPreviewing}
            configImporting={configImporting}
            onConfigImportPreview={onConfigImportPreview}
            onConfigImportConfirm={onConfigImportConfirm}
            onConfigImportClearPreview={onConfigImportClearPreview}
            reconciliationRunning={reconciliationRunning}
            backupRunning={backupRunning}
            backupCompleting={backupCompleting}
            setupMarkingKey={setupMarkingKey}
            setupCompleting={setupCompleting}
            setupReopening={setupReopening}
            onRunReconciliation={onRunReconciliation}
            onRunBackup={onRunBackup}
            onCompleteBackup={onCompleteBackup}
            onRefreshHealth={onRefreshHealth}
            healthRefreshing={healthRefreshing}
            onMarkSetupItem={onMarkSetupItem}
            onUnmarkSetupItem={onUnmarkSetupItem}
            onMarkSetupComplete={onMarkSetupComplete}
            onReopenSetup={onReopenSetup}
            onNavigateTab={onNavigateTab}
          />
        ) : (
          <AdminEmptyState
            title="System configuration unavailable"
            description="Reload the page or confirm Admin Operations Hub is enabled for this clinic."
          />
        )}
      </AdminTabPanel>

      <AdminTabPanel tabId="types" active={activeTab === 'types'}>
        <VisitTypesTab
          visitTypes={visitTypes}
          onAdd={onAddVisitType}
          onEdit={onEditVisitType}
          onArchive={onArchiveVisitType}
        />
      </AdminTabPanel>

      <AdminTabPanel tabId="fees" active={activeTab === 'fees'}>
        <FeesTab
          feeSchedule={feeSchedule}
          settings={settings}
          webroot={webroot}
          csv={feeCsv}
          importing={feeImporting}
          onCsvChange={onFeeCsvChange}
          onAdd={onAddFee}
          onEdit={onEditFee}
          onArchive={onArchiveFee}
          onImport={onImportFees}
          onBulkPrice={onBulkPriceFees}
        />
      </AdminTabPanel>

      <AdminTabPanel tabId="directory" active={activeTab === 'directory'}>
        <DirectoryTab
          contacts={directoryContacts}
          types={directoryTypes}
          onAdd={onAddDirectoryContact}
          onEdit={onEditDirectoryContact}
          onDelete={onDeleteDirectoryContact}
        />
      </AdminTabPanel>

      <AdminTabPanel tabId="import" active={activeTab === 'import'}>
        <PatientImportPanel
          ajaxUrl={ajaxUrl}
          csrfToken={csrfToken}
        />
      </AdminTabPanel>
    </>
  );
}
