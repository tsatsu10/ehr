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
    // Vendor entries are address-book contacts (users table), the same store the core
    // add_edit_lot.php screen and the module's Directory tab (DirectoryContactService) use —
    // never a real staff login. abook_type = 'vendor' is the core option_id for suppliers.
    private const CONTACT_GUARD = "(username = '' OR username IS NULL)";

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
            // Supplier tracking (INV-7): existing vendor contacts; the form also lets the
            // pharmacist add a new one inline (a plain name is enough — full contact details
            // stay a Directory-tab job).
            'vendors' => $this->listVendors(),
            'can_receive' => $this->access->canReceive(),
        ];
    }

    /**
     * @return array<int, array{id: int, display_name: string}>
     */
    private function listVendors(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, organization, fname, lname
             FROM users
             WHERE abook_type = 'vendor' AND active = 1 AND " . self::CONTACT_GUARD . "
             ORDER BY COALESCE(NULLIF(organization, ''), CONCAT(lname, fname))"
        ) ?: [];

        $vendors = [];
        foreach ($rows as $row) {
            $organization = trim((string) ($row['organization'] ?? ''));
            $personName = trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
            $vendors[] = [
                'id' => (int) ($row['id'] ?? 0),
                'display_name' => $organization !== '' ? $organization : ($personName !== '' ? $personName : 'Supplier'),
            ];
        }

        return $vendors;
    }

    /**
     * Resolve a vendor id from the receive payload: an existing vendor_id, a brand-new supplier
     * name (created here as a company-type address-book contact), or 0 (supplier optional).
     *
     * @param array<string, mixed> $body
     */
    private function resolveVendorId(array $body, int $actorUserId): int
    {
        $newName = trim((string) ($body['new_vendor_name'] ?? ''));
        if ($newName !== '') {
            // Reuse an existing vendor with the same name (case-insensitive) instead of creating a
            // duplicate contact — a pharmacist retyping a supplier's name shouldn't fork the record.
            $existingByName = QueryUtils::querySingleRow(
                "SELECT id FROM users
                 WHERE abook_type = 'vendor' AND active = 1 AND " . self::CONTACT_GUARD . "
                   AND LOWER(organization) = LOWER(?)
                 LIMIT 1",
                [$newName]
            );
            if (is_array($existingByName) && (int) ($existingByName['id'] ?? 0) > 0) {
                return (int) $existingByName['id'];
            }

            return $this->createVendor($newName, $actorUserId);
        }

        $vendorId = (int) ($body['vendor_id'] ?? 0);
        if ($vendorId <= 0) {
            return 0;
        }
        $exists = QueryUtils::querySingleRow(
            "SELECT id FROM users WHERE id = ? AND abook_type = 'vendor' AND " . self::CONTACT_GUARD,
            [$vendorId]
        );

        return is_array($exists) ? $vendorId : 0;
    }

    private function createVendor(string $name, int $actorUserId): int
    {
        $organization = mb_substr($name, 0, 255);
        $vendorId = (int) QueryUtils::sqlInsert(
            "INSERT INTO users
                (username, password, authorized, active, abook_type, organization)
             VALUES ('', '', 0, 1, 'vendor', ?)",
            [$organization]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'directory_contact',
            $actorUserId,
            1,
            'created id=' . $vendorId . ' (pharmacy quick-add supplier)'
        );

        return $vendorId;
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
        // drug_inventory.lot_number is VARCHAR(20) and this install doesn't run in strict SQL
        // mode, so an over-length value would otherwise be silently truncated by MySQL — two
        // genuinely different long lot numbers could then collide on their shared 20-char prefix,
        // with no error shown. Reject it instead.
        if (mb_strlen($lotNumber) > 20) {
            throw new \InvalidArgumentException('Lot number must be 20 characters or fewer');
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

        // Supplier tracking (INV-7): optional — an existing vendor, a brand-new one typed in,
        // or none. Stored on both the lot (drug_inventory.vendor_id) and the purchase ledger row
        // (drug_sales.distributor_id) so "who supplied this" is traceable either way. On a restock
        // that doesn't specify a vendor, resolveOrCreateLot() carries forward the lot's existing
        // vendor rather than leaving it — the returned $vendorId reflects that carried-forward
        // value, so the new purchase-ledger row (the "last purchase" the reports read from) stays
        // in sync with the lot instead of going blank.
        $requestedVendorId = $this->resolveVendorId($body, $actorUserId);

        $totalCost = round($unitCost * $quantity, 2);
        [$lotId, $vendorId] = $this->resolveOrCreateLot(
            $drugId,
            $warehouseId,
            $lotNumber,
            $expiration,
            $manufacturer,
            $quantity,
            $requestedVendorId
        );

        $saleDate = date('Y-m-d');
        $user = (string) ($_SESSION['authUser'] ?? '');
        $saleId = (int) QueryUtils::sqlInsert(
            'INSERT INTO drug_sales (
                drug_id, inventory_id, prescription_id, pid, encounter, user, sale_date,
                quantity, fee, xfer_inventory_id, distributor_id, notes, trans_type
             ) VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?, 0, ?, ?, ?)',
            [
                $drugId,
                $lotId,
                $user,
                $saleDate,
                (0 - $quantity),
                (0 - $totalCost),
                $vendorId,
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

    /**
     * @return array{0: int, 1: int} [inventory_id, effective vendor_id]. On a restock the
     *         effective vendor is the requested one, or — when none was given — the lot's
     *         existing vendor, carried forward so the caller's purchase-ledger row stays in
     *         sync with the lot instead of recording "no supplier" for a supplier that's known.
     */
    private function resolveOrCreateLot(
        int $drugId,
        string $warehouseId,
        string $lotNumber,
        string $expiration,
        string $manufacturer,
        float $quantity,
        int $vendorId = 0
    ): array {
        $existing = QueryUtils::querySingleRow(
            'SELECT inventory_id, on_hand, expiration, manufacturer, vendor_id
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
            $effectiveVendorId = $vendorId > 0 ? $vendorId : (int) ($existing['vendor_id'] ?? 0);
            QueryUtils::sqlStatementThrowException(
                'UPDATE drug_inventory
                 SET lot_number = ?, manufacturer = ?, expiration = ?, warehouse_id = ?, on_hand = on_hand + ?,
                     vendor_id = ?
                 WHERE drug_id = ? AND inventory_id = ?',
                [
                    $lotNumber,
                    $manufacturerValue,
                    $expirationValue,
                    $warehouseId,
                    $quantity,
                    $effectiveVendorId,
                    $drugId,
                    $lotId,
                ]
            );

            return [$lotId, $effectiveVendorId];
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

        $lotId = (int) QueryUtils::sqlInsert(
            'INSERT INTO drug_inventory (drug_id, lot_number, manufacturer, expiration, vendor_id, warehouse_id, on_hand)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $drugId,
                $lotNumber,
                $manufacturer,
                $expiration,
                $vendorId,
                $warehouseId,
                $quantity,
            ]
        );

        return [$lotId, $vendorId];
    }
}
