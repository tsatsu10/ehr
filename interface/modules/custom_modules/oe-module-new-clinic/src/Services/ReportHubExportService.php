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
