import type { SystemHealthChip, SystemHealthChipStatus, SystemHealthPayload } from './adminTypes';

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

function chipBadgeClass(status: SystemHealthChipStatus): string {
  if (status === 'ok') return 'badge-success';
  if (status === 'warning') return 'badge-warning';
  if (status === 'error') return 'badge-danger';
  return 'badge-secondary';
}

function overallLabel(status: SystemHealthPayload['overall_status']): string {
  if (status === 'ok') return 'All critical checks passed';
  if (status === 'warning') return 'Some checks need attention';
  return 'Critical issues detected';
}

function overallClass(status: SystemHealthPayload['overall_status']): string {
  if (status === 'ok') return 'text-success';
  if (status === 'warning') return 'text-warning';
  return 'text-danger';
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
    <div className="card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h6 className="card-title mb-0">{chip.label}</h6>
          <span className={`badge ${chipBadgeClass(chip.status)}`}>{chip.summary}</span>
        </div>
        <p className="small text-muted mb-3 flex-grow-1">{chip.detail}</p>
        {showAction && onAction && (
          <button
            type="button"
            className="btn btn-outline-primary btn-sm align-self-start mb-2"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionBusy ? 'Running…' : chip.action_label}
          </button>
        )}
        {chip.key === 'backup' && showCompleteBackup && (
          <button
            type="button"
            className="btn btn-outline-success btn-sm align-self-start"
            disabled={backupCompleting}
            onClick={onCompleteBackup}
          >
            {backupCompleting ? 'Saving…' : 'Mark backup complete'}
          </button>
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
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <div>
          <h5 className="mb-1">System health</h5>
          <p className={`mb-0 font-weight-bold ${overallClass(health.overall_status)}`}>
            {overallLabel(health.overall_status)}
          </p>
          <p className="small text-muted mb-0">
            Last checked: {formatCheckedAt(health.checked_at)}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="row mb-3">
        {health.chips.map((chip) => (
          <div key={chip.key} className="col-md-6 col-lg-3 mb-3">
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

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="d-flex flex-wrap small text-muted">
            <span className="mr-4 mb-1">Recent errors (24h): {health.meta.errors_24h}</span>
            <span className="mr-4 mb-1">OpenEMR {health.meta.openemr_version}</span>
            <span className="mr-4 mb-1">Module {health.meta.module_version}</span>
            {health.meta.backup_retention_days != null && (
              <span className="mb-1">Backup retention: {health.meta.backup_retention_days} days</span>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <h6 className="text-muted text-uppercase small">Backup &amp; logs</h6>
          <p className="small text-muted">{health.xampp_backup_hint}</p>
          {!health.can_run_backup && health.backup_blocked_reason && (
            <p className="small text-warning">{health.backup_blocked_reason}</p>
          )}
          <a className="btn btn-outline-warning btn-sm mr-2 mb-1" href={health.logview_url} target="_top">
            Open log viewer
          </a>
          <a className="btn btn-outline-warning btn-sm mb-1" href={health.backup_php_url} target="_top">
            Stock backup (Advanced)
          </a>
        </div>
      </div>
    </div>
  );
}
