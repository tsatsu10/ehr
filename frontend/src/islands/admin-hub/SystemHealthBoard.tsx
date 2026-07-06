import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Activity, RefreshCw } from 'lucide-react';
import type { SystemHealthChip, SystemHealthChipStatus, SystemHealthPayload } from './adminTypes';
import { AdminSection } from './adminUi';

interface SystemHealthBoardProps {
  health: SystemHealthPayload;
  reconciliationRunning: boolean;
  backupRunning: boolean;
  backupCompleting: boolean;
  onRunReconciliation: () => void;
  onRunBackup: () => void;
  onCompleteBackup: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

function chipBadgeVariant(status: SystemHealthChipStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ok') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function overallLabel(status: SystemHealthPayload['overall_status']): string {
  if (status === 'ok') return 'All critical checks passed';
  if (status === 'warning') return 'Some checks need attention';
  return 'Critical issues detected';
}

function overallClass(status: SystemHealthPayload['overall_status']): string {
  if (status === 'ok') return 'text-green-600';
  if (status === 'warning') return 'text-[var(--color-oe-warning,#ea580c)]';
  return 'text-[var(--oe-nc-danger,#dc2626)]';
}

function formatCheckedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function HealthChipCard({
  chip,
  reconciliationRunning,
  backupRunning,
  backupCompleting,
  onRunReconciliation,
  onRunBackup,
  onCompleteBackup,
  showCompleteBackup,
}: {
  chip: SystemHealthChip;
  reconciliationRunning: boolean;
  backupRunning: boolean;
  backupCompleting: boolean;
  onRunReconciliation: () => void;
  onRunBackup: () => void;
  onCompleteBackup: () => void;
  showCompleteBackup: boolean;
}) {
  const showAction = chip.action_label != null;
  let actionDisabled = !chip.action_available;
  let onAction: (() => void) | undefined;
  let actionBusy = false;

  if (chip.key === 'backup') {
    onAction = onRunBackup;
    actionBusy = backupRunning;
    actionDisabled = actionDisabled || backupRunning;
  } else if (chip.key === 'reconciliation') {
    onAction = onRunReconciliation;
    actionBusy = reconciliationRunning;
    actionDisabled = actionDisabled || reconciliationRunning;
  }

  return (
    <div className="nc-admin-health-chip h-full">
      <div className="flex h-full flex-col p-4">
        <div className="flex justify-between items-start mb-2">
          <h6 className="font-semibold text-base mb-0">{chip.label}</h6>
          <Badge variant={chipBadgeVariant(chip.status)}>{chip.summary}</Badge>
        </div>
        <p className="text-sm text-[var(--oe-nc-text-muted)] mb-3 flex-grow">{chip.detail}</p>
        {showAction && onAction && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start mb-2"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionBusy ? 'Running…' : chip.action_label}
          </Button>
        )}
        {chip.key === 'backup' && showCompleteBackup && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start border-emerald-300 text-emerald-800 hover:bg-emerald-50"
            disabled={backupCompleting}
            onClick={onCompleteBackup}
          >
            {backupCompleting ? 'Saving…' : 'Mark backup complete'}
          </Button>
        )}
      </div>
    </div>
  );
}

export function SystemHealthBoard({
  health,
  reconciliationRunning,
  backupRunning,
  backupCompleting,
  onRunReconciliation,
  onRunBackup,
  onCompleteBackup,
  onRefresh,
  refreshing,
}: SystemHealthBoardProps) {
  return (
    <AdminSection
      title="System health"
      description={`Last checked: ${formatCheckedAt(health.checked_at)}`}
      icon={<Activity className="h-4 w-4" aria-hidden />}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={`mr-1 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <p className={`mb-3 font-semibold ${overallClass(health.overall_status)}`}>
        {overallLabel(health.overall_status)}
      </p>

      <div className="mb-3 grid grid-cols-12 gap-3">
        {health.chips.map((chip) => (
          <div key={chip.key} className="col-span-12 md:col-span-6 lg:col-span-3">
            <HealthChipCard
              chip={chip}
              reconciliationRunning={reconciliationRunning}
              backupRunning={backupRunning}
              backupCompleting={backupCompleting}
              onRunReconciliation={onRunReconciliation}
              onRunBackup={onRunBackup}
              onCompleteBackup={onCompleteBackup}
              showCompleteBackup={chip.key === 'backup' && !!health.backup_running && health.can_run_backup}
            />
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint)] px-3 py-2 text-sm text-[var(--oe-nc-text-muted)]">
        <span className="mr-4 mb-1">Recent errors (24h): {health.meta.errors_24h}</span>
        <span className="mr-4 mb-1">OpenEMR {health.meta.openemr_version}</span>
        <span className="mr-4 mb-1">Module {health.meta.module_version}</span>
        {health.meta.backup_retention_days != null && (
          <span className="mb-1">Backup retention: {health.meta.backup_retention_days} days</span>
        )}
      </div>

      <div>
        <h6 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
          Backup &amp; logs
        </h6>
        <p className="text-sm text-[var(--oe-nc-text-muted)]">{health.xampp_backup_hint}</p>
        {!health.can_run_backup && health.backup_blocked_reason && (
          <p className="text-sm text-[var(--color-oe-warning,#ea580c)]">{health.backup_blocked_reason}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={health.logview_url} target="_top">
              Open log viewer
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={health.backup_php_url} target="_top">
              Stock backup (Advanced)
            </a>
          </Button>
        </div>
      </div>
    </AdminSection>
  );
}
