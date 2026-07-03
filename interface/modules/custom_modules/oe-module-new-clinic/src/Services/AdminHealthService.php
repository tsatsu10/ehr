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

    /**
     * @return array<string, mixed>
     */
    public function getHealthStatus(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId < 0) {
            $facilityId = 0;
        }
        $resolvedFacilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $webroot = (string) ($GLOBALS['webroot'] ?? '');
        $latestBackup = $this->latestBackupRun($resolvedFacilityId);

        $chips = [
            $this->backupChip($resolvedFacilityId, $latestBackup),
            $this->reconciliationChip($resolvedFacilityId),
            $this->diskChip(),
            $this->phpChip(),
            $this->databaseChip(),
            $this->cronChip($resolvedFacilityId),
        ];

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
                    $resolvedFacilityId
                ),
            ],
            'can_run_backup' => $this->canRunBackup(),
            'backup_blocked_reason' => $this->canRunBackup()
                ? null
                : 'Backup requires OpenEMR administrator (super) access — ask your IT partner or use Advanced → Backup.',
            'backup_running' => is_array($latestBackup) && (string) ($latestBackup['status'] ?? '') === 'running',
            'backup_run_id' => is_array($latestBackup) ? (int) ($latestBackup['id'] ?? 0) : null,
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

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $this->supersedeRunningBackups($facilityId, 'Superseded by new manual backup run');

        $startedAt = date('Y-m-d H:i:s');
        $webroot = (string) ($GLOBALS['webroot'] ?? '');

        $runId = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run
             (facility_id, started_at, status, actor_id, message)
             VALUES (?, ?, 'running', ?, ?)",
            [
                $facilityId,
                $startedAt,
                $actorUserId,
                'Manual backup initiated from Admin Hub',
            ]
        );

        $this->auditBackupRun('admin_hub.backup_run', [
            'run_id' => $runId,
            'facility_id' => $facilityId,
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

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $row = $this->resolveBackupRunRow($facilityId, $runId);
        if ($row === null) {
            throw new \RuntimeException('No in-progress backup run to complete', 404);
        }

        $runId = (int) ($row['id'] ?? 0);
        $finishedAt = date('Y-m-d H:i:s');
        QueryUtils::sqlStatementThrowException(
            "UPDATE admin_hub_backup_run
             SET status = 'ok', finished_at = ?, message = ?
             WHERE id = ? AND facility_id = ? AND status = 'running'",
            [
                $finishedAt,
                'Manual backup completed from Admin Hub',
                $runId,
                $facilityId,
            ]
        );

        $this->auditBackupRun('admin_hub.backup_run', [
            'run_id' => $runId,
            'facility_id' => $facilityId,
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
    private function backupChip(int $facilityId, ?array $latest): array
    {
        $status = 'unknown';
        $summary = 'No backup recorded';
        $detail = 'Run a manual backup or schedule mysqldump for your environment.';
        $impact = 'warn';

        if (is_array($latest)) {
            $runStatus = (string) ($latest['status'] ?? '');
            $finishedAt = (string) ($latest['finished_at'] ?? '');
            $startedAt = (string) ($latest['started_at'] ?? '');

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
    private function latestBackupRun(int $facilityId): ?array
    {
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT * FROM admin_hub_backup_run
                 WHERE facility_id = ?
                 ORDER BY id DESC
                 LIMIT 1",
                [$facilityId]
            );
        } catch (\Throwable) {
            return null;
        }

        return is_array($row) && !empty($row['id']) ? $row : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveBackupRunRow(int $facilityId, ?int $runId): ?array
    {
        if ($runId !== null && $runId > 0) {
            $row = QueryUtils::querySingleRow(
                "SELECT * FROM admin_hub_backup_run
                 WHERE id = ? AND facility_id = ? AND status = 'running'
                 LIMIT 1",
                [$runId, $facilityId]
            );

            return is_array($row) && !empty($row['id']) ? $row : null;
        }

        return $this->latestBackupRun($facilityId);
    }

    private function supersedeRunningBackups(int $facilityId, string $message): void
    {
        try {
            QueryUtils::sqlStatementThrowException(
                "UPDATE admin_hub_backup_run
                 SET status = 'failed', finished_at = NOW(), message = ?
                 WHERE facility_id = ? AND status = 'running'",
                [$message, $facilityId]
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
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic_config',
            $event,
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
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
