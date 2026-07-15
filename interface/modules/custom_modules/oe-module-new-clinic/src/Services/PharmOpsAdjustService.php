<?php

/**
 * Pharmacy Ops — native stock adjustment (M13 inventory management)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmOpsAdjustService
{
    /** drug_sales.trans_type for a stock adjustment (matches core inventory reports). */
    private const TRANS_TYPE_ADJUSTMENT = 5;

    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
    ) {
    }

    /**
     * The drug_sales ledger quantity for an adjustment, matching the stock
     * report's sign convention: out = positive stored (displayed negative), in =
     * negative stored (displayed positive). Pure + static so the accounting-
     * sensitive sign is unit-testable without a DB.
     */
    public static function adjustmentQuantity(int $current, int $counted): int
    {
        return 0 - ($counted - $current);
    }

    /**
     * Set a lot's on-hand to a counted value, recording the change as an
     * adjustment ledger row (drug_sales.quantity = -(counted - current), fee 0),
     * matching the stock report's sign convention. Backs both the row-level
     * Adjust action and the stock-take flow. No-op (no ledger row) when unchanged.
     *
     * $expectedOnHand (optimistic concurrency): when provided, the write is
     * refused with a 409 if the lot's on-hand changed since the caller read it
     * (e.g. a dispense landed between a physical count and Apply), so a stale
     * count can't silently overwrite a real movement.
     *
     * @return array{inventory_id: int, drug_id: int, on_hand: int, delta: int}
     */
    public function adjustLot(
        int $inventoryId,
        int $countedOnHand,
        string $reason,
        int $actorUserId,
        ?int $expectedOnHand = null
    ): array {
        $this->access->assertReceiveAccess();

        $lot = QueryUtils::querySingleRow(
            'SELECT inventory_id, drug_id, lot_number, on_hand
             FROM drug_inventory
             WHERE inventory_id = ? AND destroy_date IS NULL',
            [$inventoryId]
        );
        if (!is_array($lot)) {
            throw new \InvalidArgumentException('Lot not found or already destroyed', 404);
        }

        $drugId = (int) ($lot['drug_id'] ?? 0);
        $current = (int) round((float) ($lot['on_hand'] ?? 0));

        if ($expectedOnHand !== null && $expectedOnHand !== $current) {
            throw new \RuntimeException(
                'Stock changed since it was read — recount this lot before adjusting.',
                409
            );
        }

        $counted = max(0, $countedOnHand);
        $delta = $counted - $current;
        $reason = mb_substr(trim($reason), 0, 250);

        if ($delta !== 0) {
            QueryUtils::sqlStatementThrowException(
                'UPDATE drug_inventory SET on_hand = ? WHERE inventory_id = ? AND destroy_date IS NULL',
                [$counted, $inventoryId]
            );

            $user = (string) ($_SESSION['authUser'] ?? '');
            $saleId = (int) QueryUtils::sqlInsert(
                'INSERT INTO drug_sales (
                    drug_id, inventory_id, prescription_id, pid, encounter, user, sale_date,
                    quantity, fee, xfer_inventory_id, distributor_id, notes, trans_type
                 ) VALUES (?, ?, 0, 0, 0, ?, ?, ?, 0, 0, 0, ?, ?)',
                [
                    $drugId,
                    $inventoryId,
                    $user,
                    date('Y-m-d'),
                    self::adjustmentQuantity($current, $counted),
                    $reason,
                    self::TRANS_TYPE_ADJUSTMENT,
                ]
            );

            EventAuditLogger::getInstance()->newEvent(
                'new_clinic',
                'pharmacy_ops.stock_adjusted',
                $actorUserId,
                1,
                'sale_id=' . $saleId
                    . ' inventory_id=' . $inventoryId
                    . ' drug_id=' . $drugId
                    . ' from=' . $current
                    . ' to=' . $counted
                    . ' delta=' . $delta
            );
        }

        return [
            'inventory_id' => $inventoryId,
            'drug_id' => $drugId,
            'on_hand' => $counted,
            'delta' => $delta,
        ];
    }
}
