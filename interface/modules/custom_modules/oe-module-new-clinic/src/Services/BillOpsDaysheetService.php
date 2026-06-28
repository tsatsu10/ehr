<?php

/**
 * M14-F03 — close-of-day daysheet and reconciliation summary
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class BillOpsDaysheetService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ReconciliationService $reconciliation = new ReconciliationService(),
        private readonly BillOpsAccessService $access = new BillOpsAccessService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getDaysheet(int $facilityId, string $runDate): array
    {
        $this->access->assertCloseAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $runDate = $this->normalizeDate($runDate);

        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        $receiptStats = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS receipt_count,
                    COALESCE(SUM(CASE WHEN r.reversed_at IS NULL THEN r.amount_paid ELSE 0 END), 0) AS cash_collected,
                    COALESCE(SUM(CASE WHEN r.reversed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS void_count
             FROM new_receipt r
             WHERE r.facility_id = ? AND DATE(r.created_at) = ?",
            [$facilityId, $runDate]
        ) ?: [];

        $noChargeRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM new_visit v
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND v.state = 'completed' AND v.closed_no_charge = 1",
            [$facilityId, $runDate]
        ) ?: [];

        $byCashier = QueryUtils::fetchRecords(
            "SELECT u.fname, u.lname,
                    COALESCE(SUM(CASE WHEN r.reversed_at IS NULL THEN r.amount_paid ELSE 0 END), 0) AS total
             FROM new_receipt r
             LEFT JOIN users u ON u.id = r.actor_user_id
             WHERE r.facility_id = ? AND DATE(r.created_at) = ?
             GROUP BY r.actor_user_id, u.fname, u.lname
             ORDER BY total DESC",
            [$facilityId, $runDate]
        ) ?: [];

        $byVisitType = QueryUtils::fetchRecords(
            "SELECT COALESCE(vt.label, 'Unknown') AS visit_type_label,
                    COALESCE(SUM(CASE WHEN r.reversed_at IS NULL THEN r.amount_paid ELSE 0 END), 0) AS total
             FROM new_receipt r
             INNER JOIN new_visit v ON v.id = r.visit_id
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE r.facility_id = ? AND DATE(r.created_at) = ?
             GROUP BY vt.label
             ORDER BY total DESC",
            [$facilityId, $runDate]
        ) ?: [];

        $totals = $this->reconciliation->fetchTotals($facilityId, $runDate);
        $tolerance = (float) ($this->config->get('reconciliation_tolerance', '0.01', $facilityId) ?? '0.01');
        $delta = ReconciliationService::calculateDelta(
            (float) ($totals['module_total'] ?? 0),
            (float) ($totals['core_total'] ?? 0)
        );
        $reconStatus = ReconciliationService::evaluateStatus(
            (float) ($totals['module_total'] ?? 0),
            (float) ($totals['core_total'] ?? 0),
            $tolerance
        );

        $latestRun = $this->reconciliation->getLatestRun($facilityId);
        $latestForDate = null;
        if (is_array($latestRun) && ($latestRun['run_date'] ?? '') === $runDate) {
            $latestForDate = [
                'id' => (int) ($latestRun['id'] ?? 0),
                'status' => (string) ($latestRun['status'] ?? ''),
                'delta_amount' => round((float) ($latestRun['delta_amount'] ?? 0), 2),
                'completed_at' => (string) ($latestRun['completed_at'] ?? ''),
            ];
        }

        return [
            'facility_id' => $facilityId,
            'date' => $runDate,
            'currency_symbol' => $currencySymbol,
            'receipt_count' => (int) ($receiptStats['receipt_count'] ?? 0),
            'void_count' => (int) ($receiptStats['void_count'] ?? 0),
            'no_charge_closes' => (int) ($noChargeRow['cnt'] ?? 0),
            'cash_collected' => round((float) ($receiptStats['cash_collected'] ?? 0), 2),
            'module_total' => (float) ($totals['module_total'] ?? 0),
            'core_total' => (float) ($totals['core_total'] ?? 0),
            'reconciliation' => [
                'status' => $reconStatus,
                'delta_amount' => $delta,
                'tolerance' => $tolerance,
                'latest_run' => $latestForDate,
            ],
            'by_cashier' => array_map(static function (array $row): array {
                $name = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));

                return [
                    'cashier' => $name !== '' ? $name : 'Unknown',
                    'total' => round((float) ($row['total'] ?? 0), 2),
                ];
            }, $byCashier),
            'by_visit_type' => array_map(static fn (array $row): array => [
                'visit_type_label' => (string) ($row['visit_type_label'] ?? ''),
                'total' => round((float) ($row['total'] ?? 0), 2),
            ], $byVisitType),
        ];
    }

    private function normalizeDate(string $runDate): string
    {
        $runDate = trim($runDate);
        if ($runDate === '') {
            return date('Y-m-d');
        }

        $parsed = \DateTime::createFromFormat('Y-m-d', $runDate);
        if (!$parsed || $parsed->format('Y-m-d') !== $runDate) {
            throw new \InvalidArgumentException('Invalid date');
        }

        return $runDate;
    }

    /**
     * @return array<string, mixed>
     */
    public function recordExport(int $facilityId, string $runDate, int $actorUserId): array
    {
        $payload = $this->getDaysheet($facilityId, $runDate);

        \OpenEMR\Common\Logging\EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'bill_ops.daysheet_exported',
            $actorUserId,
            1,
            'facility_id=' . ($payload['facility_id'] ?? 0) . ' date=' . ($payload['date'] ?? '')
        );

        return $payload;
    }
}
