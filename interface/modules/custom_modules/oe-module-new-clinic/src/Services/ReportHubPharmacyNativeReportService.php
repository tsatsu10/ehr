<?php

/**
 * M16 native pharmacy inventory reports (transactions + activity summary)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportHubPharmacyNativeReportService
{
    public const KEY_INVENTORY_TRANSACTIONS = 'pharm_inventory_transactions';

    public const KEY_INVENTORY_ACTIVITY = 'pharm_inventory_activity';

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isPharmacyKey(string $reportKey): bool
    {
        return in_array($reportKey, [
            self::KEY_INVENTORY_TRANSACTIONS,
            self::KEY_INVENTORY_ACTIVITY,
        ], true);
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    public function runReport(
        string $reportKey,
        ?string $dateFrom,
        ?string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
        return match ($reportKey) {
            self::KEY_INVENTORY_TRANSACTIONS => $this->runInventoryTransactions(
                $dateFrom,
                $dateTo,
                $limit,
                $offset,
                $facilityId
            ),
            self::KEY_INVENTORY_ACTIVITY => $this->runInventoryActivity(
                $dateFrom,
                $dateTo,
                $limit,
                $offset,
                $facilityId
            ),
            default => throw new \InvalidArgumentException('Unsupported pharmacy native report'),
        };
    }

    public function countRows(
        string $reportKey,
        ?string $dateFrom,
        ?string $dateTo,
        int $facilityId,
    ): int {
        return match ($reportKey) {
            self::KEY_INVENTORY_TRANSACTIONS => $this->countInventoryTransactions($dateFrom, $dateTo, $facilityId),
            self::KEY_INVENTORY_ACTIVITY => $this->countInventoryActivity($dateFrom, $dateTo, $facilityId),
            default => 0,
        };
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    private function runInventoryTransactions(
        ?string $dateFrom,
        ?string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
        $columns = [
            'Date',
            'Transaction',
            'Product',
            'Lot',
            'Warehouse',
            'Who',
            'Qty',
            'Amount',
            'Billed',
            'Notes',
        ];

        $total = $this->countInventoryTransactions($dateFrom, $dateTo, $facilityId);
        [$whereSql, $bind, $inventoryJoin] = $this->transactionWhere($dateFrom, $dateTo, $facilityId);

        $sql = "SELECT s.sale_date, s.fee, s.quantity, s.pid, s.encounter, s.billed, s.notes,
                       s.distributor_id, s.xfer_inventory_id,
                       p.fname AS pfname, p.mname AS pmname, p.lname AS plname,
                       u.fname AS dfname, u.mname AS dmname, u.lname AS dlname, u.organization,
                       d.name, fe.invoice_refno,
                       i1.lot_number, lo1.title AS warehouse
                FROM drug_sales AS s
                JOIN drugs AS d ON d.drug_id = s.drug_id
                {$inventoryJoin} JOIN drug_inventory AS i1 ON i1.inventory_id = s.inventory_id
                LEFT JOIN patient_data AS p ON p.pid = s.pid
                LEFT JOIN users AS u ON u.id = s.distributor_id
                LEFT JOIN list_options AS lo1 ON lo1.list_id = 'warehouse'
                    AND lo1.option_id = i1.warehouse_id AND lo1.activity = 1
                LEFT JOIN form_encounter AS fe ON fe.pid = s.pid AND fe.encounter = s.encounter
                WHERE {$whereSql}
                ORDER BY s.sale_date, s.sale_id
                LIMIT " . max(1, $limit) . ' OFFSET ' . max(0, $offset);

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $rows = [];
        foreach ($records as $record) {
            $rows[] = $this->mapTransactionRow($record);
        }

        return [
            'columns' => $columns,
            'rows' => $rows,
            'total' => $total,
        ];
    }

    /**
     * @param array<string, mixed> $record
     * @return list<string>
     */
    private function mapTransactionRow(array $record): array
    {
        $who = '';
        if (!empty($record['pid'])) {
            $who = trim((string) ($record['plname'] ?? ''));
            if (!empty($record['pfname'])) {
                $who .= ($who !== '' ? ', ' : '') . (string) $record['pfname'];
                if (!empty($record['pmname'])) {
                    $who .= ' ' . (string) $record['pmname'];
                }
            }
        } elseif (!empty($record['distributor_id'])) {
            $who = (string) ($record['organization'] ?? '');
            if ($who === '') {
                $who = trim((string) ($record['dlname'] ?? ''));
                if (!empty($record['dfname'])) {
                    $who .= ($who !== '' ? ', ' : '') . (string) $record['dfname'];
                }
            }
        }

        return [
            (string) ($record['sale_date'] ?? ''),
            $this->transactionType($record),
            (string) ($record['name'] ?? ''),
            (string) ($record['lot_number'] ?? ''),
            (string) ($record['warehouse'] ?? ''),
            $who,
            (string) (0 - (float) ($record['quantity'] ?? 0)),
            number_format((float) ($record['fee'] ?? 0), 2, '.', ''),
            !empty($record['billed']) ? '*' : '',
            (string) ($record['notes'] ?? ''),
        ];
    }

    /**
     * @param array<string, mixed> $record
     */
    private function transactionType(array $record): string
    {
        if (!empty($record['pid'])) {
            return 'Sale';
        }
        if (!empty($record['distributor_id'])) {
            return 'Distribution';
        }
        if (!empty($record['xfer_inventory_id'])) {
            return 'Transfer';
        }
        if ((float) ($record['fee'] ?? 0) != 0.0) {
            return 'Purchase';
        }

        return 'Adjustment';
    }

    private function countInventoryTransactions(?string $dateFrom, ?string $dateTo, int $facilityId): int
    {
        [$whereSql, $bind, $inventoryJoin] = $this->transactionWhere($dateFrom, $dateTo, $facilityId);
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM drug_sales AS s
             JOIN drugs AS d ON d.drug_id = s.drug_id
             {$inventoryJoin} JOIN drug_inventory AS i1 ON i1.inventory_id = s.inventory_id
             WHERE {$whereSql}",
            $bind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    private function runInventoryActivity(
        ?string $dateFrom,
        ?string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
        $columns = [
            'Product',
            'Warehouse',
            'Start',
            'Sales',
            'Distributions',
            'Purchases',
            'Transfers',
            'Adjustments',
            'End',
        ];

        $groups = $this->buildActivityGroups($dateFrom, $dateTo, $facilityId);
        $total = count($groups);
        $slice = array_slice($groups, $offset, $limit);
        $rows = [];
        foreach ($slice as $group) {
            $rows[] = [
                (string) $group['product'],
                (string) $group['warehouse'],
                (string) $group['start'],
                (string) $group['sales'],
                (string) $group['distributions'],
                (string) $group['purchases'],
                (string) $group['transfers'],
                (string) $group['adjustments'],
                (string) $group['end'],
            ];
        }

        return [
            'columns' => $columns,
            'rows' => $rows,
            'total' => $total,
        ];
    }

    private function countInventoryActivity(?string $dateFrom, ?string $dateTo, int $facilityId): int
    {
        return count($this->buildActivityGroups($dateFrom, $dateTo, $facilityId));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildActivityGroups(?string $dateFrom, ?string $dateTo, int $facilityId): array
    {
        [$whereSql, $bind, $inventoryJoin] = $this->transactionWhere($dateFrom, $dateTo, $facilityId);
        $sql = "SELECT s.quantity, s.fee, s.pid, s.distributor_id, s.xfer_inventory_id,
                       d.drug_id, d.name AS drug_name,
                       i1.warehouse_id, lo1.title AS warehouse
                FROM drug_sales AS s
                JOIN drugs AS d ON d.drug_id = s.drug_id
                {$inventoryJoin} JOIN drug_inventory AS i1 ON i1.inventory_id = s.inventory_id
                LEFT JOIN list_options AS lo1 ON lo1.list_id = 'warehouse'
                    AND lo1.option_id = i1.warehouse_id AND lo1.activity = 1
                WHERE {$whereSql}
                ORDER BY d.name, lo1.title";

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];
        /** @var array<string, array<string, mixed>> $groups */
        $groups = [];

        foreach ($records as $record) {
            $drugId = (int) ($record['drug_id'] ?? 0);
            $warehouseId = (string) ($record['warehouse_id'] ?? '');
            $key = $drugId . '|' . $warehouseId;
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'drug_id' => $drugId,
                    'warehouse_id' => $warehouseId,
                    'product' => (string) ($record['drug_name'] ?? 'Unnamed Product'),
                    'warehouse' => (string) ($record['warehouse'] ?? 'None'),
                    'sales' => 0,
                    'distributions' => 0,
                    'purchases' => 0,
                    'transfers' => 0,
                    'adjustments' => 0,
                ];
            }

            $qty = 0 - (float) ($record['quantity'] ?? 0);
            if (!empty($record['pid'])) {
                $groups[$key]['sales'] += $qty;
            } elseif (!empty($record['distributor_id'])) {
                $groups[$key]['distributions'] += $qty;
            } elseif (!empty($record['xfer_inventory_id'])) {
                $groups[$key]['transfers'] += $qty;
            } elseif ((float) ($record['fee'] ?? 0) != 0.0) {
                $groups[$key]['purchases'] += $qty;
            } else {
                $groups[$key]['adjustments'] += $qty;
            }
        }

        $toDate = $dateTo ?? date('Y-m-d');
        $result = [];
        foreach ($groups as $group) {
            $end = $this->endInventoryForDrugWarehouse(
                (int) $group['drug_id'],
                (string) $group['warehouse_id'],
                $toDate
            );
            $movement = $group['sales'] + $group['distributions'] + $group['purchases']
                + $group['transfers'] + $group['adjustments'];
            $group['end'] = $end;
            $group['start'] = $end - $movement;
            $result[] = $group;
        }

        usort($result, static function (array $a, array $b): int {
            $product = strcmp((string) $a['product'], (string) $b['product']);
            if ($product !== 0) {
                return $product;
            }

            return strcmp((string) $a['warehouse'], (string) $b['warehouse']);
        });

        return $result;
    }

    private function endInventoryForDrugWarehouse(int $drugId, string $warehouseId, string $toDate): float
    {
        $whBind = [];
        $whSql = '1=1';
        if ($warehouseId !== '') {
            $whSql = 'di.warehouse_id = ?';
            $whBind[] = $warehouseId;
        } else {
            $whSql = "(di.warehouse_id IS NULL OR di.warehouse_id = '')";
        }

        $eirow = QueryUtils::querySingleRow(
            "SELECT SUM(di.on_hand) AS on_hand
             FROM drug_inventory AS di
             WHERE di.drug_id = ?
               AND (di.destroy_date IS NULL OR di.destroy_date > ?)
               AND {$whSql}",
            array_merge([$drugId, $toDate], $whBind)
        );

        $sarow = QueryUtils::querySingleRow(
            "SELECT SUM(ds.quantity) AS quantity
             FROM drug_sales AS ds
             INNER JOIN drug_inventory AS di ON di.inventory_id = ds.inventory_id
             WHERE ds.sale_date > ?
               AND di.drug_id = ?
               AND {$whSql}",
            array_merge([$toDate, $drugId], $whBind)
        );

        $xfrow = QueryUtils::querySingleRow(
            "SELECT SUM(ds.quantity) AS quantity
             FROM drug_sales AS ds
             INNER JOIN drug_inventory AS di ON di.inventory_id = ds.xfer_inventory_id
             WHERE ds.sale_date > ?
               AND di.drug_id = ?
               AND {$whSql}",
            array_merge([$toDate, $drugId], $whBind)
        );

        $onHand = is_array($eirow) ? (float) ($eirow['on_hand'] ?? 0) : 0.0;
        $salesAfter = is_array($sarow) ? (float) ($sarow['quantity'] ?? 0) : 0.0;
        $xferAfter = is_array($xfrow) ? (float) ($xfrow['quantity'] ?? 0) : 0.0;

        return $onHand + $salesAfter - $xferAfter;
    }

    /**
     * @return array{0: string, 1: list<mixed>, 2: string}
     */
    private function transactionWhere(?string $dateFrom, ?string $dateTo, int $facilityId): array
    {
        $parts = ['1=1'];
        $bind = [];
        if ($dateFrom !== null) {
            $parts[] = 's.sale_date >= ?';
            $bind[] = $dateFrom;
        }
        if ($dateTo !== null) {
            $parts[] = 's.sale_date <= ?';
            $bind[] = $dateTo;
        }

        $warehouseId = $this->resolveFacilityWarehouseId($facilityId);
        $inventoryJoin = 'LEFT';
        if ($warehouseId !== null) {
            $parts[] = 'i1.warehouse_id = ?';
            $bind[] = $warehouseId;
            $inventoryJoin = 'INNER';
        }

        return [implode(' AND ', $parts), $bind, $inventoryJoin];
    }

    private function resolveFacilityWarehouseId(int $facilityId): ?string
    {
        if ($facilityId <= 0) {
            return null;
        }

        $warehouseId = trim((string) ($this->config->get('pharm_default_warehouse_id', '', $facilityId) ?? ''));
        if ($warehouseId === '') {
            $warehouseId = trim((string) ($GLOBALS['gbl_warehouse_id'] ?? ''));
        }

        return $warehouseId !== '' ? $warehouseId : null;
    }
}
