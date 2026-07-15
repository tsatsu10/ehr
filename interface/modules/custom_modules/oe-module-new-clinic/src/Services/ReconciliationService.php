<?php

/**
 * Cashier reconciliation — module receipts vs core payments (M7-F10, §16.2)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ReconciliationService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public static function evaluateStatus(float $moduleTotal, float $coreTotal, float $tolerance): string
    {
        return self::calculateDelta($moduleTotal, $coreTotal) <= $tolerance ? 'ok' : 'warning';
    }

    public static function calculateDelta(float $moduleTotal, float $coreTotal): float
    {
        return round(abs($moduleTotal - $coreTotal), 2);
    }

    /**
     * @return array<string, mixed>
     */
    public function run(int $facilityId, string $runDate, string $trigger = 'manual', ?int $actorUserId = null): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $runDate = self::normalizeRunDate($runDate);
        $trigger = $trigger === 'scheduled' ? 'scheduled' : 'manual';

        if ($this->config->getInt('reconciliation_enabled', 1, $facilityId) !== 1 && $trigger === 'scheduled') {
            return [
                'skipped' => true,
                'reason' => 'reconciliation_disabled',
                'facility_id' => $facilityId,
                'run_date' => $runDate,
            ];
        }

        $tolerance = (float) ($this->config->get('reconciliation_tolerance', '0.01', $facilityId) ?? '0.01');
        $startedAt = date('Y-m-d H:i:s');

        try {
            $totals = $this->fetchTotals($facilityId, $runDate);
            $moduleTotal = (float) ($totals['module_total'] ?? 0);
            $coreTotal = (float) ($totals['core_total'] ?? 0);
            $delta = self::calculateDelta($moduleTotal, $coreTotal);
            $status = self::evaluateStatus($moduleTotal, $coreTotal, $tolerance);

            $runId = QueryUtils::sqlInsert(
                "INSERT INTO new_reconciliation_run
                 (facility_id, run_date, `trigger`, module_total_amount, core_total_amount,
                  delta_amount, status, started_at, completed_at, actor_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)",
                [
                    $facilityId,
                    $runDate,
                    $trigger,
                    $moduleTotal,
                    $coreTotal,
                    $delta,
                    $status,
                    $startedAt,
                    $trigger === 'manual' ? $actorUserId : null,
                ]
            );

            if ($status === 'warning') {
                $this->config->set('last_reconciliation_warning', $runDate, $facilityId);
            }

            $payload = [
                'id' => (int) $runId,
                'facility_id' => $facilityId,
                'run_date' => $runDate,
                'trigger' => $trigger,
                'module_total_amount' => $moduleTotal,
                'core_total_amount' => $coreTotal,
                'delta_amount' => $delta,
                'status' => $status,
                'tolerance' => $tolerance,
            ];

            $this->auditRun($payload, $actorUserId);

            return $payload;
        } catch (\Throwable $e) {
            QueryUtils::sqlInsert(
                "INSERT INTO new_reconciliation_run
                 (facility_id, run_date, `trigger`, module_total_amount, core_total_amount,
                  delta_amount, status, error_message, started_at, completed_at, actor_user_id)
                 VALUES (?, ?, ?, 0, 0, 0, 'error', ?, ?, NOW(), ?)",
                [
                    $facilityId,
                    $runDate,
                    $trigger,
                    mb_substr($e->getMessage(), 0, 2000),
                    $startedAt,
                    $trigger === 'manual' ? $actorUserId : null,
                ]
            );

            error_log('New Clinic reconciliation failed for facility ' . $facilityId . ': ' . $e->getMessage());

            throw $e;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function runAllEnabledFacilities(string $runDate, string $trigger = 'scheduled'): array
    {
        $runDate = self::normalizeRunDate($runDate);
        $seen = [];
        $results = [];

        foreach ($this->listReconciliationFacilityIds() as $facilityId) {
            $resolvedId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
            if (isset($seen[$resolvedId])) {
                continue;
            }
            $seen[$resolvedId] = true;

            if ($this->config->getInt('reconciliation_enabled', 1, $resolvedId) !== 1) {
                continue;
            }

            try {
                $results[] = $this->run($resolvedId, $runDate, $trigger, null);
            } catch (\Throwable $e) {
                $results[] = [
                    'facility_id' => $resolvedId,
                    'run_date' => $runDate,
                    'status' => 'error',
                    'error_message' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getLatestRun(int $facilityId): ?array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $row = QueryUtils::querySingleRow(
            "SELECT * FROM new_reconciliation_run
             WHERE facility_id = ?
             ORDER BY id DESC
             LIMIT 1",
            [$facilityId]
        );

        return is_array($row) && !empty($row['id']) ? $row : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getLatestRunForDate(int $facilityId, string $runDate): ?array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $runDate = self::normalizeRunDate($runDate);
        $row = QueryUtils::querySingleRow(
            "SELECT * FROM new_reconciliation_run
             WHERE facility_id = ? AND run_date = ?
             ORDER BY id DESC
             LIMIT 1",
            [$facilityId, $runDate]
        );

        return is_array($row) && !empty($row['id']) ? $this->formatRunRow($row) : null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listRecentRuns(int $facilityId, int $limit = 30): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $limit = max(1, min(30, $limit));
        $rows = QueryUtils::fetchRecords(
            "SELECT * FROM new_reconciliation_run
             WHERE facility_id = ?
             ORDER BY id DESC
             LIMIT " . $limit,
            [$facilityId]
        ) ?: [];

        return array_map(fn (array $row): array => $this->formatRunRow($row), $rows);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatRunRow(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'run_date' => (string) ($row['run_date'] ?? ''),
            'trigger' => (string) ($row['trigger'] ?? ''),
            'module_total' => round((float) ($row['module_total_amount'] ?? 0), 2),
            'core_total' => round((float) ($row['core_total_amount'] ?? 0), 2),
            'delta_amount' => round((float) ($row['delta_amount'] ?? 0), 2),
            'status' => (string) ($row['status'] ?? ''),
            'completed_at' => (string) ($row['completed_at'] ?? ''),
            'actor_user_id' => isset($row['actor_user_id']) ? (int) $row['actor_user_id'] : null,
        ];
    }

    /**
     * @return array{module_total: float, core_total: float}
     */
    public function fetchTotals(int $facilityId, string $runDate): array
    {
        // Half-open [runDate, nextDay) range so new_receipt's idx_receipt_facility_date
        // (facility_id, created_at) can be used — DATE(created_at) = ? wraps the column and
        // forces a scan of every receipt at this facility, not just the run date (same fix
        // already applied in BillOpsDaysheetService::getDaysheet(), which calls this method).
        $nextDay = date('Y-m-d', strtotime($runDate . ' +1 day'));

        $moduleRow = QueryUtils::querySingleRow(
            "SELECT COALESCE(SUM(r.amount_paid), 0) AS module_total
             FROM new_receipt r
             INNER JOIN new_visit v ON v.id = r.visit_id
             WHERE r.facility_id = ? AND r.created_at >= ? AND r.created_at < ? AND v.closed_no_charge = 0",
            [$facilityId, $runDate, $nextDay]
        );

        $coreRow = QueryUtils::querySingleRow(
            "SELECT COALESCE(SUM(COALESCE(p.amount1, 0) + COALESCE(p.amount2, 0)), 0) AS core_total
             FROM new_receipt r
             INNER JOIN new_visit v ON v.id = r.visit_id
             INNER JOIN payments p ON p.id = r.posted_payment_id
             WHERE r.facility_id = ? AND r.created_at >= ? AND r.created_at < ? AND v.closed_no_charge = 0
             AND r.posted_payment_id IS NOT NULL AND r.posted_payment_id > 0
             AND EXISTS (
                SELECT 1 FROM ar_activity aa
                WHERE aa.pid = r.pid AND aa.encounter = r.encounter
                AND aa.account_code = 'PP' AND aa.pay_amount > 0
             )",
            [$facilityId, $runDate, $nextDay]
        );

        return [
            'module_total' => round((float) ($moduleRow['module_total'] ?? 0), 2),
            'core_total' => round((float) ($coreRow['core_total'] ?? 0), 2),
        ];
    }

    /**
     * @return array<int, int>
     */
    private function listReconciliationFacilityIds(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT DISTINCT facility_id FROM new_clinic_config
             WHERE config_key = 'module_enabled' AND config_value = '1'
             UNION
             SELECT DISTINCT facility_id FROM new_visit
             WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             UNION
             SELECT 0"
        ) ?: [];

        $ids = [];
        foreach ($rows as $row) {
            $id = (int) ($row['facility_id'] ?? 0);
            if ($id >= 0) {
                $ids[$id] = $id;
            }
        }

        if ($ids === []) {
            $ids[0] = 0;
        }

        return array_values($ids);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function auditRun(array $payload, ?int $actorUserId): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'reconciliation',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'facility_id' => $payload['facility_id'] ?? 0,
                'run_date' => $payload['run_date'] ?? '',
                'status' => $payload['status'] ?? '',
                'delta_amount' => $payload['delta_amount'] ?? 0,
                'trigger' => $payload['trigger'] ?? '',
                'actor_user_id' => $actorUserId,
            ]),
            0
        );
    }

    private static function normalizeRunDate(string $runDate): string
    {
        $runDate = trim($runDate);
        if ($runDate === '') {
            return date('Y-m-d');
        }

        $timestamp = strtotime($runDate);

        return $timestamp !== false ? date('Y-m-d', $timestamp) : date('Y-m-d');
    }
}
