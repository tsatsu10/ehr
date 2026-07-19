import type {
  RunbooksPayload,
  SystemHealthPayload,
} from '../adminTypes';
import { RunbooksBoard } from '../RunbooksBoard';
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
  onRunReconciliation: () => void;
  onRunBackup: () => void;
  onCompleteBackup: () => void;
  onRefreshHealth: () => void;
  healthRefreshing: boolean;
}

export function SystemTab({
  ajaxUrl,
  csrfToken,
  health,
  runbooks,
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
