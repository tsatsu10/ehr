<?php

/**
 * M16 Reporting Operations Hub — export run audit (REP-3 / M16-F08)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ReportHubExportService
{
    private static bool $schemaEnsured = false;

    /** SCALE-2.1 — a job is retried up to this many times before it is marked failed. */
    private const MAX_ATTEMPTS = 3;

    /** A claim older than this (worker died mid-job) is considered stale and reclaimable. */
    private const STALE_CLAIM_SECONDS = 300;

    /**
     * Inline fallback only runs a job the worker hasn't picked up after this long.
     * Kept well under the client's poll budget (~150s) so a no-worker host still
     * completes the export before the browser gives up. For real offloading, schedule
     * scripts/run-jobs.php and set `enable_inline_export_fallback = 0`.
     */
    private const INLINE_FALLBACK_AFTER_SECONDS = 10;

    /** SCALE-2.3 — all export files go through the storage abstraction. */
    public const STORAGE_NAMESPACE = 'nc_report_exports';

    public function __construct(
        private readonly ReportHubAccessService $access = new ReportHubAccessService(),
        private readonly ReportHubCatalogService $catalog = new ReportHubCatalogService(),
        private readonly ReportHubNativeReportService $nativeReports = new ReportHubNativeReportService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ExportStorageService $storage = new ExportStorageService(self::STORAGE_NAMESPACE),
    ) {
    }

    /**
     * §16.3 — opening a stock report from the Advanced menu is a distinct audit
     * event from an export run, so inspectors can separate views from extracts.
     *
     * @param array<string, mixed> $body
     */
    public static function resolveAuditEventName(array $body): string
    {
        return ($body['source'] ?? '') === 'advanced_open'
            ? 'reports.hub_advanced_open'
            : 'reports.export_run';
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function recordExportRun(array $body, int $actorUserId): array
    {
        $this->access->assertHubAccess();

        $reportKey = trim((string) ($body['report_key'] ?? ''));
        if ($reportKey === '') {
            throw new \InvalidArgumentException('report_key is required');
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId(
            isset($body['facility_id']) ? (int) $body['facility_id'] : null
        );

        $this->assertReportKeyAllowed($reportKey, $facilityId);

        $dateFrom = $this->normalizeDate($body['date_from'] ?? null);
        $dateTo = $this->normalizeDate($body['date_to'] ?? null);
        $rowCount = isset($body['row_count']) ? (int) $body['row_count'] : null;
        $filePath = trim((string) ($body['file_path'] ?? ''));
        $status = trim((string) ($body['status'] ?? 'ok'));
        if (!in_array($status, ['ok', 'failed', 'running'], true)) {
            $status = 'ok';
        }
        $message = trim((string) ($body['message'] ?? ''));
        $auditEvent = self::resolveAuditEventName($body);

        $this->ensureTableExists();

        $now = date('Y-m-d H:i:s');
        $id = QueryUtils::sqlInsert(
            'INSERT INTO report_hub_export_run
                (facility_id, report_key, date_from, date_to, row_count, file_path, status, actor_user_id, started_at, finished_at, message)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $facilityId,
                $reportKey,
                $dateFrom,
                $dateTo,
                $rowCount,
                $filePath !== '' ? $filePath : null,
                $status,
                $actorUserId,
                $now,
                $status === 'running' ? null : $now,
                $message !== '' ? $message : null,
            ]
        );

        EventAuditLogger::getInstance()->newEvent(
            'reports',
            $auditEvent,
            $actorUserId,
            1,
            'report_key=' . $reportKey
            . ' facility_id=' . $facilityId
            . ' status=' . $status
            . ($rowCount !== null ? ' row_count=' . $rowCount : '')
        );

        return [
            'id' => (int) $id,
            'report_key' => $reportKey,
            'status' => $status,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function requestExport(array $body, int $actorUserId): array
    {
        $this->access->assertHubAccess();

        $reportKey = trim((string) ($body['report_key'] ?? ''));
        if ($reportKey === '') {
            throw new \InvalidArgumentException('report_key is required');
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId(
            isset($body['facility_id']) ? (int) $body['facility_id'] : null
        );

        $this->assertReportKeyAllowed($reportKey, $facilityId);
        if (!$this->nativeReports->isNativeKey($reportKey)) {
            throw new \InvalidArgumentException('Export is only supported for native hub reports');
        }

        $dateFrom = $this->normalizeDate($body['date_from'] ?? null);
        $dateTo = $this->normalizeDate($body['date_to'] ?? null);
        $rowCount = $this->nativeReports->countRows($reportKey, $dateFrom, $dateTo, $facilityId);
        $threshold = $this->asyncExportThreshold($facilityId);

        if ($rowCount > $threshold) {
            $jobId = $this->createRunningJob(
                $reportKey,
                $facilityId,
                $dateFrom,
                $dateTo,
                $rowCount,
                $actorUserId
            );

            return [
                'mode' => 'async',
                'job_id' => $jobId,
                'row_count_estimate' => $rowCount,
                'threshold' => $threshold,
            ];
        }

        $csv = $this->nativeReports->buildCsv($reportKey, $dateFrom, $dateTo, $facilityId);
        $this->recordExportRun([
            'report_key' => $reportKey,
            'facility_id' => $facilityId,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'row_count' => $csv['row_count'],
            'status' => 'ok',
        ], $actorUserId);

        return [
            'mode' => 'sync',
            'filename' => $csv['filename'],
            'content' => $csv['content'],
            'row_count' => $csv['row_count'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function pollExportStatus(int $jobId, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        $row = $this->loadJobRow($jobId, $actorUserId);

        // SCALE-2.1 — the poll is now a PURE read. A background worker
        // (scripts/run-jobs.php) claims and completes 'running' jobs. The only
        // exception is the inline fallback: on a host with no worker scheduled, once
        // a job has sat unclaimed past the fallback window, run it here (claiming it
        // first so retries/attempts still apply) so exports don't hang forever.
        if (($row['status'] ?? '') === 'running' && $this->shouldRunInlineFallback($row)) {
            $claimed = $this->claimJob($jobId);
            if ($claimed !== null) {
                $this->processJob($claimed, $actorUserId);
                $row = $this->loadJobRow($jobId, $actorUserId);
            }
        }

        $payload = [
            'job_id' => $jobId,
            'report_key' => (string) ($row['report_key'] ?? ''),
            'status' => (string) ($row['status'] ?? 'failed'),
            'row_count' => isset($row['row_count']) ? (int) $row['row_count'] : null,
            'message' => (string) ($row['message'] ?? ''),
        ];

        if ($payload['status'] === 'ok' && !empty($row['file_path'])) {
            $payload['filename'] = basename((string) $row['file_path']);
            $payload['ready'] = true;
        }

        return $payload;
    }

    /**
     * @return array{filename: string, content: string}
     */
    public function readExportDownload(int $jobId, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        $row = $this->loadJobRow($jobId, $actorUserId);

        if (($row['status'] ?? '') !== 'ok') {
            throw new \RuntimeException('Export is not ready', 409);
        }

        $path = (string) ($row['file_path'] ?? '');
        $content = $this->storage->read($path); // SCALE-2.3: containment-checked read

        return [
            'filename' => basename($path),
            'content' => $content,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function runReportPreview(array $body, int $actorUserId): array
    {
        $this->access->assertHubAccess();

        $reportKey = trim((string) ($body['report_key'] ?? ''));
        if ($reportKey === '') {
            throw new \InvalidArgumentException('report_key is required');
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId(
            isset($body['facility_id']) ? (int) $body['facility_id'] : null
        );

        $this->assertReportKeyAllowed($reportKey, $facilityId);
        if (!$this->nativeReports->isNativeKey($reportKey)) {
            throw new \InvalidArgumentException('Preview is only supported for native hub reports');
        }

        $dateFrom = $this->normalizeDate($body['date_from'] ?? null);
        $dateTo = $this->normalizeDate($body['date_to'] ?? null);
        $limit = isset($body['limit']) ? max(1, min(200, (int) $body['limit'])) : 50;
        $offset = isset($body['offset']) ? max(0, (int) $body['offset']) : 0;

        $result = $this->nativeReports->runReport($reportKey, $dateFrom, $dateTo, $limit, $offset, $facilityId);

        return [
            'report_key' => $reportKey,
            'columns' => $result['columns'],
            'rows' => $result['rows'],
            'total' => $result['total'],
            'limit' => $limit,
            'offset' => $offset,
        ];
    }

    private function asyncExportThreshold(int $facilityId): int
    {
        $threshold = $this->config->getInt('report_hub_async_export_threshold', 5000, $facilityId);

        return max(1, $threshold);
    }

    private function createRunningJob(
        string $reportKey,
        int $facilityId,
        ?string $dateFrom,
        ?string $dateTo,
        int $rowCountEstimate,
        int $actorUserId,
    ): int {
        $this->ensureTableExists();
        $now = date('Y-m-d H:i:s');
        $meta = json_encode([
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
        ]);

        $id = QueryUtils::sqlInsert(
            'INSERT INTO report_hub_export_run
                (facility_id, report_key, date_from, date_to, row_count, file_path, status, actor_user_id, started_at, finished_at, message)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?)',
            [
                $facilityId,
                $reportKey,
                $dateFrom,
                $dateTo,
                $rowCountEstimate,
                'running',
                $actorUserId,
                $now,
                $meta !== false ? $meta : null,
            ]
        );

        return (int) $id;
    }

    /**
     * Worker entry (scripts/run-jobs.php): claim + process pending export jobs until
     * there are none, or the job/time budget is hit. Each iteration claims one job
     * atomically so multiple workers never double-run the same export. SCALE-2.1.
     *
     * @return array{processed: int, failed: int}
     */
    public function runWorker(int $maxJobs = 20, int $maxSeconds = 55): array
    {
        $this->ensureTableExists();
        $processed = 0;
        $failed = 0;
        $deadline = time() + max(1, $maxSeconds);

        while (($processed + $failed) < max(1, $maxJobs) && time() < $deadline) {
            $row = $this->claimJob();
            if ($row === null) {
                break; // nothing to process
            }
            if ($this->processJob($row, (int) ($row['actor_user_id'] ?? 0))) {
                $processed++;
            } else {
                $failed++;
            }
        }

        return ['processed' => $processed, 'failed' => $failed];
    }

    /**
     * Atomically claim the next processable job (or a specific one), incrementing
     * attempts. Claims an unclaimed OR stale-claimed 'running' job with retries left.
     *
     * Uses a unique token + read-back rather than affected-rows: OpenEMR's
     * sqlStatement() logs each query, so affected_rows() reflects the logging insert,
     * not the UPDATE (same reason as VisitScopeService's maintenance lock). The token
     * is unique per call, so exactly the row this call claimed carries it.
     *
     * @return array<string, mixed>|null the claimed row, or null if none available
     */
    private function claimJob(?int $onlyJobId = null): ?array
    {
        $token = bin2hex(random_bytes(16));
        $sql = "UPDATE report_hub_export_run
                SET claimed_by = ?, claimed_at = NOW(), attempts = attempts + 1
                WHERE status = 'running'
                  AND attempts < ?
                  AND (claimed_by IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL ? SECOND))";
        $binds = [$token, self::MAX_ATTEMPTS, self::STALE_CLAIM_SECONDS];
        if ($onlyJobId !== null) {
            $sql .= ' AND id = ?';
            $binds[] = $onlyJobId;
        }
        $sql .= ' ORDER BY id LIMIT 1';
        sqlStatement($sql, $binds);

        $row = QueryUtils::querySingleRow(
            "SELECT * FROM report_hub_export_run WHERE claimed_by = ? AND status = 'running' ORDER BY id LIMIT 1",
            [$token]
        );

        return is_array($row) ? $row : null;
    }

    /**
     * Should the status poll run this 'running' job inline (no-worker fallback)?
     * Only when the fallback is enabled (default on), the job is unclaimed, still has
     * retries, and has waited past the fallback window (giving a real worker first crack).
     *
     * @param array<string, mixed> $row
     */
    private function shouldRunInlineFallback(array $row): bool
    {
        if ($this->config->getInt('enable_inline_export_fallback', 1) !== 1) {
            return false;
        }
        if (!empty($row['claimed_by'])) {
            return false; // a worker already has it
        }
        if ((int) ($row['attempts'] ?? 0) >= self::MAX_ATTEMPTS) {
            return false;
        }
        $startedAt = (string) ($row['started_at'] ?? '');
        $ageSeconds = $startedAt !== '' ? (time() - (int) strtotime($startedAt)) : PHP_INT_MAX;

        return $ageSeconds >= self::INLINE_FALLBACK_AFTER_SECONDS;
    }

    /**
     * Build + write a claimed export job's file and mark it done. On failure, either
     * release the claim for another attempt (if attempts remain) or mark it failed
     * after the 3rd. The caller must have CLAIMED the row first (attempts already
     * incremented). Returns true on success. SCALE-2.1.
     *
     * @param array<string, mixed> $row
     */
    private function processJob(array $row, int $actorUserId): bool
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }

        $jobId = (int) ($row['id'] ?? 0);
        $facilityId = (int) ($row['facility_id'] ?? 0);
        $reportKey = (string) ($row['report_key'] ?? '');
        $meta = json_decode((string) ($row['message'] ?? ''), true);
        $dateFrom = is_array($meta) ? ($meta['date_from'] ?? null) : ($row['date_from'] ?? null);
        $dateTo = is_array($meta) ? ($meta['date_to'] ?? null) : ($row['date_to'] ?? null);

        try {
            $csv = $this->nativeReports->buildCsv(
                $reportKey,
                is_string($dateFrom) ? $dateFrom : null,
                is_string($dateTo) ? $dateTo : null,
                $facilityId
            );
            $path = $this->writeExportFile($jobId, $csv['filename'], $csv['content']);

            sqlStatement(
                'UPDATE report_hub_export_run
                 SET status = ?, row_count = ?, file_path = ?, finished_at = ?, message = NULL
                 WHERE id = ? AND status = ?',
                ['ok', $csv['row_count'], $path, date('Y-m-d H:i:s'), $jobId, 'running']
            );

            EventAuditLogger::getInstance()->newEvent(
                'reports',
                'reports.export',
                $actorUserId,
                1,
                'job_id=' . $jobId . ' report_key=' . $reportKey . ' row_count=' . $csv['row_count']
            );

            return true;
        } catch (\Throwable $e) {
            if ((int) ($row['attempts'] ?? 0) >= self::MAX_ATTEMPTS) {
                // Out of retries — give up.
                sqlStatement(
                    'UPDATE report_hub_export_run
                     SET status = ?, finished_at = ?, message = ?
                     WHERE id = ? AND status = ?',
                    ['failed', date('Y-m-d H:i:s'), mb_substr($e->getMessage(), 0, 480), $jobId, 'running']
                );
            } else {
                // Release the claim so the next worker pass re-attempts it.
                sqlStatement(
                    'UPDATE report_hub_export_run SET claimed_by = NULL WHERE id = ? AND status = ?',
                    [$jobId, 'running']
                );
            }

            return false;
        }
    }

    /** SCALE-2.3: storage owns the directory, permissions, and SEC-6 retention purge. */
    private function writeExportFile(int $jobId, string $filename, string $content): string
    {
        return $this->storage->put('job-' . $jobId . '-' . $filename, $content);
    }

    /**
     * @return array<string, mixed>
     */
    private function loadJobRow(int $jobId, int $actorUserId): array
    {
        if ($jobId <= 0) {
            throw new \InvalidArgumentException('job_id is required');
        }

        $this->ensureTableExists();
        $row = QueryUtils::querySingleRow(
            'SELECT * FROM report_hub_export_run WHERE id = ? LIMIT 1',
            [$jobId]
        );

        if (!is_array($row)) {
            throw new \RuntimeException('Export job not found', 404);
        }

        if ((int) ($row['actor_user_id'] ?? 0) !== $actorUserId) {
            throw new \RuntimeException('Forbidden', 403);
        }

        return $row;
    }

    private function assertReportKeyAllowed(string $reportKey, int $facilityId): void
    {
        $catalog = $this->catalog->getCatalog(null, $facilityId);
        $allowedKeys = array_map(
            static fn (array $card): string => (string) ($card['id'] ?? ''),
            $catalog['cards'] ?? []
        );

        if (!in_array($reportKey, $allowedKeys, true)) {
            throw new \RuntimeException('Report is not available for your role', 403);
        }

        $card = null;
        foreach ($catalog['cards'] as $row) {
            if (($row['id'] ?? '') === $reportKey) {
                $card = $row;
                break;
            }
        }

        if (!is_array($card)) {
            throw new \RuntimeException('Report is not available for your role', 403);
        }

        $lens = (string) ($card['lens'] ?? '');
        if ($lens !== '') {
            $this->access->assertLensAccess($lens);
        }
    }

    private function normalizeDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $str = trim((string) $value);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $str)) {
            throw new \InvalidArgumentException('date_from and date_to must be YYYY-MM-DD');
        }

        return $str;
    }

    private function ensureTableExists(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        sqlStatement(
            'CREATE TABLE IF NOT EXISTS `report_hub_export_run` (
                `id` BIGINT NOT NULL AUTO_INCREMENT,
                `facility_id` INT NOT NULL,
                `report_key` VARCHAR(64) NOT NULL,
                `date_from` DATE NULL,
                `date_to` DATE NULL,
                `row_count` INT NULL,
                `file_path` VARCHAR(512) NULL,
                `status` ENUM(\'ok\',\'failed\',\'running\') NOT NULL,
                `claimed_by` VARCHAR(64) NULL,
                `claimed_at` DATETIME NULL,
                `attempts` INT NOT NULL DEFAULT 0,
                `actor_user_id` BIGINT NOT NULL,
                `started_at` DATETIME NOT NULL,
                `finished_at` DATETIME NULL,
                `message` TEXT NULL,
                PRIMARY KEY (`id`),
                KEY `idx_facility_started` (`facility_id`, `started_at`),
                KEY `idx_report_key` (`report_key`)
            ) ENGINE=InnoDB COMMENT=\'M16 export audit (V1.1-REP)\''
        );

        self::$schemaEnsured = true;
    }
}
