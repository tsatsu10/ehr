import { useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { oeFetch } from '@core/oeFetch';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { Activity, RefreshCw } from 'lucide-react';
import type { SystemHealthChip, SystemHealthChipStatus, SystemHealthPayload } from './adminTypes';
import { AdminSection } from './adminUi';

function backupStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ok') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'running') return 'warning';
  return 'neutral';
}

interface SystemHealthBoardProps {
  ajaxUrl: string;
  csrfToken: string;
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
  if (status === 'ok') return 'text-[var(--color-oe-cta,#2bb350)]';
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
            variant="ctaOutline"
            size="sm"
            className="self-start"
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
  ajaxUrl,
  csrfToken,
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
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; note: string } | null>(null);
  const [exportingKey, setExportingKey] = useState(false);
  const [keyExportError, setKeyExportError] = useState<string | null>(null);
  const [runningFiles, setRunningFiles] = useState(false);
  const [filesResult, setFilesResult] = useState<{ ok: boolean; note: string } | null>(null);

  const recoveryKey = health.recovery_key;

  const exportRecoveryKey = async () => {
    setExportingKey(true);
    setKeyExportError(null);
    try {
      const r = await oeFetch<{ filename: string; content_base64: string; file_count: number }>(
        'admin.backup.export_recovery_key',
        { ajaxUrl, csrfToken, json: {} },
      );
      // Decode base64 → binary → download the ZIP without it touching a server file.
      const binary = atob(r.content_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/zip' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = r.filename || 'openemr-recovery-key.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      onRefresh();
    } catch (err) {
      setKeyExportError(err instanceof Error ? err.message : 'Could not export the recovery key.');
    } finally {
      setExportingKey(false);
    }
  };

  const runFilesBackup = async () => {
    setRunningFiles(true);
    setFilesResult(null);
    try {
      const r = await oeFetch<{
        files_backup_run_result?: { copied?: number; skipped?: number; too_large?: number; size_bytes?: number };
      }>('admin.backup.run_files', { ajaxUrl, csrfToken, json: {} });
      const res = r.files_backup_run_result;
      const copied = res?.copied ?? 0;
      const tooLarge = res?.too_large ?? 0;
      setFilesResult({
        ok: true,
        note:
          `Site files backed up: ${copied} new/changed file${copied === 1 ? '' : 's'} copied` +
          (tooLarge > 0 ? `, ${tooLarge} too large to encrypt (skipped)` : '') +
          '.',
      });
      onRefresh();
    } catch (err) {
      setFilesResult({ ok: false, note: err instanceof Error ? err.message : 'Site-files backup failed.' });
    } finally {
      setRunningFiles(false);
    }
  };

  const verifyLatest = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await oeFetch<{ verified: boolean; note: string }>('admin.backup.verify', {
        ajaxUrl,
        csrfToken,
        params: { run_id: 0 },
      });
      setVerifyResult(r);
    } catch (err) {
      setVerifyResult({ verified: false, note: err instanceof Error ? err.message : 'Verification failed.' });
    } finally {
      setVerifying(false);
    }
  };

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
        {health.backup_schedule?.scheduled ? (
          <p className="text-sm">
            Automatic backups: every {health.backup_schedule.frequency_days} day
            {health.backup_schedule.frequency_days === 1 ? '' : 's'} ·{' '}
            {health.backup_schedule.due ? (
              <span className="font-medium text-[var(--color-oe-warning,#ea580c)]">due now</span>
            ) : (
              <span className="text-[var(--oe-nc-text-muted)]">
                last backup {health.backup_schedule.age_days ?? 0} day
                {health.backup_schedule.age_days === 1 ? '' : 's'} ago
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-[var(--oe-nc-text-muted)]">Automatic backups: off</p>
        )}
        {health.backup_schedule?.scheduled && (
          health.backup_last_scheduled_attempt ? (
            <p className="text-sm text-[var(--oe-nc-text-muted)]">
              Last scheduled attempt: {health.backup_last_scheduled_attempt.started_at || '—'} (
              {health.backup_last_scheduled_attempt.status || 'unknown'})
            </p>
          ) : (
            <div className={deskCalloutClass('warn', 'mt-2 text-sm')}>
              Automatic backups are turned on, but no scheduled run has ever actually fired — a
              logged-in tab alone is not enough on a desk-only clinic. Schedule{' '}
              <span className="font-mono text-xs">scripts/run-jobs.php</span> (or{' '}
              <span className="font-mono text-xs">scripts/backup-scheduled.php</span>) via Windows
              Task Scheduler or cron — see the &quot;Schedule automatic backups&quot; runbook.
            </div>
          )
        )}
        {health.backup_target_cloud && (
          <div className={deskCalloutClass('success', 'mt-2 text-sm')} role="status">
            ✓ Backups sync to {health.backup_target_cloud} — they leave this machine automatically
            (encrypted before upload). Keep the {health.backup_target_cloud} app signed in and running.
          </div>
        )}
        {health.backup_target_local && (
          <div className={deskCalloutClass('warn', 'mt-2 text-sm')}>
            <p className="mb-1">
              Backups are being written to this machine. A disk failure, theft, or ransomware would
              lose them too — this is not disaster-safe on its own.
            </p>
            {(health.backup_cloud_folders ?? []).length > 0 ? (
              <p className="mb-0">
                To send them off-site with no extra setup, set “Backup target directory” to a cloud
                folder detected here:
                <span className="mt-1 block font-mono text-xs">
                  {(health.backup_cloud_folders ?? []).map((f) => (
                    <span key={f.path} className="block">{f.provider}: {f.path}</span>
                  ))}
                </span>
              </p>
            ) : (
              <p className="mb-0">
                Point it at a removable/external drive, or a Google Drive / OneDrive / Dropbox folder
                (install that app first), and keep the off-site replica as your real safety net.
              </p>
            )}
          </div>
        )}
        {health.backup_native_enabled && recoveryKey?.present && (
          recoveryKey.export_warning ? (
            <div className={deskCalloutClass('warn', 'mt-2 text-sm')}>
              <p className="mb-1 font-semibold">Save your recovery key off this machine</p>
              <p className="mb-2">
                Your backups are encrypted with a key stored on this computer. If this machine is
                lost, stolen, or wiped, the key goes with it and even your cloud/USB backups can no
                longer be opened. Save a copy somewhere safe — and <strong>not</strong> in the same
                place as your backups.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportingKey}
                onClick={() => { void exportRecoveryKey(); }}
              >
                {exportingKey ? 'Preparing…' : 'Save recovery key'}
              </Button>
            </div>
          ) : (
            <div className={deskCalloutClass('success', 'mt-2 text-sm')} role="status">
              <p className="mb-1">
                ✓ Recovery key last exported {recoveryKey.exported_at}. This confirms the download was
                generated — please make sure it actually reached a safe, separate place (not just the
                browser&apos;s Downloads folder). You need that copy to restore.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportingKey}
                onClick={() => { void exportRecoveryKey(); }}
              >
                {exportingKey ? 'Preparing…' : 'Save recovery key again'}
              </Button>
            </div>
          )
        )}
        {keyExportError && (
          <div className={deskCalloutClass('error', 'mt-2 text-sm')} role="alert">
            {keyExportError}
          </div>
        )}
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
          {health.backup_native_enabled && health.can_run_backup && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={verifying}
              onClick={() => { void verifyLatest(); }}
            >
              {verifying ? 'Verifying…' : 'Verify latest backup'}
            </Button>
          )}
          {health.files_backup_enabled && health.can_run_backup && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={runningFiles}
              onClick={() => { void runFilesBackup(); }}
            >
              {runningFiles ? 'Backing up files…' : 'Back up files now'}
            </Button>
          )}
        </div>
        {filesResult && (
          <div className={deskCalloutClass(filesResult.ok ? 'success' : 'error', 'mt-2 text-sm')} role="status">
            {filesResult.ok ? '✓ ' : '✗ '}{filesResult.note}
          </div>
        )}
        {verifyResult && (
          <div className={deskCalloutClass(verifyResult.verified ? 'success' : 'error', 'mt-2 text-sm')} role="status">
            {verifyResult.verified ? '✓ ' : '✗ '}{verifyResult.note}
          </div>
        )}

        {(health.backup_history ?? []).length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
              Recent backups
            </p>
            <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(health.backup_history ?? []).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)] text-nowrap">{run.started_at || '—'}</TableCell>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)] text-nowrap">{run.finished_at || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={run.self_reported ? 'warning' : backupStatusVariant(run.status)}>
                        {run.self_reported ? 'Self-reported' : (run.status || '—')}
                      </Badge>
                      {run.verified && (
                        <Badge variant="success" className="ml-1">Verified</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-nowrap">{run.size_label || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {run.file_name ? <span className="font-mono text-xs">{run.file_name}</span> : (run.message || '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {health.files_backup_enabled && (health.files_backup_history ?? []).length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
              Recent file backups
            </p>
            <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Copied this run</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(health.files_backup_history ?? []).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)] whitespace-nowrap">{run.started_at || '—'}</TableCell>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)] whitespace-nowrap">{run.finished_at || '—'}</TableCell>
                    <TableCell><Badge variant={backupStatusVariant(run.status)}>{run.status || '—'}</Badge></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{run.size_label || '—'}</TableCell>
                    <TableCell className="text-sm">{run.message || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminSection>
  );
}
