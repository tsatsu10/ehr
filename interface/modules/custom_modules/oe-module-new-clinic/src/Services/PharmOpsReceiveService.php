<?php

/**
 * M13 Pharmacy Operations Hub — receive stock / purchase lot façade
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmOpsReceiveService
{
    private const TRANS_TYPE_PURCHASE = 2;

    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getReceiveForm(?int $drugId = null): array
    {
        $this->access->assertHubAccess();

        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $warehouses = $this->loadWarehouses();
        $defaultWarehouseId = $this->resolveDefaultWarehouseId($warehouses);

        $drug = null;
        if ($drugId !== null && $drugId > 0) {
            $row = $this->loadDrugRow($drugId);
            $onHandRow = QueryUtils::querySingleRow(
                'SELECT COALESCE(SUM(on_hand), 0) AS on_hand
                 FROM drug_inventory
                 WHERE drug_id = ? AND destroy_date IS NULL',
                [$drugId]
            );
            $drug = [
                'drug_id' => $drugId,
                'drug_name' => PharmOpsOtcSaleService::formatDrugLabel($row),
                'on_hand' => is_array($onHandRow) ? (int) round((float) ($onHandRow['on_hand'] ?? 0)) : 0,
            ];
        }

        return [
            'warehouses' => $warehouses,
            'default_warehouse_id' => $defaultWarehouseId,
            'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
            'drug' => $drug,
            'can_receive' => $this->access->canReceive(),
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveReceive(array $body, int $actorUserId): array
    {
        $this->access->assertReceiveAccess();

        $drugId = (int) ($body['drug_id'] ?? 0);
        $warehouseId = trim((string) ($body['warehouse_id'] ?? ''));
        $lotNumber = trim((string) ($body['lot_number'] ?? ''));
        $expiration = trim((string) ($body['expiration'] ?? ''));
        $manufacturer = trim((string) ($body['manufacturer'] ?? ''));
        $quantity = (float) ($body['quantity'] ?? 0);
        $unitCost = (float) ($body['unit_cost'] ?? 0);
        $notes = trim((string) ($body['notes'] ?? ''));

        if ($drugId <= 0) {
            throw new \InvalidArgumentException('Product is required');
        }
        if ($warehouseId === '') {
            throw new \InvalidArgumentException('Warehouse is required');
        }
        if ($lotNumber === '') {
            throw new \InvalidArgumentException('Lot number is required');
        }
        if ($expiration === '' || str_starts_with($expiration, '0000')) {
            throw new \InvalidArgumentException('Expiration date is required for purchase lots');
        }
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Quantity must be greater than zero');
        }
        if ($unitCost < 0) {
            throw new \InvalidArgumentException('Unit cost cannot be negative');
        }

        $this->loadDrugRow($drugId);
        $warehouses = $this->loadWarehouses();
        if (!$this->warehouseExists($warehouses, $warehouseId)) {
            throw new \InvalidArgumentException('Invalid warehouse');
        }

        $totalCost = round($unitCost * $quantity, 2);
        $lotId = $this->resolveOrCreateLot(
            $drugId,
            $warehouseId,
            $lotNumber,
            $expiration,
            $manufacturer,
            $quantity
        );

        $saleDate = date('Y-m-d');
        $user = (string) ($_SESSION['authUser'] ?? '');
        $saleId = (int) QueryUtils::sqlInsert(
            'INSERT INTO drug_sales (
                drug_id, inventory_id, prescription_id, pid, encounter, user, sale_date,
                quantity, fee, xfer_inventory_id, distributor_id, notes, trans_type
             ) VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?, 0, 0, ?, ?)',
            [
                $drugId,
                $lotId,
                $user,
                $saleDate,
                (0 - $quantity),
                (0 - $totalCost),
                $notes,
                self::TRANS_TYPE_PURCHASE,
            ]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.stock_received',
            $actorUserId,
            1,
            'sale_id=' . $saleId
                . ' drug_id=' . $drugId
                . ' inventory_id=' . $lotId
                . ' lot=' . $lotNumber
                . ' qty=' . $quantity
        );

        $onHandRow = QueryUtils::querySingleRow(
            'SELECT COALESCE(SUM(on_hand), 0) AS on_hand
             FROM drug_inventory
             WHERE drug_id = ? AND destroy_date IS NULL',
            [$drugId]
        );
        $onHand = is_array($onHandRow) ? (int) round((float) ($onHandRow['on_hand'] ?? 0)) : 0;

        return [
            'sale_id' => $saleId,
            'inventory_id' => $lotId,
            'drug_id' => $drugId,
            'lot_number' => $lotNumber,
            'quantity' => $quantity,
            'on_hand' => $onHand,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadWarehouses(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title
             FROM list_options
             WHERE list_id = 'warehouse' AND activity = 1
             ORDER BY seq, title, option_id"
        ) ?: [];

        $warehouses = [];
        foreach ($rows as $row) {
            $id = trim((string) ($row['option_id'] ?? ''));
            if ($id === '') {
                continue;
            }
            $warehouses[] = [
                'id' => $id,
                'title' => trim((string) ($row['title'] ?? $id)),
            ];
        }

        return $warehouses;
    }

    /**
     * @param array<int, array<string, mixed>> $warehouses
     */
    private function resolveDefaultWarehouseId(array $warehouses): string
    {
        $globalWarehouse = trim((string) ($GLOBALS['gbl_warehouse_id'] ?? ''));
        if ($globalWarehouse !== '' && $this->warehouseExists($warehouses, $globalWarehouse)) {
            return $globalWarehouse;
        }

        return (string) ($warehouses[0]['id'] ?? '');
    }

    /**
     * @param array<int, array<string, mixed>> $warehouses
     */
    private function warehouseExists(array $warehouses, string $warehouseId): bool
    {
        foreach ($warehouses as $warehouse) {
            if ((string) ($warehouse['id'] ?? '') === $warehouseId) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadDrugRow(int $drugId): array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT drug_id, name, size, unit FROM drugs WHERE drug_id = ? AND active = 1 LIMIT 1',
            [$drugId]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Product not found');
        }

        return $row;
    }

    private function resolveOrCreateLot(
        int $drugId,
        string $warehouseId,
        string $lotNumber,
        string $expiration,
        string $manufacturer,
        float $quantity
    ): int {
        $existing = QueryUtils::querySingleRow(
            'SELECT inventory_id, on_hand, expiration, manufacturer
             FROM drug_inventory
             WHERE drug_id = ?
               AND warehouse_id = ?
               AND lot_number = ?
               AND destroy_date IS NULL
               AND on_hand != 0
             ORDER BY inventory_id DESC
             LIMIT 1',
            [$drugId, $warehouseId, $lotNumber]
        );

        if (is_array($existing)) {
            $lotId = (int) ($existing['inventory_id'] ?? 0);
            $expirationValue = $expiration !== '' ? $expiration : ($existing['expiration'] ?? null);
            $manufacturerValue = $manufacturer !== '' ? $manufacturer : ($existing['manufacturer'] ?? '');
            QueryUtils::sqlStatementThrowException(
                'UPDATE drug_inventory
                 SET lot_number = ?, manufacturer = ?, expiration = ?, warehouse_id = ?, on_hand = on_hand + ?
                 WHERE drug_id = ? AND inventory_id = ?',
                [
                    $lotNumber,
                    $manufacturerValue,
                    $expirationValue,
                    $warehouseId,
                    $quantity,
                    $drugId,
                    $lotId,
                ]
            );

            return $lotId;
        }

        $duplicate = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt
             FROM drug_inventory
             WHERE lot_number = ?
               AND drug_id = ?
               AND warehouse_id = ?
               AND expiration = ?
               AND on_hand != 0
               AND destroy_date IS NULL',
            [$lotNumber, $drugId, $warehouseId, $expiration]
        );
        if (is_array($duplicate) && (int) ($duplicate['cnt'] ?? 0) > 0) {
            throw new \InvalidArgumentException('A matching lot already exists — use a different lot number or expiry');
        }

        return (int) QueryUtils::sqlInsert(
            'INSERT INTO drug_inventory (drug_id, lot_number, manufacturer, expiration, vendor_id, warehouse_id, on_hand)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $drugId,
                $lotNumber,
                $manufacturer,
                $expiration,
                '',
                $warehouseId,
                $quantity,
            ]
        );
    }
}
