import type {
  AdminTabId,
  RunbooksPayload,
  SetupProgressPayload,
  SystemHealthPayload,
} from '../adminTypes';
import { RunbooksBoard } from '../RunbooksBoard';
import { SetupChecklistCard } from '../SetupChecklistCard';
import { SystemHealthBoard } from '../SystemHealthBoard';
import { ConfigExportCard } from '../ConfigExportCard';
import { ConfigImportCard } from '../ConfigImportCard';
import type { ConfigExportMeta, ConfigImportResult } from '../adminTypes';
import { AdminStack } from '../adminUi';
import { AuditLogCard } from '../AuditLogCard';
import { DuplicatesCard } from '../DuplicatesCard';
import { PerfPanelCard } from '../PerfPanelCard';

interface SystemTabProps {
  ajaxUrl: string;
  csrfToken: string;
  health: SystemHealthPayload;
  runbooks: RunbooksPayload;
  setupProgress: SetupProgressPayload;
  configExport: ConfigExportMeta | null;
  scopeLabel: string;
  configExporting: boolean;
  onExportConfig: () => void;
  configImportPreview: ConfigImportResult | null;
  configImportPreviewing: boolean;
  configImporting: boolean;
  onConfigImportPreview: (snapshot: Record<string, unknown>) => void;
  onConfigImportConfirm: () => void;
  onConfigImportClearPreview: () => void;
  reconciliationRunning: boolean;
  backupRunning: boolean;
  backupCompleting: boolean;
  setupMarkingKey: string | null;
  setupCompleting: boolean;
  setupReopening: boolean;
  onRunReconciliation: () => void;
  onRunBackup: () => void;
  onCompleteBackup: () => void;
  onRefreshHealth: () => void;
  healthRefreshing: boolean;
  onMarkSetupItem: (key: string) => void;
  onUnmarkSetupItem: (key: string) => void;
  onMarkSetupComplete: () => void;
  onReopenSetup: () => void;
  onNavigateTab: (tab: AdminTabId) => void;
}

export function SystemTab({
  ajaxUrl,
  csrfToken,
  health,
  runbooks,
  setupProgress,
  configExport,
  scopeLabel,
  configExporting,
  onExportConfig,
  configImportPreview,
  configImportPreviewing,
  configImporting,
  onConfigImportPreview,
  onConfigImportConfirm,
  onConfigImportClearPreview,
  setupMarkingKey,
  setupCompleting,
  setupReopening,
  onMarkSetupItem,
  onUnmarkSetupItem,
  onMarkSetupComplete,
  onReopenSetup,
  onNavigateTab,
  onRunReconciliation,
  onRunBackup,
  onCompleteBackup,
  onRefreshHealth,
  healthRefreshing,
  reconciliationRunning,
  backupRunning,
  backupCompleting,
}: SystemTabProps) {
  return (
    <AdminStack>
      {/* Always rendered — after completion the card shows its success state
          with any residual items + Reopen (the old outer hide made the card's
          success branch dead code). */}
      <SetupChecklistCard
        progress={setupProgress}
        markingKey={setupMarkingKey}
        completing={setupCompleting}
        reopening={setupReopening}
        scopeLabel={scopeLabel}
        onMarkItem={onMarkSetupItem}
        onUnmarkItem={onUnmarkSetupItem}
        onMarkComplete={onMarkSetupComplete}
        onReopen={onReopenSetup}
        onNavigateTab={onNavigateTab}
      />
      <SystemHealthBoard
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        health={health}
        reconciliationRunning={reconciliationRunning}
        backupRunning={backupRunning}
        backupCompleting={backupCompleting}
        onRunReconciliation={onRunReconciliation}
        onRunBackup={onRunBackup}
        onCompleteBackup={onCompleteBackup}
        onRefresh={onRefreshHealth}
        refreshing={healthRefreshing}
      />
      <RunbooksBoard runbooks={runbooks} />
      {configExport && (
        <>
          <ConfigExportCard
            meta={configExport}
            scopeLabel={scopeLabel}
            exporting={configExporting}
            onExport={onExportConfig}
          />
          <ConfigImportCard
            meta={configExport}
            scopeLabel={scopeLabel}
            preview={configImportPreview}
            previewing={configImportPreviewing}
            importing={configImporting}
            onChooseFile={onConfigImportPreview}
            onConfirmImport={onConfigImportConfirm}
            onClearPreview={onConfigImportClearPreview}
          />
        </>
      )}
      <DuplicatesCard ajaxUrl={ajaxUrl} csrfToken={csrfToken} enabled={health.duplicate_review_enabled ?? false} />
      <PerfPanelCard ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
      <AuditLogCard ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
    </AdminStack>
  );
}
