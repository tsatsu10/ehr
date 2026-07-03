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

    public function __construct(
        private readonly ReportHubAccessService $access = new ReportHubAccessService(),
        private readonly ReportHubCatalogService $catalog = new ReportHubCatalogService(),
        private readonly ReportHubNativeReportService $nativeReports = new ReportHubNativeReportService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
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
            'reports.export_run',
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

        if (($row['status'] ?? '') === 'running') {
            $this->completeRunningJob($row, $actorUserId);
            $row = $this->loadJobRow($jobId, $actorUserId);
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
        if ($path === '' || !is_readable($path)) {
            throw new \RuntimeException('Export file is missing', 404);
        }

        $content = file_get_contents($path);
        if ($content === false) {
            throw new \RuntimeException('Unable to read export file', 500);
        }

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
     * @param array<string, mixed> $row
     */
    private function completeRunningJob(array $row, int $actorUserId): void
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
            $now = date('Y-m-d H:i:s');

            sqlStatement(
                'UPDATE report_hub_export_run
                 SET status = ?, row_count = ?, file_path = ?, finished_at = ?, message = NULL
                 WHERE id = ? AND status = ?',
                ['ok', $csv['row_count'], $path, $now, $jobId, 'running']
            );

            EventAuditLogger::getInstance()->newEvent(
                'reports',
                'reports.export',
                $actorUserId,
                1,
                'job_id=' . $jobId . ' report_key=' . $reportKey . ' row_count=' . $csv['row_count']
            );
        } catch (\Throwable $e) {
            $now = date('Y-m-d H:i:s');
            sqlStatement(
                'UPDATE report_hub_export_run
                 SET status = ?, finished_at = ?, message = ?
                 WHERE id = ? AND status = ?',
                ['failed', $now, $e->getMessage(), $jobId, 'running']
            );
        }
    }

    private function writeExportFile(int $jobId, string $filename, string $content): string
    {
        $dir = $this->exportDirectory();
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException('Unable to create export directory');
        }

        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '-', basename($filename)) ?: 'report.csv';
        $path = $dir . '/job-' . $jobId . '-' . $safeName;
        if (file_put_contents($path, $content) === false) {
            throw new \RuntimeException('Unable to write export file');
        }

        return $path;
    }

    private function exportDirectory(): string
    {
        $siteDir = $GLOBALS['OE_SITE_DIR'] ?? null;
        if (!is_string($siteDir) || $siteDir === '') {
            throw new \RuntimeException('Site directory is not configured');
        }

        return $siteDir . '/documents/nc_report_exports';
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
