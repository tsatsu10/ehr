<?php

/**
 * M13-F08 — stock inventory reports façade (embed core OpenEMR reports in hub)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PharmOpsReportsService
{
    public const REPORT_REORDER = 'reorder';
    public const REPORT_ACTIVITY = 'activity';
    public const REPORT_TRANSACTIONS = 'transactions';
    public const REPORT_DESTROYED = 'destroyed';
    public const REPORT_PRESCRIPTIONS = 'prescriptions';
    public const REPORT_CONTROLLED = 'controlled';

    /** Default sales-velocity window and target days-of-supply for the reorder report. */
    public const REORDER_WINDOW_DAYS = 90;
    public const REORDER_TARGET_DAYS = 30;
    /** Default lookback for the destroyed-drugs report. */
    public const DESTROYED_LOOKBACK_DAYS = 365;
    /** Page size for the inventory-transactions ledger. */
    public const TRANSACTION_PAGE_SIZE = 50;
    /** Upper bound on the ledger paging offset (sane cap; deep paging returns empty). */
    private const TRANSACTION_MAX_OFFSET = 100000;
    private const REPORT_ROW_CAP = 500;

    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly MoneyFormatService $money = new MoneyFormatService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array{default_report_id: string, reports: list<array{id: string, label: string, description: string, embed_url: string}>}
     */
    public function embedCatalog(): array
    {
        $this->access->assertHubAccess();

        return self::buildCatalog();
    }

    /**
     * Native "what to buy this week" reorder report: on-hand vs reorder point plus
     * sales velocity over a window, days-of-supply, and a suggested order quantity.
     * Only rows needing attention (out/low/short of the target days) are returned.
     *
     * @return array{window_days: int, target_days: int, generated_at: string, items: list<array<string, mixed>>}
     */
    public function reorderReport(int $windowDays = self::REORDER_WINDOW_DAYS): array
    {
        $this->access->assertHubAccess();

        $windowDays = max(7, min($windowDays, 365));
        $targetDays = self::REORDER_TARGET_DAYS;
        $since = (new \DateTimeImmutable('today'))
            ->modify('-' . $windowDays . ' days')
            ->format('Y-m-d 00:00:00');

        // Bounded (R1): on-hand from live lots (non-expired, non-destroyed) + units
        // sold over the window, joined per active dispensable drug.
        $rows = QueryUtils::fetchRecords(
            "SELECT d.drug_id, d.name, d.reorder_point,
                    COALESCE(inv.on_hand, 0) AS on_hand,
                    COALESCE(sold.qty, 0) AS sold_qty
             FROM drugs d
             LEFT JOIN (
                 SELECT drug_id, SUM(on_hand) AS on_hand
                 FROM drug_inventory
                 WHERE destroy_date IS NULL AND (expiration IS NULL OR expiration > NOW())
                 GROUP BY drug_id
             ) inv ON inv.drug_id = d.drug_id
             LEFT JOIN (
                 SELECT drug_id, SUM(quantity) AS qty
                 FROM drug_sales
                 WHERE sale_date >= ? AND pid != 0
                 GROUP BY drug_id
             ) sold ON sold.drug_id = d.drug_id
             WHERE d.active = 1 AND d.dispensable = 1
             ORDER BY COALESCE(inv.on_hand, 0) ASC, d.name ASC
             LIMIT " . self::REPORT_ROW_CAP,
            [$since]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $onHand = (float) ($row['on_hand'] ?? 0);
            $reorderPoint = (float) ($row['reorder_point'] ?? 0);
            $soldQty = (float) ($row['sold_qty'] ?? 0);
            $avgPerDay = $windowDays > 0 ? $soldQty / $windowDays : 0.0;
            $daysOfSupply = $avgPerDay > 0 ? $onHand / $avgPerDay : null;

            $status = PharmOpsWorklistService::classifyReorderStatus($onHand, $reorderPoint);
            $shortOfTarget = $daysOfSupply !== null && $daysOfSupply <= $targetDays;
            if ($status === 'in_stock' && !$shortOfTarget) {
                continue;
            }

            $suggested = (int) max(0, (int) ceil($targetDays * $avgPerDay) - (int) round($onHand));

            $items[] = [
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'drug_name' => trim((string) ($row['name'] ?? 'Medication')),
                'on_hand' => (int) round($onHand),
                'reorder_point' => (int) round($reorderPoint),
                'sold_qty' => (int) round($soldQty),
                'avg_per_day' => round($avgPerDay, 2),
                'days_of_supply' => $daysOfSupply === null ? null : (int) floor($daysOfSupply),
                'suggested_order_qty' => $suggested,
                'stock_status' => $status,
                'status_label' => match ($status) {
                    'out_of_stock' => 'Out of stock',
                    'low' => 'Low stock',
                    default => 'Watch',
                },
            ];
        }

        return [
            'window_days' => $windowDays,
            'target_days' => $targetDays,
            'generated_at' => date('c'),
            'items' => $items,
        ];
    }

    /**
     * Native destroyed-drugs report: lots written off within a date range, with
     * the audit fields (method, witness, notes). The destroy WRITE lives in
     * PharmOpsDestroyService; this is the read/history view.
     *
     * @return array{from: string, to: string, generated_at: string, items: list<array<string, mixed>>}
     */
    public function destroyedReport(?string $from = null, ?string $to = null): array
    {
        $this->access->assertHubAccess();

        $today = new \DateTimeImmutable('today');
        $toDate = $this->normalizeDate($to) ?? $today->format('Y-m-d');
        $fromDate = $this->normalizeDate($from)
            ?? $today->modify('-' . self::DESTROYED_LOOKBACK_DAYS . ' days')->format('Y-m-d');
        if ($fromDate > $toDate) {
            [$fromDate, $toDate] = [$toDate, $fromDate];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT di.inventory_id, di.drug_id, di.lot_number, di.on_hand,
                    di.destroy_date, di.destroy_method, di.destroy_witness, di.destroy_notes,
                    d.name AS drug_name
             FROM drug_inventory di
             LEFT JOIN drugs d ON d.drug_id = di.drug_id
             WHERE di.destroy_date IS NOT NULL
               AND di.destroy_date >= ? AND di.destroy_date <= ?
             ORDER BY di.destroy_date DESC, d.name ASC
             LIMIT " . self::REPORT_ROW_CAP,
            [$fromDate, $toDate]
        ) ?: [];

        $items = array_map(static function (array $row): array {
            return [
                'inventory_id' => (int) ($row['inventory_id'] ?? 0),
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'drug_name' => trim((string) ($row['drug_name'] ?? 'Medication')),
                'lot_number' => trim((string) ($row['lot_number'] ?? '')),
                'quantity' => (int) round((float) ($row['on_hand'] ?? 0)),
                'destroy_date' => (string) ($row['destroy_date'] ?? ''),
                'method' => trim((string) ($row['destroy_method'] ?? '')),
                'witness' => trim((string) ($row['destroy_witness'] ?? '')),
                'notes' => trim((string) ($row['destroy_notes'] ?? '')),
            ];
        }, $rows);

        return [
            'from' => $fromDate,
            'to' => $toDate,
            'generated_at' => date('c'),
            'items' => $items,
        ];
    }

    /**
     * Native inventory-activity movement summary: per-product units moved in the
     * period by derived transaction type (sale / distribution / transfer /
     * purchase / adjustment) plus current on-hand. Type is derived exactly as the
     * stock report does (pid → sale, distributor_id → distribution,
     * xfer_inventory_id → transfer, fee ≠ 0 → purchase, else adjustment) and
     * quantities use the stock report's -quantity display sign (out = negative).
     *
     * Deliberately does NOT back-derive a start/end balance (the sign-sensitive
     * accounting piece) — the stock report stays available for full parity.
     *
     * @return array{from: string, to: string, generated_at: string, items: list<array<string, mixed>>}
     */
    public function activityReport(?string $from = null, ?string $to = null): array
    {
        $this->access->assertHubAccess();

        $today = new \DateTimeImmutable('today');
        $toDate = $this->normalizeDate($to) ?? $today->format('Y-m-d');
        $fromDate = $this->normalizeDate($from)
            ?? $today->modify('-' . self::DESTROYED_LOOKBACK_DAYS . ' days')->format('Y-m-d');
        if ($fromDate > $toDate) {
            [$fromDate, $toDate] = [$toDate, $fromDate];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT d.drug_id, d.name,
                -SUM(CASE WHEN ds.pid <> 0 THEN ds.quantity ELSE 0 END) AS sales,
                -SUM(CASE WHEN ds.pid = 0 AND COALESCE(ds.distributor_id, 0) <> 0 THEN ds.quantity ELSE 0 END) AS distributions,
                -SUM(CASE WHEN ds.pid = 0 AND COALESCE(ds.distributor_id, 0) = 0 AND COALESCE(ds.xfer_inventory_id, 0) <> 0 THEN ds.quantity ELSE 0 END) AS transfers,
                -SUM(CASE WHEN ds.pid = 0 AND COALESCE(ds.distributor_id, 0) = 0 AND COALESCE(ds.xfer_inventory_id, 0) = 0 AND ds.fee <> 0 THEN ds.quantity ELSE 0 END) AS purchases,
                -SUM(CASE WHEN ds.pid = 0 AND COALESCE(ds.distributor_id, 0) = 0 AND COALESCE(ds.xfer_inventory_id, 0) = 0 AND ds.fee = 0 THEN ds.quantity ELSE 0 END) AS adjustments
             FROM drug_sales ds
             INNER JOIN drugs d ON d.drug_id = ds.drug_id
             WHERE ds.sale_date >= ? AND ds.sale_date <= ?
             GROUP BY d.drug_id, d.name
             ORDER BY d.name ASC
             LIMIT " . self::REPORT_ROW_CAP,
            [$fromDate, $toDate]
        ) ?: [];

        $drugIds = array_map(static fn (array $row): int => (int) ($row['drug_id'] ?? 0), $rows);
        $onHand = $this->currentOnHandMap($drugIds);

        $items = array_map(static function (array $row) use ($onHand): array {
            $drugId = (int) ($row['drug_id'] ?? 0);

            return [
                'drug_id' => $drugId,
                'drug_name' => trim((string) ($row['name'] ?? 'Medication')),
                'sales' => (int) round((float) ($row['sales'] ?? 0)),
                'distributions' => (int) round((float) ($row['distributions'] ?? 0)),
                'purchases' => (int) round((float) ($row['purchases'] ?? 0)),
                'transfers' => (int) round((float) ($row['transfers'] ?? 0)),
                'adjustments' => (int) round((float) ($row['adjustments'] ?? 0)),
                'on_hand' => $onHand[$drugId] ?? 0,
            ];
        }, $rows);

        return [
            'from' => $fromDate,
            'to' => $toDate,
            'generated_at' => date('c'),
            'items' => $items,
        ];
    }

    /**
     * Native inventory-transactions ledger: line-by-line stock movements over a
     * date range, optionally filtered by transaction type. Paginated (R1). Type,
     * "who", and the -quantity display sign follow the stock report exactly.
     *
     * @return array{from: string, to: string, type: string, offset: int, has_more: bool, generated_at: string, items: list<array<string, mixed>>}
     */
    public function transactionLedger(?string $from, ?string $to, string $type = '', int $offset = 0): array
    {
        $this->access->assertHubAccess();

        $today = new \DateTimeImmutable('today');
        $toDate = $this->normalizeDate($to) ?? $today->format('Y-m-d');
        $fromDate = $this->normalizeDate($from)
            ?? $today->modify('-' . self::DESTROYED_LOOKBACK_DAYS . ' days')->format('Y-m-d');
        if ($fromDate > $toDate) {
            [$fromDate, $toDate] = [$toDate, $fromDate];
        }
        $offset = min(max(0, $offset), self::TRANSACTION_MAX_OFFSET);
        $limit = self::TRANSACTION_PAGE_SIZE;

        $rows = QueryUtils::fetchRecords(
            "SELECT ds.sale_id, ds.sale_date, ds.quantity, ds.fee, ds.pid,
                    ds.distributor_id, ds.xfer_inventory_id, ds.notes,
                    d.name AS drug_name, di.lot_number,
                    pd.fname AS pfname, pd.lname AS plname,
                    du.organization AS dorg, du.fname AS dfname, du.lname AS dlname
             FROM drug_sales ds
             INNER JOIN drugs d ON d.drug_id = ds.drug_id
             LEFT JOIN drug_inventory di ON di.inventory_id = ds.inventory_id
             LEFT JOIN patient_data pd ON pd.pid = ds.pid
             LEFT JOIN users du ON du.id = ds.distributor_id
             WHERE ds.sale_date >= ? AND ds.sale_date <= ?" . $this->transactionTypeClause($type) . "
             ORDER BY ds.sale_date DESC, ds.sale_id DESC
             LIMIT " . ($limit + 1) . " OFFSET " . $offset,
            [$fromDate, $toDate]
        ) ?: [];

        $hasMore = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);

        $items = array_map(function (array $row): array {
            $rowType = self::classifyTransactionType($row);

            return [
                'sale_id' => (int) ($row['sale_id'] ?? 0),
                'date' => (string) ($row['sale_date'] ?? ''),
                'type' => $rowType,
                'type_label' => ucfirst($rowType),
                'drug_name' => trim((string) ($row['drug_name'] ?? 'Medication')),
                'lot_number' => trim((string) ($row['lot_number'] ?? '')),
                'who' => $this->deriveTxWho($row, $rowType),
                // Stock report display sign: out = negative.
                'quantity' => -(int) round((float) ($row['quantity'] ?? 0)),
                'amount' => round((float) ($row['fee'] ?? 0), 2),
                'notes' => trim((string) ($row['notes'] ?? '')),
            ];
        }, $rows);

        $currency = $this->money->getFormatPayload($this->visitScope->resolveDefaultFacilityId());

        return [
            'from' => $fromDate,
            'to' => $toDate,
            'type' => $type,
            'offset' => $offset,
            'has_more' => $hasMore,
            'currency_symbol' => (string) (is_array($currency) ? ($currency['currency_symbol'] ?? '') : ''),
            'generated_at' => date('c'),
            'items' => $items,
        ];
    }

    /**
     * Derived transaction type, matching the stock report's if/elseif priority
     * (pid → sale, distributor_id → distribution, xfer_inventory_id → transfer,
     * fee ≠ 0 → purchase, else adjustment). Public + static so the accounting-
     * sensitive derivation is unit-testable without a DB round-trip.
     *
     * @param array<string, mixed> $row
     */
    public static function classifyTransactionType(array $row): string
    {
        if ((int) ($row['pid'] ?? 0) !== 0) {
            return 'sale';
        }
        if ((int) ($row['distributor_id'] ?? 0) !== 0) {
            return 'distribution';
        }
        if ((int) ($row['xfer_inventory_id'] ?? 0) !== 0) {
            return 'transfer';
        }
        if ((float) ($row['fee'] ?? 0) != 0.0) {
            return 'purchase';
        }

        return 'adjustment';
    }

    /**
     * "Who" for a transaction: patient for a sale, distributor for a distribution.
     *
     * @param array<string, mixed> $row
     */
    private function deriveTxWho(array $row, string $type): string
    {
        if ($type === 'sale') {
            return trim(((string) ($row['plname'] ?? '')) . ' ' . ((string) ($row['pfname'] ?? '')));
        }
        if ($type === 'distribution') {
            $org = trim((string) ($row['dorg'] ?? ''));
            if ($org !== '') {
                return $org;
            }

            return trim(((string) ($row['dlname'] ?? '')) . ' ' . ((string) ($row['dfname'] ?? '')));
        }

        return '';
    }

    /**
     * SQL fragment filtering by derived transaction type (static, injection-safe).
     *
     * Deliberately STRICTER than the stock report's per-type filters: each clause
     * carries the full derived-type conditions so the FILTER equals the DISPLAYED
     * type. (Stock filters "transfer" as just xfer_inventory_id != 0, which could
     * include a row that displays as "sale"; here filter and display always agree.)
     */
    private function transactionTypeClause(string $type): string
    {
        return match ($type) {
            'sale' => ' AND ds.pid <> 0',
            'distribution' => ' AND ds.pid = 0 AND COALESCE(ds.distributor_id, 0) <> 0',
            'transfer' => ' AND ds.pid = 0 AND COALESCE(ds.distributor_id, 0) = 0 AND COALESCE(ds.xfer_inventory_id, 0) <> 0',
            'purchase' => ' AND ds.pid = 0 AND COALESCE(ds.distributor_id, 0) = 0 AND COALESCE(ds.xfer_inventory_id, 0) = 0 AND ds.fee <> 0',
            'adjustment' => ' AND ds.pid = 0 AND COALESCE(ds.distributor_id, 0) = 0 AND COALESCE(ds.xfer_inventory_id, 0) = 0 AND ds.fee = 0',
            default => '',
        };
    }

    /**
     * Current live on-hand (non-destroyed lots) for the given drugs, keyed by
     * drug_id. Scoped to the report's drug set (R1) rather than the whole catalog.
     *
     * @param array<int, int> $drugIds
     * @return array<int, int>
     */
    private function currentOnHandMap(array $drugIds): array
    {
        $drugIds = array_values(array_unique(array_filter(
            array_map('intval', $drugIds),
            static fn (int $id): bool => $id > 0
        )));
        if ($drugIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($drugIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT drug_id, SUM(on_hand) AS on_hand
             FROM drug_inventory
             WHERE destroy_date IS NULL AND drug_id IN ($placeholders)
             GROUP BY drug_id",
            $drugIds
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $map[(int) ($row['drug_id'] ?? 0)] = (int) round((float) ($row['on_hand'] ?? 0));
        }

        return $map;
    }

    private function normalizeDate(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        $dt = \DateTimeImmutable::createFromFormat('Y-m-d', $value);

        // Strict: reject values that don't round-trip (createFromFormat rolls
        // 2026-02-30 over to 2026-03-02) so a bad date falls back to the default.
        return ($dt !== false && $dt->format('Y-m-d') === $value) ? $dt->format('Y-m-d') : null;
    }

    /**
     * @return array{default_report_id: string, reports: list<array{id: string, label: string, description: string, embed_url: string}>}
     */
    private static function buildCatalog(): array
    {
        $webroot = rtrim((string) ($GLOBALS['webroot'] ?? ''), '/');
        $moduleBase = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';

        return [
            'default_report_id' => self::REPORT_REORDER,
            'reports' => [
                [
                    'id' => self::REPORT_REORDER,
                    'label' => 'Reorder / low stock',
                    'description' => 'Items at or below reorder point — what to buy this week.',
                    'embed_url' => $webroot . '/interface/reports/inventory_list.php',
                    // Rendered by a native pane (velocity + days-of-supply + suggested qty)
                    // instead of the stock embed. The embed_url stays as the fallback link.
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_ACTIVITY,
                    'label' => 'Inventory activity',
                    'description' => 'Summary of stock movements for the selected period.',
                    'embed_url' => $webroot . '/interface/reports/inventory_activity.php',
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_TRANSACTIONS,
                    'label' => 'Inventory transactions',
                    'description' => 'Detailed purchase, sale, and adjustment ledger.',
                    'embed_url' => $webroot . '/interface/reports/inventory_transactions.php',
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_DESTROYED,
                    'label' => 'Destroyed drugs',
                    'description' => 'Lots written off or destroyed.',
                    'embed_url' => $webroot . '/interface/reports/destroyed_drugs_report.php',
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_PRESCRIPTIONS,
                    'label' => 'Prescriptions vs dispensed',
                    'description' => 'Compare prescribed and dispensed quantities.',
                    'embed_url' => $webroot . '/interface/reports/prescriptions_report.php',
                ],
                [
                    'id' => self::REPORT_CONTROLLED,
                    'label' => 'Controlled substances register',
                    'description' => 'Dispense and destruction log for drugs flagged as controlled (O-PHARM-5 placeholder).',
                    'embed_url' => $moduleBase . '/controlled-register.php',
                ],
            ],
        ];
    }
}