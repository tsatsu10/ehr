<?php

/**
 * M14-F01 — post-payment charge corrections
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Billing\BillingUtilities;
use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class BillOpsChargeCorrectionService
{
    /** @var array<int, string> */
    private const CORRECTABLE_STATES = ['completed', 'closed_unpaid', 'ready_for_payment'];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly BillOpsAccessService $access = new BillOpsAccessService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitBoardService $boardService = new VisitBoardService(),
        private readonly FeeScheduleAdminService $feeSchedule = new FeeScheduleAdminService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getVisitCharges(int $visitId, int $actorUserId): array
    {
        $this->access->assertCorrectAccess();
        $visit = $this->queueService->getVisitForActor($visitId);
        $state = (string) ($visit['state'] ?? '');

        if (!in_array($state, self::CORRECTABLE_STATES, true)) {
            throw new \InvalidArgumentException('Visit is not eligible for charge correction');
        }

        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        $charges = $this->fetchEncounterCharges($pid, $encounter);
        $chargesTotal = CashierService::sumChargeLines($charges);
        $paidTotal = $this->sumPaidForVisit($visitId);
        $picker = $this->feeSchedule->listForDesk($facilityId);

        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        return [
            'visit' => $detail['visit'],
            'currency_symbol' => $currencySymbol,
            'charges' => $charges,
            'charges_total' => $chargesTotal,
            'paid_total' => $paidTotal,
            'balance_due' => round(max($chargesTotal - $paidTotal, 0), 2),
            'fee_schedule' => $picker,
            'can_apply_discount' => AclMain::aclCheckCore('new_clinic', 'new_discount'),
            'reopen_on_underpaid' => $this->config->getInt('bill_ops_reopen_on_correction', 0, $facilityId) === 1,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $addLines
     * @param array<int, int> $removeBillingIds
     * @return array<string, mixed>
     */
    public function applyCorrection(
        int $visitId,
        array $addLines,
        array $removeBillingIds,
        string $reason,
        int $actorUserId
    ): array {
        $this->access->assertCorrectAccess();
        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('Reason is required');
        }

        if ($addLines === [] && $removeBillingIds === []) {
            throw new \InvalidArgumentException('Add or remove at least one charge line');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $state = (string) ($visit['state'] ?? '');
        if (!in_array($state, self::CORRECTABLE_STATES, true)) {
            throw new \InvalidArgumentException('Visit is not eligible for charge correction');
        }

        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $providerId = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($providerId <= 0) {
            $providerId = $actorUserId;
        }

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';

        sqlBeginTrans();
        $committed = false;
        try {
            foreach ($this->normalizeAddLines($addLines, $facilityId) as $line) {
                $this->insertBillingLine(
                    $pid,
                    $encounter,
                    $providerId,
                    $line['code_type'],
                    $line['billing_code'],
                    $line['name'],
                    $line['units'],
                    $line['unit_price']
                );
            }

            // Only void charges that are currently active on this encounter, so a
            // stale client view can't toggle a line it never saw. pid+encounter
            // scoping already blocks cross-patient voids.
            $activeChargeIds = array_flip(array_map(
                static fn (array $r): int => (int) ($r['id'] ?? 0),
                QueryUtils::fetchRecords(
                    "SELECT id FROM billing WHERE pid = ? AND encounter = ? AND activity = 1",
                    [$pid, $encounter]
                ) ?: []
            ));

            foreach ($removeBillingIds as $billingId) {
                $billingId = (int) $billingId;
                if ($billingId <= 0 || !isset($activeChargeIds[$billingId])) {
                    continue;
                }
                sqlStatement(
                    "UPDATE billing SET activity = 0 WHERE id = ? AND pid = ? AND encounter = ?",
                    [$billingId, $pid, $encounter]
                );
            }

            sqlCommitTrans(true);
            $committed = true;
        } catch (\Throwable $e) {
            if (!$committed) {
                sqlCommitTrans(false);
            }
            throw $e;
        }

        $charges = $this->fetchEncounterCharges($pid, $encounter);
        $chargesTotal = CashierService::sumChargeLines($charges);
        $paidTotal = $this->sumPaidForVisit($visitId);

        if ($this->config->getInt('bill_ops_reopen_on_correction', 0, $facilityId) === 1
            && $state === 'completed'
            && $chargesTotal > $paidTotal + 0.001) {
            try {
                $this->queueService->transition(
                    $visitId,
                    'ready_for_payment',
                    $actorUserId,
                    (int) ($visit['version'] ?? 0),
                    'bill_ops_charge_corrected: ' . mb_substr($reason, 0, 180)
                );
            } catch (\Throwable) {
                /* best-effort reopen */
            }
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'bill_ops.charge_corrected',
            $actorUserId,
            1,
            'visit_id=' . $visitId . ' reason=' . mb_substr($reason, 0, 200)
        );

        return [
            'visit_id' => $visitId,
            'charges' => $charges,
            'charges_total' => $chargesTotal,
            'paid_total' => $paidTotal,
            'balance_due' => round(max($chargesTotal - $paidTotal, 0), 2),
        ];
    }

    private function sumPaidForVisit(int $visitId): float
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COALESCE(SUM(CASE WHEN reversed_at IS NULL THEN amount_paid ELSE 0 END), 0) AS paid
             FROM new_receipt WHERE visit_id = ?",
            [$visitId]
        );

        return round((float) (is_array($row) ? ($row['paid'] ?? 0) : 0), 2);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchEncounterCharges(int $pid, int $encounter): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, code_type, code, code_text, units, fee, modifier
             FROM billing
             WHERE pid = ? AND encounter = ? AND activity = 1
             ORDER BY id ASC",
            [$pid, $encounter]
        ) ?: [];

        return array_map(static function (array $row): array {
            $units = (int) ($row['units'] ?? 1);
            if ($units < 1) {
                $units = 1;
            }
            $fee = (float) ($row['fee'] ?? 0);

            return [
                'id' => (int) ($row['id'] ?? 0),
                'code_type' => (string) ($row['code_type'] ?? ''),
                'code' => (string) ($row['code'] ?? ''),
                'description' => (string) ($row['code_text'] ?? ''),
                'units' => $units,
                'unit_price' => $units > 0 ? round($fee / $units, 2) : $fee,
                'amount' => $fee,
            ];
        }, $rows);
    }

    /**
     * @param array<int, array<string, mixed>> $lines
     * @return array<int, array<string, mixed>>
     */
    private function normalizeAddLines(array $lines, int $facilityId): array
    {
        $normalized = [];
        $seenFeeIds = [];
        $canApplyDiscount = AclMain::aclCheckCore('new_clinic', 'new_discount');

        foreach ($lines as $line) {
            $feeId = (int) ($line['fee_schedule_id'] ?? 0);
            if ($feeId <= 0) {
                throw new \InvalidArgumentException('Invalid fee line');
            }
            if (isset($seenFeeIds[$feeId])) {
                throw new \InvalidArgumentException('Duplicate fee line in request');
            }
            $seenFeeIds[$feeId] = true;

            $feeRow = $this->feeSchedule->getActiveFeeForDesk($feeId, $facilityId);
            if (empty($feeRow)) {
                throw new \InvalidArgumentException('Fee line not found or inactive');
            }

            $units = (int) ($line['units'] ?? 1);
            if ($units < 1) {
                $units = 1;
            }

            $unitPrice = CashierChargeService::resolveChargeUnitPrice(
                (float) ($feeRow['price_amount'] ?? 0),
                array_key_exists('unit_price', $line),
                array_key_exists('unit_price', $line) ? (float) $line['unit_price'] : null,
                $canApplyDiscount
            );

            $normalized[] = [
                'code_type' => (string) ($feeRow['code_type'] ?? ''),
                'billing_code' => (string) ($feeRow['billing_code'] ?? ''),
                'name' => (string) ($feeRow['name'] ?? ''),
                'units' => $units,
                'unit_price' => $unitPrice,
            ];
        }

        return $normalized;
    }

    private function insertBillingLine(
        int $pid,
        int $encounter,
        int $providerId,
        string $codeType,
        string $billingCode,
        string $description,
        int $units,
        float $unitPrice
    ): void {
        $lineFee = round($unitPrice * $units, 2);
        $codeText = $description !== '' ? $description : $billingCode;

        BillingUtilities::addBilling(
            $encounter,
            $codeType,
            $billingCode,
            $codeText,
            $pid,
            '1',
            $providerId,
            '',
            (string) $units,
            (string) $lineFee,
            '',
            '',
            0,
            '',
            '',
            '',
            ''
        );
    }
}
