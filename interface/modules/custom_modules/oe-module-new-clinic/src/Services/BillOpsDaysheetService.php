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
        // Half-open [runDate, nextDay) range so the created_at index can be used
        // (DATE(created_at) = ? wraps the column and forces a scan).
        $nextDay = date('Y-m-d', strtotime($runDate . ' +1 day'));

        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        $receiptStats = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS receipt_count,
                    COALESCE(SUM(CASE WHEN r.reversed_at IS NULL THEN r.amount_paid ELSE 0 END), 0) AS cash_collected,
                    COALESCE(SUM(CASE WHEN r.reversed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS void_count
             FROM new_receipt r
             WHERE r.facility_id = ? AND r.created_at >= ? AND r.created_at < ?",
            [$facilityId, $runDate, $nextDay]
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
             WHERE r.facility_id = ? AND r.created_at >= ? AND r.created_at < ?
             GROUP BY r.actor_user_id, u.fname, u.lname
             ORDER BY total DESC",
            [$facilityId, $runDate, $nextDay]
        ) ?: [];

        $byVisitType = QueryUtils::fetchRecords(
            "SELECT COALESCE(vt.label, 'Unknown') AS visit_type_label,
                    COALESCE(SUM(CASE WHEN r.reversed_at IS NULL THEN r.amount_paid ELSE 0 END), 0) AS total
             FROM new_receipt r
             INNER JOIN new_visit v ON v.id = r.visit_id
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE r.facility_id = ? AND r.created_at >= ? AND r.created_at < ?
             GROUP BY vt.label
             ORDER BY total DESC",
            [$facilityId, $runDate, $nextDay]
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

        // The manual MoMo tally is locked once the day has been reconciled.
        $momoLocked = $latestForDate !== null;
        $momoRow = QueryUtils::querySingleRow(
            "SELECT d.momo_amount, d.note, d.updated_at, u.fname, u.lname
             FROM new_bill_ops_daysheet d
             LEFT JOIN users u ON u.id = d.updated_by
             WHERE d.facility_id = ? AND d.run_date = ?",
            [$facilityId, $runDate]
        );
        $momoUpdatedBy = null;
        if (is_array($momoRow)) {
            $momoUpdatedBy = trim(trim((string) ($momoRow['fname'] ?? '')) . ' ' . trim((string) ($momoRow['lname'] ?? '')));
            $momoUpdatedBy = $momoUpdatedBy !== '' ? $momoUpdatedBy : null;
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
            'momo_tally' => [
                'amount' => round((float) (is_array($momoRow) ? ($momoRow['momo_amount'] ?? 0) : 0), 2),
                'note' => (string) (is_array($momoRow) ? ($momoRow['note'] ?? '') : ''),
                'locked' => $momoLocked,
                'updated_by' => $momoUpdatedBy,
                'updated_at' => (string) (is_array($momoRow) ? ($momoRow['updated_at'] ?? '') : ''),
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

    /**
     * Save the manual MoMo tally for a facility-day. Refused once the day has
     * been reconciled (locked), so a closed daysheet can't be quietly edited.
     *
     * @return array<string, mixed>
     */
    public function saveMomoTally(int $facilityId, string $runDate, float $amount, string $note, int $actorUserId): array
    {
        $this->access->assertCloseAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $runDate = $this->normalizeDate($runDate);

        if ($amount < 0) {
            throw new \InvalidArgumentException('Amount cannot be negative');
        }
        $amount = round($amount, 2);
        $note = mb_substr(trim($note), 0, 255);

        if ($this->reconciliation->getLatestRunForDate($facilityId, $runDate) !== null) {
            throw new \RuntimeException('This day is closed — the MoMo tally is locked.', 409);
        }

        QueryUtils::sqlStatementThrowException(
            "INSERT INTO new_bill_ops_daysheet (facility_id, run_date, momo_amount, note, updated_by, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE momo_amount = VALUES(momo_amount), note = VALUES(note),
                                     updated_by = VALUES(updated_by), updated_at = NOW()",
            [$facilityId, $runDate, $amount, $note !== '' ? $note : null, $actorUserId]
        );

        \OpenEMR\Common\Logging\EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'bill_ops.momo_tally_saved',
            $actorUserId,
            1,
            'facility_id=' . $facilityId . ' date=' . $runDate . ' amount=' . $amount
        );

        return [
            'facility_id' => $facilityId,
            'date' => $runDate,
            'amount' => $amount,
            'note' => $note,
            'locked' => false,
        ];
    }
}
