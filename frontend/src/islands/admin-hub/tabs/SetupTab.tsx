import type { AdminTabId, SetupProgressPayload, StaffProvisionResult } from '../adminTypes';
import { SetupChecklistCard } from '../SetupChecklistCard';
import { AdminStack } from '../adminUi';

interface SetupTabProps {
  setupProgress: SetupProgressPayload;
  scopeLabel: string;
  setupMarkingKey: string | null;
  setupCompleting: boolean;
  setupReopening: boolean;
  onMarkSetupItem: (key: string) => void;
  onUnmarkSetupItem: (key: string) => void;
  onMarkSetupComplete: () => void;
  onReopenSetup: () => void;
  onNavigateTab: (tab: AdminTabId) => void;
  onProvisionStaff: () => void;
  staffProvisioning: boolean;
  staffProvisionResult: StaffProvisionResult | null;
  onDismissStaffProvisionResult: () => void;
  setupGlobalScope: boolean;
}

export function SetupTab({
  setupProgress,
  scopeLabel,
  setupMarkingKey,
  setupCompleting,
  setupReopening,
  onMarkSetupItem,
  onUnmarkSetupItem,
  onMarkSetupComplete,
  onReopenSetup,
  onNavigateTab,
  onProvisionStaff,
  staffProvisioning,
  staffProvisionResult,
  onDismissStaffProvisionResult,
  setupGlobalScope,
}: SetupTabProps) {
  return (
    <AdminStack>
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
        onProvisionStaff={onProvisionStaff}
        provisioning={staffProvisioning}
        provisionResult={staffProvisionResult}
        onDismissProvisionResult={onDismissStaffProvisionResult}
        globalScope={setupGlobalScope}
      />
    </AdminStack>
  );
}
