import type {
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

interface SystemTabProps {
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
  onRunReconciliation: () => void;
  onRunBackup: () => void;
  onCompleteBackup: () => void;
  onRefreshHealth: () => void;
  healthRefreshing: boolean;
  onMarkSetupItem: (key: string) => void;
  onMarkSetupComplete: () => void;
}

export function SystemTab({
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
  onMarkSetupItem,
  onMarkSetupComplete,
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
    <div>
      {!setupProgress.setup_complete && (
        <SetupChecklistCard
          progress={setupProgress}
          markingKey={setupMarkingKey}
          completing={setupCompleting}
          onMarkItem={onMarkSetupItem}
          onMarkComplete={onMarkSetupComplete}
        />
      )}
      <SystemHealthBoard
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
    </div>
  );
}
