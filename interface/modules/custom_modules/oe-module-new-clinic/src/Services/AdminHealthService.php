<?php

/**
 * M15-F08 — Admin hub system health overview
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\ModuleAssetVersion;
use OpenEMR\Services\VersionService;

class AdminHealthService
{
    private const PHP_MIN_SUPPORTED = '8.2.0';
    private const DISK_WARN_PERCENT = 15;
    private const DISK_CRITICAL_PERCENT = 5;
    private const BACKUP_STALE_DAYS = 7;
    private const CRON_STALE_HOURS = 26;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ReconciliationService $reconciliation = new ReconciliationService(),
    ) {
    }

    private ?AdminBackupService $backupService = null;
    private ?BackupCloudTargetService $cloudTarget = null;

    /** Lazy to avoid eager construction cycles (crash-safe). */
    private function backupService(): AdminBackupService
    {
        return $this->backupService ??= new AdminBackupService();
    }

    private function cloudTarget(): BackupCloudTargetService
    {
        return $this->cloudTarget ??= new BackupCloudTargetService();
    }

    /**
     * @return array<string, mixed>
     */
    public function getHealthStatus(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }
        $resolvedFacilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $backupFacilityId = $this->backupService()->facilityId();
        $webroot = (string) ($GLOBALS['webroot'] ?? '');
        $latestBackup = $this->latestBackupRun();

        $chips = [
            $this->backupChip($latestBackup),
            $this->reconciliationChip($resolvedFacilityId),
            $this->diskChip(),
            $this->phpChip(),
            $this->databaseChip(),
            $this->cronChip($resolvedFacilityId),
        ];

        // M4 — backup config lives at the fixed facility-0 sentinel (a database
        // backup is whole-DB, not scoped to any one clinic facility); everything
        // else on this page stays genuinely facility-scoped.
        $nativeBackupOn = $this->backupService()->isNativeEnabled($backupFacilityId);
        $backupTargetDir = trim((string) ($this->config->get('backup_target_dir', '', $backupFacilityId) ?? ''));
        $backupTargetCloud = $backupTargetDir !== '' ? $this->cloudTarget()->classify($backupTargetDir) : null;

        return [
            'overall_status' => $this->overallStatus($chips),
            'checked_at' => date('c'),
            'chips' => $chips,
            'meta' => [
                'openemr_version' => (new VersionService())->asString(),
                'module_version' => ModuleAssetVersion::VERSION,
                'errors_24h' => $this->countRecentErrors(),
                'backup_retention_days' => $this->config->getInt(
                    'admin_hub_backup_retention_days',
                    30,
                    $backupFacilityId
                ),
            ],
            'can_run_backup' => $this->canRunBackup(),
            'backup_blocked_reason' => $this->canRunBackup()
                ? null
                : 'Backup requires OpenEMR administrator (super) access — ask your IT partner or use Advanced → Backup.',
            'backup_running' => is_array($latestBackup) && (string) ($latestBackup['status'] ?? '') === 'running',
            'backup_run_id' => is_array($latestBackup) ? (int) ($latestBackup['id'] ?? 0) : null,
            'backup_history' => $this->backupHistory('db'),
            'backup_schedule' => $this->backupService()->dueForBackup($backupFacilityId),
            'backup_native_enabled' => $nativeBackupOn,
            // H3(i) — has ANY db backup ever completed with a real artifact AND
            // then passed a decrypt-and-read-back verify? This (not the health
            // chip, which can be "ok" off a self-reported stub) is what the setup
            // checklist's "Backup tested" item requires — "tested" means tested.
            'backup_verified_native_run' => $this->backupEverVerified(),
            // H1(c) — the last SCHEDULED attempt (worker/cron/heartbeat, actor_id
            // IS NULL), regardless of ok/failed, so silence in the unattended
            // schedule is visible even when a recent MANUAL "Run now" click makes
            // the ordinary backup chip look fresh.
            'backup_last_scheduled_attempt' => $this->lastScheduledAttempt('db'),
            // Site-files backup (design §3b) — a SEPARATE incremental per-file mirror
            // of the documents tree. Own enable flag, own history, own schedule.
            'files_backup_enabled' => $nativeBackupOn
                && $this->backupService()->isFilesBackupEnabled($backupFacilityId),
            'files_backup_history' => $nativeBackupOn
                ? $this->backupHistory('files')
                : [],
            'files_backup_schedule' => $nativeBackupOn
                ? $this->backupService()->dueForBackup($backupFacilityId, 'files')
                : ['scheduled' => false, 'due' => false, 'frequency_days' => 0],
            'files_backup_last_scheduled_attempt' => $nativeBackupOn
                ? $this->lastScheduledAttempt('files')
                : null,
            // Which cloud (if any) the target folder syncs to — off-site via the
            // provider's own desktop app, no OAuth, archive already encrypted.
            'backup_target_cloud' => $backupTargetCloud,
            // Honest safety flag: native backups written to THIS machine (blank
            // target / inside the app, and not a cloud folder) don't survive disk
            // loss/theft.
            'backup_target_local' => $nativeBackupOn && $backupTargetCloud === null
                && $this->backupTargetIsLocal(),
            // Cloud sync folders detected on this box, to suggest as a target.
            'backup_cloud_folders' => $nativeBackupOn ? $this->cloudTarget()->detectFolders() : [],
            // Recovery-key custody: the drive key decrypts every backup and lives on
            // THIS disk. If it's never exported off-box, the backups are one disk
            // failure away from being unrecoverable — nag when so. Only computed when
            // native backup is on (matches backup_cloud_folders; UI hides it otherwise).
            'recovery_key' => $nativeBackupOn ? $this->backupService()->recoveryKeyStatus() : null,
            // Lets the System tab's Possible-duplicates card skip its fetch when off.
            'duplicate_review_enabled' => $this->config->getInt('enable_duplicate_review', 0, $resolvedFacilityId) === 1,
            'backup_url' => $webroot . '/interface/main/backup.php',
            'logview_url' => $webroot . '/interface/logview/logview.php',
            'backup_php_url' => $webroot . '/interface/main/backup.php',
            'xampp_backup_hint' => 'On XAMPP Windows: schedule mysqldump plus robocopy of sites/default to an external drive.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function initiateBackup(int $facilityId, int $actorUserId): array
    {
        if (!$this->canRunBackup()) {
            throw new \RuntimeException(
                'Backup requires OpenEMR administrator (super) access',
                403
            );
        }

        // M4 — backup config/run rows live at the fixed facility-0 sentinel, not
        // whatever this request happened to resolve to.
        $backupFacilityId = $this->backupService()->facilityId();

        // C6 follow-up — when the native engine is on, actually perform an encrypted
        // backup (self-contained run row) instead of the log-only stub below.
        if ($this->backupService()->isNativeEnabled($backupFacilityId)) {
            $this->supersedeRunningBackups('db', 'Superseded by new native backup run');

            return $this->backupService()->runBackup($backupFacilityId, $actorUserId);
        }

        $this->supersedeRunningBackups('db', 'Superseded by new self-reported backup run');

        $startedAt = date('Y-m-d H:i:s');
        $webroot = (string) ($GLOBALS['webroot'] ?? '');

        // H3(iii) — this is the legacy, log-only path (native backup is off): it
        // never touches disk, so the message says exactly that up front — never
        // let this look like a real backup run in the history table.
        $runId = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run
             (facility_id, kind, started_at, status, actor_id, message)
             VALUES (?, 'db', ?, 'running', ?, ?)",
            [
                $backupFacilityId,
                $startedAt,
                $actorUserId,
                'Self-reported backup started (no automated artifact) — complete the download in the stock backup screen',
            ]
        );

        $this->auditBackupRun('admin_hub.backup_run', [
            'run_id' => $runId,
            'facility_id' => $backupFacilityId,
            'actor_user_id' => $actorUserId,
            'phase' => 'started',
        ]);

        return [
            'run_id' => $runId,
            'started_at' => $startedAt,
            'status' => 'running',
            'backup_url' => $webroot . '/interface/main/backup.php',
        ];
    }

    /**
     * Run the separate site-files backup (design §3b). Super-admin only + native
     * backup on + `backup_include_site_files` on (the service re-checks all three).
     *
     * @return array<string, mixed>
     */
    public function initiateFilesBackup(int $facilityId, int $actorUserId): array
    {
        if (!$this->canRunBackup()) {
            throw new \RuntimeException(
                'Backup requires OpenEMR administrator (super) access',
                403
            );
        }

        // M2 — clean up a stuck `running` FILES row (crash/kill mid-copy) before
        // starting a fresh one; scoped to kind='files' only (see supersedeRunningBackups()).
        $this->supersedeRunningBackups('files', 'Superseded by new site-files backup run');

        return $this->backupService()->runFilesBackup($this->backupService()->facilityId(), $actorUserId);
    }

    /**
     * @return array<string, mixed>
     */
    public function completeBackup(int $facilityId, int $actorUserId, ?int $runId = null): array
    {
        if (!$this->canRunBackup()) {
            throw new \RuntimeException(
                'Backup requires OpenEMR administrator (super) access',
                403
            );
        }

        $backupFacilityId = $this->backupService()->facilityId();
        $row = $this->resolveBackupRunRow($runId);
        if ($row === null) {
            throw new \RuntimeException('No in-progress backup run to complete', 404);
        }

        $runId = (int) ($row['id'] ?? 0);
        $rowFacilityId = (int) ($row['facility_id'] ?? $backupFacilityId);
        $finishedAt = date('Y-m-d H:i:s');
        // H3(iii) — the message itself says "self-reported / not verified" so this
        // is never indistinguishable from a real, artifact-backed backup — in the
        // chip, in the history table, and to anyone reading the audit trail.
        QueryUtils::sqlStatementThrowException(
            "UPDATE admin_hub_backup_run
             SET status = 'ok', finished_at = ?, message = ?
             WHERE id = ? AND facility_id = ? AND status = 'running'",
            [
                $finishedAt,
                'Self-reported: marked complete by hand — no automated artifact, not verified',
                $runId,
                $rowFacilityId,
            ]
        );

        $this->auditBackupRun('admin_hub.backup_run', [
            'run_id' => $runId,
            'facility_id' => $rowFacilityId,
            'actor_user_id' => $actorUserId,
            'phase' => 'completed',
            'finished_at' => $finishedAt,
        ]);

        return [
            'run_id' => $runId,
            'status' => 'ok',
            'finished_at' => $finishedAt,
        ];
    }

    public function canRunBackup(): bool
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            return false;
        }

        return AclMain::aclCheckCore('new_clinic', 'new_admin_hub_system')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');
    }

    /**
     * @param list<array<string, mixed>> $chips
     */
    private function overallStatus(array $chips): string
    {
        $hasCritical = false;
        $hasWarning = false;

        foreach ($chips as $chip) {
            $impact = (string) ($chip['overall_impact'] ?? 'none');
            if ($impact === 'critical') {
                $hasCritical = true;
            } elseif ($impact === 'warn') {
                $hasWarning = true;
            }
        }

        if ($hasCritical) {
            return 'critical';
        }

        return $hasWarning ? 'warning' : 'ok';
    }

    /**
     * @param array<string, mixed>|null $latest
     * @return array<string, mixed>
     */
    private function backupChip(?array $latest): array
    {
        $status = 'unknown';
        $summary = 'No backup recorded';
        $detail = 'Run a manual backup or schedule mysqldump for your environment.';
        $impact = 'warn';

        if (is_array($latest)) {
            $runStatus = (string) ($latest['status'] ?? '');
            $finishedAt = (string) ($latest['finished_at'] ?? '');
            $startedAt = (string) ($latest['started_at'] ?? '');
            // H3(ii) — the legacy "Mark backup complete" path never writes a
            // file_path (it's a self-report, not an artifact). Discriminate on
            // that existing signal rather than adding a new "is this real" flag.
            $hasArtifact = !empty($latest['file_path']);

            if ($runStatus === 'failed') {
                $status = 'error';
                $summary = 'Last backup failed';
                $detail = (string) ($latest['message'] ?? 'Check server logs.');
                $impact = 'critical';
            } elseif ($runStatus === 'running') {
                $status = 'warning';
                $summary = 'Backup in progress';
                $detail = 'Started ' . $startedAt . ' — complete the stock backup download, then mark complete.';
                $impact = 'warn';
            } elseif ($runStatus === 'ok' && $finishedAt !== '' && !$hasArtifact) {
                // H3(ii)/(iii) — never an unqualified green light: this run was
                // marked complete by hand with nothing to show for it.
                $status = 'warning';
                $summary = 'Self-reported (no verified artifact) · ' . $this->humanAgeLabel($finishedAt);
                $detail = 'Marked complete by hand — no automated backup file exists to verify. '
                    . 'Turn on native backup for a real, checkable artifact.';
                $impact = 'warn';
            } elseif ($runStatus === 'ok' && $finishedAt !== '') {
                $ageDays = $this->daysSince($finishedAt);
                $status = $ageDays > self::BACKUP_STALE_DAYS ? 'warning' : 'ok';
                $summary = $this->humanAgeLabel($finishedAt);
                $detail = $finishedAt;
                $impact = $ageDays > self::BACKUP_STALE_DAYS ? 'warn' : 'none';
            } elseif ($startedAt !== '') {
                $status = 'warning';
                $summary = 'Initiated ' . $this->humanAgeLabel($startedAt);
                $detail = 'Complete the stock backup download, then verify restore on staging.';
                $impact = 'warn';
            }
        }

        return $this->chipPayload(
            'backup',
            'Backup',
            $status,
            $summary,
            $detail,
            'Run now',
            $this->canRunBackup(),
            $impact
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function reconciliationChip(int $facilityId): array
    {
        $enabled = $this->config->getInt('reconciliation_enabled', 1, $facilityId) === 1;
        $cronTime = (string) ($this->config->get('reconciliation_cron_time', '23:55', $facilityId) ?? '23:55');

        if (!$enabled) {
            return $this->chipPayload(
                'reconciliation',
                'Reconcile',
                'unknown',
                'Disabled',
                'Enable scheduled reconciliation on the Clinic tab.',
                'Run now',
                true,
                'none'
            );
        }

        $latest = $this->reconciliation->getLatestRun($facilityId);
        if (!is_array($latest) || empty($latest['run_date'])) {
            return $this->chipPayload(
                'reconciliation',
                'Reconcile',
                'warning',
                'No runs yet',
                'Scheduled at ' . $cronTime,
                'Run now',
                true,
                'warn'
            );
        }

        $runStatus = (string) ($latest['status'] ?? 'unknown');
        $chipStatus = $runStatus === 'error' ? 'error' : ($runStatus === 'warning' ? 'warning' : 'ok');
        $impact = $runStatus === 'error' ? 'critical' : ($runStatus === 'warning' ? 'warn' : 'none');

        return $this->chipPayload(
            'reconciliation',
            'Reconcile',
            $chipStatus,
            strtoupper($runStatus) . ' ' . ($latest['run_date'] ?? ''),
            'Delta ' . ($latest['delta_amount'] ?? '0') . ' · cron ' . $cronTime,
            'Run now',
            true,
            $impact
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function diskChip(): array
    {
        $path = (string) ($GLOBALS['OE_SITE_DIR'] ?? ($GLOBALS['fileroot'] ?? '.'));
        $free = @disk_free_space($path);
        $total = @disk_total_space($path);

        if ($free === false || $total === false || $total <= 0) {
            return $this->chipPayload(
                'disk',
                'Disk space',
                'unknown',
                'Unavailable',
                $path,
                null,
                false,
                'warn'
            );
        }

        $percentFree = (int) round(($free / $total) * 100);
        $status = 'ok';
        $impact = 'none';
        if ($percentFree <= self::DISK_CRITICAL_PERCENT) {
            $status = 'error';
            $impact = 'critical';
        } elseif ($percentFree <= self::DISK_WARN_PERCENT) {
            $status = 'warning';
            $impact = 'warn';
        }

        return $this->chipPayload(
            'disk',
            'Disk space',
            $status,
            $percentFree . '% free',
            $this->formatBytes((int) $free) . ' free of ' . $this->formatBytes((int) $total),
            null,
            false,
            $impact
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function phpChip(): array
    {
        $version = PHP_VERSION;
        $supported = version_compare($version, self::PHP_MIN_SUPPORTED, '>=');

        return $this->chipPayload(
            'php',
            'PHP',
            $supported ? 'ok' : 'warning',
            $supported ? 'Supported' : 'Upgrade recommended',
            $version,
            null,
            false,
            $supported ? 'none' : 'warn'
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function databaseChip(): array
    {
        try {
            $row = QueryUtils::querySingleRow('SELECT 1 AS ok');
            $ok = is_array($row) && (int) ($row['ok'] ?? 0) === 1;
        } catch (\Throwable) {
            $ok = false;
        }

        return $this->chipPayload(
            'database',
            'Database',
            $ok ? 'ok' : 'error',
            $ok ? 'Connected' : 'Unreachable',
            $ok ? 'Ping OK' : 'Check MySQL service and credentials',
            null,
            false,
            $ok ? 'none' : 'critical'
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function cronChip(int $facilityId): array
    {
        $scheduledOn = $this->config->getInt('enable_scheduled_integration', 1, $facilityId) === 1
            && $this->config->getInt('reconciliation_enabled', 1, $facilityId) === 1;

        if (!$scheduledOn) {
            return $this->chipPayload(
                'cron',
                'Cron & jobs',
                'unknown',
                'Not scheduled',
                'Enable scheduled integration for nightly reconciliation.',
                null,
                false,
                'none'
            );
        }

        $row = QueryUtils::querySingleRow(
            "SELECT completed_at, status FROM new_reconciliation_run
             WHERE facility_id = ? AND `trigger` = 'scheduled'
             ORDER BY id DESC
             LIMIT 1",
            [$facilityId]
        );

        if (!is_array($row) || empty($row['completed_at'])) {
            return $this->chipPayload(
                'cron',
                'Cron & jobs',
                'warning',
                'No scheduled run',
                'Configure host crontab for OpenEMR background services.',
                null,
                false,
                'warn'
            );
        }

        $completedAt = (string) $row['completed_at'];
        $hours = $this->hoursSince($completedAt);
        $status = $hours <= self::CRON_STALE_HOURS ? 'ok' : 'warning';

        return $this->chipPayload(
            'cron',
            'Cron & jobs',
            $status,
            $this->humanAgeLabel($completedAt),
            'Last scheduled reconciliation · ' . (string) ($row['status'] ?? ''),
            null,
            false,
            $hours <= self::CRON_STALE_HOURS ? 'none' : 'warn'
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function chipPayload(
        string $key,
        string $label,
        string $status,
        string $summary,
        string $detail,
        ?string $actionLabel,
        bool $actionAvailable,
        string $overallImpact
    ): array {
        return [
            'key' => $key,
            'label' => $label,
            'status' => $status,
            'summary' => $summary,
            'detail' => $detail,
            'action_label' => $actionLabel,
            'action_available' => $actionAvailable,
            'overall_impact' => $overallImpact,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function latestBackupRun(): ?array
    {
        [$facilityId, $legacyFacilityId] = $this->backupService()->backupFacilityIdsForRead();
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT * FROM admin_hub_backup_run
                 WHERE facility_id IN (?, ?) AND kind = 'db'
                 ORDER BY id DESC
                 LIMIT 1",
                [$facilityId, $legacyFacilityId]
            );
        } catch (\Throwable) {
            return null;
        }

        return is_array($row) && !empty($row['id']) ? $row : null;
    }

    /**
     * C6 (W3) — recent manual backup runs for the history table (bounded).
     *
     * @return array<int, array<string, mixed>>
     */
    private function backupHistory(string $kind = 'db'): array
    {
        $kind = $kind === 'files' ? 'files' : 'db';
        [$facilityId, $legacyFacilityId] = $this->backupService()->backupFacilityIdsForRead();
        try {
            $rows = QueryUtils::fetchRecords(
                "SELECT id, started_at, finished_at, status, size_bytes, file_path, message, verified_at
                 FROM admin_hub_backup_run
                 WHERE facility_id IN (?, ?) AND kind = ?
                 ORDER BY id DESC
                 LIMIT 10",
                [$facilityId, $legacyFacilityId, $kind]
            ) ?: [];
        } catch (\Throwable) {
            return [];
        }

        return array_map(function (array $row): array {
            $size = $row['size_bytes'] !== null ? (int) $row['size_bytes'] : null;

            return [
                'id' => (int) ($row['id'] ?? 0),
                'started_at' => (string) ($row['started_at'] ?? ''),
                'finished_at' => (string) ($row['finished_at'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'size_label' => $size !== null ? $this->humanSize($size) : '',
                // Show only the file name in the UI, not the full server path.
                'file_name' => $row['file_path'] !== null ? basename((string) $row['file_path']) : '',
                'message' => (string) ($row['message'] ?? ''),
                // H3(ii) — an 'ok' run with no file_path is the legacy self-report,
                // never a real artifact; the history table must say so, not just
                // fall back to showing the message text.
                'self_reported' => (string) ($row['status'] ?? '') === 'ok' && empty($row['file_path']),
                'verified' => !empty($row['verified_at'] ?? null),
            ];
        }, $rows);
    }

    private function backupTargetIsLocal(): bool
    {
        $target = trim((string) ($this->config->get('backup_target_dir', '', $this->backupService()->facilityId()) ?? ''));
        if ($target === '') {
            return true; // defaults to documents/nc_backups on this box
        }
        $fileroot = rtrim(str_replace('\\', '/', (string) ($GLOBALS['fileroot'] ?? '')), '/');
        $target = rtrim(str_replace('\\', '/', $target), '/');

        return $fileroot !== '' && str_starts_with($target, $fileroot);
    }

    /**
     * H3(i) — has ANY db backup ever completed with a real, on-disk artifact AND
     * then had a decrypt-and-read-back verify pass? This is deliberately an
     * "ever", not "latest": once a clinic has proven it can produce and restore
     * a real backup, that one-time setup-checklist gate stays satisfied even if
     * the most recent run since then happens to be a self-reported stub or a
     * transient failure — the ongoing health SIGNAL for that is the backup chip,
     * which does decay with staleness/failure; the checklist item is a completed
     * training/setup milestone, not a live health check.
     */
    private function backupEverVerified(): bool
    {
        [$facilityId, $legacyFacilityId] = $this->backupService()->backupFacilityIdsForRead();
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT id FROM admin_hub_backup_run
                 WHERE facility_id IN (?, ?) AND kind = 'db' AND status = 'ok'
                 AND file_path IS NOT NULL AND verified_at IS NOT NULL
                 ORDER BY id DESC LIMIT 1",
                [$facilityId, $legacyFacilityId]
            );
        } catch (\Throwable) {
            // verified_at may not exist yet on an un-upgraded install.
            return false;
        }

        return is_array($row) && !empty($row['id']);
    }

    /**
     * H1(c) — the last SCHEDULED (worker/cron/heartbeat) attempt, ok or failed,
     * as opposed to the latest run of ANY kind (which a recent manual "Run now"
     * click can make look healthy even if the unattended schedule never fires).
     * Scheduled runs are the ones with no interactive actor (actor_id IS NULL —
     * runScheduledBackup()/runScheduledFilesBackup() always pass actorUserId=0).
     *
     * @return array<string, mixed>|null
     */
    private function lastScheduledAttempt(string $kind = 'db'): ?array
    {
        $kind = $kind === 'files' ? 'files' : 'db';
        [$facilityId, $legacyFacilityId] = $this->backupService()->backupFacilityIdsForRead();
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT status, started_at, finished_at, message FROM admin_hub_backup_run
                 WHERE facility_id IN (?, ?) AND kind = ? AND actor_id IS NULL
                 ORDER BY id DESC LIMIT 1",
                [$facilityId, $legacyFacilityId, $kind]
            );
        } catch (\Throwable) {
            return null;
        }

        return is_array($row) && ($row['started_at'] ?? null) !== null ? $row : null;
    }

    private function humanSize(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 1) . ' GB';
        }
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }

        return $bytes . ' B';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveBackupRunRow(?int $runId): ?array
    {
        if ($runId !== null && $runId > 0) {
            [$facilityId, $legacyFacilityId] = $this->backupService()->backupFacilityIdsForRead();
            $row = QueryUtils::querySingleRow(
                "SELECT * FROM admin_hub_backup_run
                 WHERE id = ? AND facility_id IN (?, ?) AND kind = 'db' AND status = 'running'
                 LIMIT 1",
                [$runId, $facilityId, $legacyFacilityId]
            );

            return is_array($row) && !empty($row['id']) ? $row : null;
        }

        return $this->latestBackupRun();
    }

    /**
     * M2 — the pre-M2 version hardcoded `kind = 'db'`, and only the DB-backup
     * start path ever called it. A `files` run that died mid-copy (crash,
     * kill -9, box power loss) could therefore NEVER be superseded by anything —
     * it just showed "running" forever. Now callable per kind, and BOTH
     * initiateBackup() and initiateFilesBackup() call it (each with its own
     * kind) before starting a fresh run of that kind — never the other kind's,
     * so a genuinely in-flight files backup is untouched by a new DB run
     * starting (and vice versa; the M3 lock is what actually serializes
     * concurrent same-kind runs).
     */
    private function supersedeRunningBackups(string $kind, string $message): void
    {
        $kind = $kind === 'files' ? 'files' : 'db';
        [$facilityId, $legacyFacilityId] = $this->backupService()->backupFacilityIdsForRead();
        try {
            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run
                 SET status = 'failed', finished_at = NOW(), message = ?
                 WHERE facility_id IN (?, ?) AND kind = ? AND status = 'running'",
                [$message, $facilityId, $legacyFacilityId, $kind]
            );
        } catch (\Throwable) {
            // Table may not exist until SQL upgrade on older installs.
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function auditBackupRun(string $event, array $payload): void
    {
        // newEvent($event, $user, $groupname, $success, $comments, $patient_id) —
        // record the acting user/group, not the action name in the user column.
        EventAuditLogger::getInstance()->newEvent(
            $event,
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            json_encode($payload),
            0
        );
    }

    private function countRecentErrors(): int
    {
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT COUNT(*) AS cnt FROM log
                 WHERE date >= DATE_SUB(NOW(), INTERVAL 1 DAY) AND success = 0"
            );

            return (int) ($row['cnt'] ?? 0);
        } catch (\Throwable) {
            return 0;
        }
    }

    private function daysSince(string $timestamp): int
    {
        $ts = strtotime($timestamp);
        if ($ts === false) {
            return 999;
        }

        return (int) floor((time() - $ts) / 86400);
    }

    private function hoursSince(string $timestamp): int
    {
        $ts = strtotime($timestamp);
        if ($ts === false) {
            return 999;
        }

        return (int) floor((time() - $ts) / 3600);
    }

    private function humanAgeLabel(string $timestamp): string
    {
        $hours = $this->hoursSince($timestamp);
        if ($hours < 1) {
            return 'Just now';
        }
        if ($hours < 48) {
            return $hours . 'h ago';
        }

        $days = $this->daysSince($timestamp);

        return $days . 'd ago';
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes . ' B';
        }
        if ($bytes < 1048576) {
            return round($bytes / 1024, 1) . ' KB';
        }
        if ($bytes < 1073741824) {
            return round($bytes / 1048576, 1) . ' MB';
        }

        return round($bytes / 1073741824, 1) . ' GB';
    }
}
