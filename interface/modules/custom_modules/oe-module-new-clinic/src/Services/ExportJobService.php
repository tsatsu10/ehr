<?php

/**
 * Generic background export/import job runner (SCALE-2.2).
 *
 * Generalises the report-export worker (SCALE-2.1) to ANY heavy operation that
 * should not run inside a web request — cohort CSV exports, chart PDFs, etc. Each
 * job carries a `job_type` and a JSON param blob; the worker claims jobs atomically
 * (unique-token read-back, since affected-rows is unreliable under query logging),
 * dispatches by type to build a result file, and retries ≤3 before failing. The
 * status poll is a pure read, with a short inline fallback for hosts with no worker.
 *
 * Small results stay synchronous — the CALLER does the sync-vs-async row-count
 * pre-check and only enqueues when the work is genuinely heavy.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ExportJobService
{
    private const MAX_ATTEMPTS = 3;
    private const STALE_CLAIM_SECONDS = 300;
    private const INLINE_FALLBACK_AFTER_SECONDS = 10;
    /** PHI-bearing result files expire so they don't accumulate at rest (SEC-6). */
    private const RESULT_RETENTION_SECONDS = 86400;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * Enqueue a background job. Returns its id. The caller must have already
     * ACL-checked and decided the work is heavy enough to defer.
     *
     * @param array<string, mixed> $params
     */
    public function enqueue(string $jobType, array $params, int $facilityId, int $actorUserId): int
    {
        return (int) QueryUtils::sqlInsert(
            'INSERT INTO new_clinic_export_job
                (job_type, params_json, facility_id, actor_user_id, status, created_at)
             VALUES (?, ?, ?, ?, \'running\', ?)',
            [$jobType, (string) json_encode($params), $facilityId, $actorUserId, date('Y-m-d H:i:s')]
        );
    }

    /**
     * Worker entry (scripts/run-jobs.php): claim + process pending jobs until there
     * are none or the budget is hit.
     *
     * @return array{processed: int, failed: int}
     */
    public function runWorker(int $maxJobs = 20, int $maxSeconds = 55): array
    {
        $processed = 0;
        $failed = 0;
        $deadline = time() + max(1, $maxSeconds);
        while (($processed + $failed) < max(1, $maxJobs) && time() < $deadline) {
            $row = $this->claimJob();
            if ($row === null) {
                break;
            }
            if ($this->processJob($row)) {
                $processed++;
            } else {
                $failed++;
            }
        }

        return ['processed' => $processed, 'failed' => $failed];
    }

    /**
     * Pure-read status poll (+ short inline fallback when no worker is scheduled).
     *
     * @return array<string, mixed>
     */
    public function pollStatus(int $jobId, int $actorUserId): array
    {
        $row = $this->loadJobRow($jobId, $actorUserId);

        if (($row['status'] ?? '') === 'running' && $this->shouldRunInlineFallback($row)) {
            $claimed = $this->claimJob($jobId);
            if ($claimed !== null) {
                $this->processJob($claimed);
                $row = $this->loadJobRow($jobId, $actorUserId);
            }
        }

        $payload = [
            'job_id' => $jobId,
            'job_type' => (string) ($row['job_type'] ?? ''),
            'status' => (string) ($row['status'] ?? 'failed'),
            'row_count' => isset($row['row_count']) ? (int) $row['row_count'] : null,
            'message' => (string) ($row['message'] ?? ''),
        ];
        if ($payload['status'] === 'ok' && !empty($row['result_filename'])) {
            $payload['filename'] = (string) $row['result_filename'];
            $payload['ready'] = true;
        }

        return $payload;
    }

    /**
     * @return array{filename: string, content: string}
     */
    public function download(int $jobId, int $actorUserId): array
    {
        $row = $this->loadJobRow($jobId, $actorUserId);
        if (($row['status'] ?? '') !== 'ok') {
            throw new \RuntimeException('Export is not ready', 409);
        }
        $path = (string) ($row['result_path'] ?? '');
        if ($path === '' || !is_readable($path)) {
            throw new \RuntimeException('Export file is missing', 404);
        }
        $content = file_get_contents($path);
        if ($content === false) {
            throw new \RuntimeException('Unable to read export file', 500);
        }

        return [
            'filename' => (string) ($row['result_filename'] ?? basename($path)),
            'content' => $content,
        ];
    }

    /**
     * Atomically claim the next processable job (or a specific one), incrementing
     * attempts. Unique token + read-back (affected-rows is unreliable here).
     *
     * @return array<string, mixed>|null
     */
    private function claimJob(?int $onlyJobId = null): ?array
    {
        $token = bin2hex(random_bytes(16));
        $sql = "UPDATE new_clinic_export_job
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
            "SELECT * FROM new_clinic_export_job WHERE claimed_by = ? AND status = 'running' ORDER BY id LIMIT 1",
            [$token]
        );

        return is_array($row) ? $row : null;
    }

    /**
     * @param array<string, mixed> $row a CLAIMED job row
     */
    private function processJob(array $row): bool
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(0);
        }
        $jobId = (int) ($row['id'] ?? 0);
        $jobType = (string) ($row['job_type'] ?? '');
        $facilityId = (int) ($row['facility_id'] ?? 0);
        $params = json_decode((string) ($row['params_json'] ?? ''), true);
        $params = is_array($params) ? $params : [];

        try {
            $result = $this->buildResult($jobType, $params, $facilityId, (int) ($row['actor_user_id'] ?? 0));
            $path = $this->writeResultFile($jobId, (string) $result['filename'], (string) $result['content']);

            sqlStatement(
                'UPDATE new_clinic_export_job
                 SET status = ?, row_count = ?, result_path = ?, result_filename = ?, finished_at = ?, message = NULL
                 WHERE id = ? AND status = ?',
                ['ok', (int) ($result['row_count'] ?? 0), $path, basename($path), date('Y-m-d H:i:s'), $jobId, 'running']
            );

            EventAuditLogger::getInstance()->newEvent(
                'reports',
                'reports.export',
                (int) ($row['actor_user_id'] ?? 0),
                1,
                'export_job id=' . $jobId . ' type=' . $jobType . ' rows=' . (int) ($result['row_count'] ?? 0)
            );

            return true;
        } catch (\Throwable $e) {
            if ((int) ($row['attempts'] ?? 0) >= self::MAX_ATTEMPTS) {
                sqlStatement(
                    'UPDATE new_clinic_export_job SET status = ?, finished_at = ?, message = ? WHERE id = ? AND status = ?',
                    ['failed', date('Y-m-d H:i:s'), mb_substr($e->getMessage(), 0, 480), $jobId, 'running']
                );
            } else {
                // Release the claim so the next worker pass re-attempts it.
                sqlStatement(
                    'UPDATE new_clinic_export_job SET claimed_by = NULL WHERE id = ? AND status = ?',
                    [$jobId, 'running']
                );
            }

            return false;
        }
    }

    /**
     * Dispatch a job type to the service that builds its result file. New heavy
     * exports plug in here (and add a sync/async pre-check at their call site).
     *
     * @param array<string, mixed> $params
     * @return array{filename: string, content: string, row_count: int}
     */
    private function buildResult(string $jobType, array $params, int $facilityId, int $actorUserId): array
    {
        return match ($jobType) {
            'cohort_csv' => (new PatientCohortSearchService())->buildExportFile($params),
            default => throw new \RuntimeException('Unknown export job type: ' . $jobType),
        };
    }

    private function shouldRunInlineFallback(array $row): bool
    {
        if ($this->config->getInt('enable_inline_export_fallback', 1) !== 1) {
            return false;
        }
        if (!empty($row['claimed_by'])) {
            return false;
        }
        if ((int) ($row['attempts'] ?? 0) >= self::MAX_ATTEMPTS) {
            return false;
        }
        $createdAt = (string) ($row['created_at'] ?? '');
        $age = $createdAt !== '' ? (time() - (int) strtotime($createdAt)) : PHP_INT_MAX;

        return $age >= self::INLINE_FALLBACK_AFTER_SECONDS;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadJobRow(int $jobId, int $actorUserId): array
    {
        if ($jobId <= 0) {
            throw new \InvalidArgumentException('job_id is required');
        }
        $row = QueryUtils::querySingleRow('SELECT * FROM new_clinic_export_job WHERE id = ? LIMIT 1', [$jobId]);
        if (!is_array($row)) {
            throw new \RuntimeException('Export job not found', 404);
        }
        if ((int) ($row['actor_user_id'] ?? 0) !== $actorUserId) {
            throw new \RuntimeException('Forbidden', 403);
        }

        return $row;
    }

    private function writeResultFile(int $jobId, string $filename, string $content): string
    {
        $siteDir = $GLOBALS['OE_SITE_DIR'] ?? null;
        if (!is_string($siteDir) || $siteDir === '') {
            throw new \RuntimeException('Site directory is not configured');
        }
        $dir = $siteDir . '/documents/nc_export_jobs';
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new \RuntimeException('Unable to create export directory');
        }
        @chmod($dir, 0700);
        $this->purgeExpired($dir);

        $safe = preg_replace('/[^A-Za-z0-9._-]+/', '-', basename($filename)) ?: 'export.csv';
        $path = $dir . '/job-' . $jobId . '-' . $safe;
        if (file_put_contents($path, $content) === false) {
            throw new \RuntimeException('Unable to write export file');
        }
        @chmod($path, 0600);

        return $path;
    }

    private function purgeExpired(string $dir): void
    {
        $cutoff = time() - self::RESULT_RETENTION_SECONDS;
        foreach (glob($dir . '/job-*') ?: [] as $file) {
            if (is_file($file) && (int) @filemtime($file) < $cutoff) {
                @unlink($file);
            }
        }
    }
}
