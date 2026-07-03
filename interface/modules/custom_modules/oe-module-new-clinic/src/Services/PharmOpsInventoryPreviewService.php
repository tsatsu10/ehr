<?php

/**
 * Shared QOH + FEFO lot preview for dispense and OTC façades (M13-F02 / M13-F04)
 *
 * Note: PRD lists `pharm_ops.stock_summary` as a standalone AJAX endpoint; V1.1 uses
 * encounter-level enrichment via PharmacyService / worklist rows instead (M13-F08 reports deferred).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\DrugSalesService;

class PharmOpsInventoryPreviewService
{
    /**
     * @return array<string, mixed>
     */
    public function previewForDrug(int $drugId, float $requestedQty, ?string $emptyDrugMessage = null): array
    {
        if ($drugId <= 0) {
            return [
                'on_hand' => 0,
                'can_fulfill' => false,
                'stock_status' => 'unknown',
                'fefo_lot' => null,
                'message' => $emptyDrugMessage ?? 'No in-house drug selected',
            ];
        }

        $onHandRow = QueryUtils::querySingleRow(
            'SELECT COALESCE(SUM(on_hand), 0) AS on_hand
             FROM drug_inventory
             WHERE drug_id = ? AND destroy_date IS NULL',
            [$drugId]
        );
        $onHand = is_array($onHandRow) ? (float) ($onHandRow['on_hand'] ?? 0) : 0.0;

        $lot = QueryUtils::querySingleRow(
            "SELECT di.lot_number, di.expiration, di.on_hand, di.warehouse_id, lo.title AS warehouse_title
             FROM drug_inventory di
             LEFT JOIN list_options lo
                ON lo.list_id = 'warehouse' AND lo.option_id = di.warehouse_id AND lo.activity = 1
             WHERE di.drug_id = ?
               AND di.destroy_date IS NULL
               AND di.on_hand > 0
               AND (di.expiration IS NULL OR di.expiration = '' OR di.expiration = '0000-00-00'
                    OR di.expiration > CURDATE())
             ORDER BY di.expiration ASC, di.lot_number ASC, di.inventory_id ASC
             LIMIT 1",
            [$drugId]
        );

        $drugSales = new DrugSalesService();
        $expiredLots = false;
        $canFulfill = $drugSales->sellDrug(
            $drugId,
            $requestedQty,
            0,
            0,
            0,
            0,
            '',
            '',
            '',
            true,
            $expiredLots
        );

        return [
            'on_hand' => (int) round($onHand),
            'can_fulfill' => $canFulfill,
            'stock_status' => $onHand > 0 ? 'in_stock' : 'out_of_stock',
            'fefo_lot' => is_array($lot) ? [
                'lot_number' => (string) ($lot['lot_number'] ?? ''),
                'expiration' => (string) ($lot['expiration'] ?? ''),
                'on_hand' => (int) round((float) ($lot['on_hand'] ?? 0)),
                'warehouse' => (string) ($lot['warehouse_title'] ?? $lot['warehouse_id'] ?? ''),
            ] : null,
            'message' => $canFulfill ? null : ($expiredLots
                ? 'Expired lots detected — check inventory'
                : 'Insufficient stock for requested quantity'),
        ];
    }
}
