<?php

/**
 * Post clinic fee schedule lines to encounter billing (M5-F02 / M5.2 step 2)
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

class CashierChargeService
{
    public function __construct(
        private readonly FeeScheduleAdminService $feeSchedule = new FeeScheduleAdminService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function buildPickerPayload(int $visitId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        return [
            'fee_schedule' => $this->feeSchedule->listForDesk($facilityId),
            'suggested_fees' => $this->feeSchedule->resolveVisitTypeSuggestions(
                (int) ($visit['visit_type_id'] ?? 0),
                $facilityId
            ),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $lines
     * @return array<string, mixed>
     */
    public function postCharges(int $visitId, array $lines, int $actorUserId): array
    {
        if (empty($lines)) {
            throw new \InvalidArgumentException('Select at least one charge line');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if (($visit['state'] ?? '') !== 'ready_for_payment') {
            throw new \InvalidArgumentException('Visit is not ready for payment');
        }

        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $providerId = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($providerId <= 0) {
            $providerId = $actorUserId;
        }

        $normalized = $this->normalizeLines($lines, $facilityId);
        $posted = 0;

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';
        sqlBeginTrans();
        $committed = false;
        try {
            foreach ($normalized as $line) {
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
                $posted++;
            }
            sqlCommitTrans(true);
            $committed = true;
        } catch (\Throwable $e) {
            if (!$committed) {
                sqlCommitTrans(false);
            }
            throw $e;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'cashier',
            $actorUserId,
            1,
            'visit_id=' . $visitId . ' charges_posted=' . $posted
        );

        return [
            'posted_count' => $posted,
            'charges' => $this->fetchEncounterCharges($pid, $encounter),
            'charges_total' => CashierService::sumChargeLines($this->fetchEncounterCharges($pid, $encounter)),
        ];
    }

    /**
     * Resolve posted unit price — client override requires new_discount ACL (M5).
     */
    public static function resolveChargeUnitPrice(
        float $schedulePrice,
        bool $hasClientPrice,
        ?float $clientPrice,
        bool $canApplyDiscount
    ): float {
        $schedulePrice = round($schedulePrice, 2);
        if ($hasClientPrice && $canApplyDiscount) {
            $unitPrice = round((float) $clientPrice, 2);
        } else {
            $unitPrice = $schedulePrice;
        }

        if ($unitPrice < 0) {
            throw new \InvalidArgumentException('Price cannot be negative');
        }

        return $unitPrice;
    }

    /**
     * @param array<int, array<string, mixed>> $lines
     * @return array<int, array<string, mixed>>
     */
    private function normalizeLines(array $lines, int $facilityId): array
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
            if ($units > 99) {
                throw new \InvalidArgumentException('Quantity cannot exceed 99');
            }

            $unitPrice = self::resolveChargeUnitPrice(
                (float) ($feeRow['price_amount'] ?? 0),
                array_key_exists('unit_price', $line),
                array_key_exists('unit_price', $line) ? (float) $line['unit_price'] : null,
                $canApplyDiscount
            );

            $normalized[] = [
                'fee_schedule_id' => $feeId,
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
}
