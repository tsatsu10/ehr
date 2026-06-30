<?php

/**
 * M13-F09 / M13-F11 — lot write-off (destruction) façade
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmOpsDestroyService
{
    public const LOT_EXPIRED = 'expired';
    public const LOT_EXPIRING_SOON = 'expiring_soon';

    public const DEFAULT_EXPIRY_WARN_DAYS = 90;

    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function resolveExpiryWarnDays(?int $facilityId = null): int
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $days = $this->config->getInt('pharm_expiry_warn_days', self::DEFAULT_EXPIRY_WARN_DAYS, $facilityId);

        return max(1, min(365, $days));
    }

    /**
     * Expiring/expiring-soon lots for the write-off worklist.
     *
     * Inventory lots are clinic-global in V1 (warehouse list_options are not facility-scoped).
     *
     * @return list<array<string, mixed>>
     */
    public function fetchWriteOffRows(int $warnDays): array
    {
        $sql = "SELECT di.inventory_id, di.drug_id, di.lot_number, di.manufacturer, di.on_hand,
                       di.expiration, di.warehouse_id, d.name AS drug_name,
                       lo.title AS warehouse_title
                FROM drug_inventory di
                INNER JOIN drugs d ON d.drug_id = di.drug_id AND d.active = 1
                LEFT JOIN list_options lo
                    ON lo.list_id = 'warehouse' AND lo.option_id = di.warehouse_id AND lo.activity = 1
                WHERE di.destroy_date IS NULL
                  AND di.on_hand > 0
                  AND di.expiration IS NOT NULL
                  AND di.expiration != ''
                  AND di.expiration NOT LIKE '0000-%'
                  AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
                ORDER BY di.expiration ASC, d.name ASC, di.lot_number ASC";

        return QueryUtils::fetchRecords($sql, [$warnDays]) ?: [];
    }

    /**
     * @param array<string, mixed> $raw
     * @return array<string, mixed>
     */
    public function mapWriteOffRow(array $raw, int $warnDays): array
    {
        $expiration = trim((string) ($raw['expiration'] ?? ''));
        $lotStatus = self::classifyLotExpiry($expiration, $warnDays);
        $drugId = (int) ($raw['drug_id'] ?? 0);
        $inventoryId = (int) ($raw['inventory_id'] ?? 0);
        $onHand = (int) round((float) ($raw['on_hand'] ?? 0));
        $warehouse = trim((string) ($raw['warehouse_title'] ?? $raw['warehouse_id'] ?? ''));

        $statusLabel = $lotStatus === self::LOT_EXPIRED ? 'Expired' : 'Expiring soon';

        return [
            'row_type' => PharmOpsWorklistService::TAB_WRITE_OFF,
            'drug_id' => $drugId,
            'inventory_id' => $inventoryId,
            'drug_name' => trim((string) ($raw['drug_name'] ?? 'Medication')),
            'lot_number' => trim((string) ($raw['lot_number'] ?? '')),
            'manufacturer' => trim((string) ($raw['manufacturer'] ?? '')),
            'on_hand' => $onHand,
            'expiration' => $expiration,
            'lot_status' => $lotStatus,
            'status_label' => $statusLabel,
            'warehouse' => $warehouse !== '' ? $warehouse : null,
            'qoh_display' => 'QOH ' . $onHand . ($expiration !== '' ? ' · exp ' . $expiration : ''),
        ];
    }

    /**
     * @return 'expired'|'expiring_soon'|null
     */
    public static function classifyLotExpiry(string $expiration, int $warnDays): ?string
    {
        $expiration = trim($expiration);
        if ($expiration === '' || str_starts_with($expiration, '0000')) {
            return null;
        }

        $expTs = strtotime($expiration);
        if ($expTs === false) {
            return null;
        }

        $today = strtotime(date('Y-m-d'));
        $warnEnd = strtotime('+' . max(0, $warnDays) . ' days', $today);

        if ($expTs < $today) {
            return self::LOT_EXPIRED;
        }

        if ($expTs <= $warnEnd) {
            return self::LOT_EXPIRING_SOON;
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    public function getDestroyForm(int $drugId, int $inventoryId): array
    {
        $this->access->assertDestroyAccess();

        $warnDays = $this->resolveExpiryWarnDays();
        $row = $this->loadActiveLotRow($drugId, $inventoryId);
        $this->assertLotEligibleForWriteOff($row, $warnDays);
        $mapped = $this->mapWriteOffRow($row, $warnDays);

        return [
            'drug_id' => $drugId,
            'inventory_id' => $inventoryId,
            'lot' => $mapped,
            'default_destroy_date' => date('Y-m-d'),
            'can_destroy' => true,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function confirmDestroy(array $body, int $actorUserId): array
    {
        $this->access->assertDestroyAccess();

        $drugId = (int) ($body['drug_id'] ?? 0);
        $inventoryId = (int) ($body['inventory_id'] ?? 0);
        $destroyDate = trim((string) ($body['destroy_date'] ?? ''));
        $method = trim((string) ($body['destroy_method'] ?? ''));
        $witness = trim((string) ($body['destroy_witness'] ?? ''));
        $notes = trim((string) ($body['destroy_notes'] ?? ''));

        if ($drugId <= 0 || $inventoryId <= 0) {
            throw new \InvalidArgumentException('Lot is required');
        }
        if ($destroyDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $destroyDate)) {
            throw new \InvalidArgumentException('Destruction date is required');
        }
        if (strtotime($destroyDate) > strtotime(date('Y-m-d'))) {
            throw new \InvalidArgumentException('Destruction date cannot be in the future');
        }
        if ($method === '') {
            throw new \InvalidArgumentException('Method of destruction is required');
        }
        if ($witness === '') {
            throw new \InvalidArgumentException('Witness is required');
        }

        $method = mb_substr($method, 0, 250);
        $witness = mb_substr($witness, 0, 250);
        $notes = mb_substr($notes, 0, 500);

        $warnDays = $this->resolveExpiryWarnDays();
        $row = $this->loadActiveLotRow($drugId, $inventoryId);
        $this->assertLotEligibleForWriteOff($row, $warnDays);

        // Matches core destroy_lot.php: marks lot destroyed; on_hand is not zeroed in this transaction.
        QueryUtils::sqlStatementThrowException(
            'UPDATE drug_inventory SET
                destroy_date = ?,
                destroy_method = ?,
                destroy_witness = ?,
                destroy_notes = ?
             WHERE drug_id = ? AND inventory_id = ? AND destroy_date IS NULL',
            [$destroyDate, $method, $witness, $notes, $drugId, $inventoryId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.lot_destroyed',
            $actorUserId,
            1,
            'inventory_id=' . $inventoryId
                . ' drug_id=' . $drugId
                . ' lot=' . ($row['lot_number'] ?? '')
                . ' witness=' . $witness
                . ' method=' . $method
        );

        return [
            'inventory_id' => $inventoryId,
            'drug_id' => $drugId,
            'lot_number' => (string) ($row['lot_number'] ?? ''),
            'destroy_date' => $destroyDate,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadActiveLotRow(int $drugId, int $inventoryId): array
    {
        if ($drugId <= 0 || $inventoryId <= 0) {
            throw new \InvalidArgumentException('Invalid lot');
        }

        $row = QueryUtils::querySingleRow(
            'SELECT di.*, d.name AS drug_name, lo.title AS warehouse_title
             FROM drug_inventory di
             INNER JOIN drugs d ON d.drug_id = di.drug_id
             LEFT JOIN list_options lo
                ON lo.list_id = \'warehouse\' AND lo.option_id = di.warehouse_id
             WHERE di.drug_id = ? AND di.inventory_id = ? AND di.destroy_date IS NULL
             LIMIT 1',
            [$drugId, $inventoryId]
        );

        if (!is_array($row)) {
            throw new \InvalidArgumentException('Lot not found or already destroyed');
        }

        if ((float) ($row['on_hand'] ?? 0) <= 0) {
            throw new \InvalidArgumentException('Lot has no quantity on hand');
        }

        return $row;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function assertLotEligibleForWriteOff(array $row, int $warnDays): void
    {
        $expiration = trim((string) ($row['expiration'] ?? ''));
        $status = self::classifyLotExpiry($expiration, $warnDays);
        if ($status === null) {
            throw new \InvalidArgumentException(
                'Only expired or expiring-soon lots can be written off from Pharmacy Operations'
            );
        }
    }
}
