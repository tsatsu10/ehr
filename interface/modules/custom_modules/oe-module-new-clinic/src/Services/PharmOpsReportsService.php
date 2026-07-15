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
    /** Default lookback for the prescriptions (prescribed-vs-dispensed) report. */
    public const PRESCRIPTIONS_LOOKBACK_DAYS = 90;
    /** Page size for the inventory-transactions ledger. */
    public const TRANSACTION_PAGE_SIZE = 50;
    /** Page size for the inventory-management stock browser. */
    public const INVENTORY_PAGE_SIZE = 50;
    /** Upper bound on paging offsets (sane cap; deep paging returns empty). */
    private const TRANSACTION_MAX_OFFSET = 100000;
    private const REPORT_ROW_CAP = 500;

    /**
     * Per-drug unit cost AND supplier (INV-7) from the most recent purchase (trans_type 2,
     * negative qty/fee): `cost.unit_cost` and `vendor.organization`/`vendor.fname`/`vendor.lname`
     * (build a display name from those — see stockRowSupplierName()). Both are NULL when the drug
     * has never been received through the module, or the purchase had no supplier recorded.
     * $alias is the table/alias holding drug_id in the outer query (drug_inventory in the stock
     * browser, drugs in the reorder report).
     */
    private static function costJoin(string $alias = 'di'): string
    {
        return "LEFT JOIN (
            SELECT ds.drug_id, ABS(ds.fee / ds.quantity) AS unit_cost, ds.distributor_id
            FROM drug_sales ds
            INNER JOIN (
                SELECT drug_id, MAX(sale_id) AS max_id
                FROM drug_sales
                WHERE trans_type = 2 AND quantity <> 0 AND drug_id > 0
                GROUP BY drug_id
            ) latest ON latest.drug_id = ds.drug_id AND latest.max_id = ds.sale_id
         ) cost ON cost.drug_id = {$alias}.drug_id
         LEFT JOIN users vendor ON vendor.id = cost.distributor_id AND vendor.abook_type = 'vendor'";
    }

    /**
     * @param array<string, mixed> $row a row selected with vendor.organization/fname/lname
     */
    private static function supplierName(array $row): ?string
    {
        $organization = trim((string) ($row['vendor_organization'] ?? ''));
        if ($organization !== '') {
            return $organization;
        }
        $personName = trim(($row['vendor_fname'] ?? '') . ' ' . ($row['vendor_lname'] ?? ''));

        return $personName !== '' ? $personName : null;
    }

    // Per-drug consumption over the reorder window (units dispensed to patients). Joined as
    // `sold.sold_qty`; drives days-of-supply in the browser (INV-4), same source as the reorder report.
    private const CONSUMPTION_JOIN =
        "LEFT JOIN (
            SELECT drug_id, SUM(quantity) AS sold_qty
            FROM drug_sales
            WHERE pid != 0 AND sale_date >= DATE_SUB(CURDATE(), INTERVAL " . self::REORDER_WINDOW_DAYS . " DAY)
            GROUP BY drug_id
         ) sold ON sold.drug_id = di.drug_id";

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
                    COALESCE(sold.qty, 0) AS sold_qty,
                    cost.unit_cost,
                    vendor.organization AS vendor_organization,
                    vendor.fname AS vendor_fname, vendor.lname AS vendor_lname
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
             " . self::costJoin('d') . "
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
            $unitCost = isset($row['unit_cost']) && $row['unit_cost'] !== null
                ? round((float) $row['unit_cost'], 2)
                : null;

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
                // Purchase-order estimate (INV-5): unit cost from the latest purchase; null = unknown.
                'unit_cost' => $unitCost,
                'estimated_cost' => $unitCost !== null ? round($unitCost * $suggested, 2) : null,
                // Supplier (INV-7): from the latest purchase; null = no supplier on record.
                'supplier_name' => self::supplierName($row),
            ];
        }

        $currency = $this->money->getFormatPayload($this->visitScope->resolveDefaultFacilityId());

        return [
            'window_days' => $windowDays,
            'target_days' => $targetDays,
            'currency_symbol' => (string) (is_array($currency) ? ($currency['currency_symbol'] ?? '') : ''),
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

    /**
     * Native prescribed-vs-dispensed report: prescriptions in a date range with
     * the total quantity dispensed against each (drug_sales joined on
     * prescription_id) and a fulfilment status. Replaces prescriptions_report.php.
     *
     * @return array{from: string, to: string, generated_at: string, items: list<array<string, mixed>>}
     */
    public function prescriptionsReport(?string $from = null, ?string $to = null): array
    {
        $this->access->assertHubAccess();

        $today = new \DateTimeImmutable('today');
        $toDate = $this->normalizeDate($to) ?? $today->format('Y-m-d');
        $fromDate = $this->normalizeDate($from)
            ?? $today->modify('-' . self::PRESCRIPTIONS_LOOKBACK_DAYS . ' days')->format('Y-m-d');
        if ($fromDate > $toDate) {
            [$fromDate, $toDate] = [$toDate, $fromDate];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT r.id, r.date_added, r.quantity AS prescribed_qty, r.drug,
                    d.name AS drug_name,
                    COALESCE(SUM(s.quantity), 0) AS dispensed_qty,
                    p.fname, p.lname, p.pubpid
             FROM prescriptions r
             LEFT JOIN drugs d ON d.drug_id = r.drug_id
             LEFT JOIN drug_sales s ON s.prescription_id = r.id
             LEFT JOIN patient_data p ON p.pid = r.patient_id
             WHERE r.date_added >= ? AND r.date_added <= ?
             GROUP BY r.id, r.date_added, r.quantity, r.drug, d.name, p.fname, p.lname, p.pubpid
             ORDER BY r.date_added DESC, r.id DESC
             LIMIT " . self::REPORT_ROW_CAP,
            [$fromDate . ' 00:00:00', $toDate . ' 23:59:59']
        ) ?: [];

        $items = array_map(static function (array $row): array {
            $prescribed = (float) ($row['prescribed_qty'] ?? 0);
            $dispensed = (float) ($row['dispensed_qty'] ?? 0);
            $status = $dispensed <= 0
                ? 'not_dispensed'
                : (($prescribed > 0 && $dispensed >= $prescribed) ? 'dispensed' : 'partial');
            $drugName = trim((string) ($row['drug_name'] ?? ''));
            if ($drugName === '') {
                $drugName = trim((string) ($row['drug'] ?? ''));
            }
            $patient = trim(((string) ($row['lname'] ?? '')) . ', ' . ((string) ($row['fname'] ?? '')));

            return [
                'prescription_id' => (int) ($row['id'] ?? 0),
                'date' => substr((string) ($row['date_added'] ?? ''), 0, 10),
                'patient_name' => trim($patient, ', '),
                'pubpid' => (string) ($row['pubpid'] ?? ''),
                'drug_name' => $drugName !== '' ? $drugName : 'Medication',
                'prescribed_qty' => (int) round($prescribed),
                'dispensed_qty' => (int) round($dispensed),
                'status' => $status,
                'status_label' => match ($status) {
                    'dispensed' => 'Dispensed',
                    'partial' => 'Partial',
                    default => 'Not dispensed',
                },
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
     * Native inventory-management stock browser: live lots (non-destroyed) with
     * on-hand and expiry status. Replaces drug_inventory.php. Filterable by drug
     * name, empty lots, and expiry bucket. Paginated (R1); a stockroom-health
     * summary accompanies the first page.
     *
     * @return array{offset: int, has_more: bool, summary: array<string, int>|null, generated_at: string, items: list<array<string, mixed>>}
     */
    public function stockBrowser(string $search = '', bool $showEmpty = false, string $expiry = 'all', int $offset = 0): array
    {
        $this->access->assertHubAccess();

        $where = 'di.destroy_date IS NULL AND d.active = 1';
        $binds = [];
        if (!$showEmpty) {
            $where .= ' AND di.on_hand <> 0';
        }
        $search = trim($search);
        if ($search !== '') {
            $where .= ' AND d.name LIKE ?';
            $binds[] = '%' . $search . '%';
        }
        // Expiry tiers (INV-6): '30'/'60'/'90' narrow to that many days out; 'expiring' is the
        // original 90-day bucket kept for the dashboard tiles (INV-2), an alias for '90'.
        $expiryDays = match ($expiry) {
            'expiring', '90' => 90,
            '60' => 60,
            '30' => 30,
            default => null,
        };
        if ($expiry === 'expired') {
            $where .= ' AND di.expiration IS NOT NULL AND di.expiration < CURDATE()';
        } elseif ($expiryDays !== null) {
            $where .= ' AND di.expiration IS NOT NULL AND di.expiration >= CURDATE()'
                . " AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL {$expiryDays} DAY)";
        }

        $offset = min(max(0, $offset), self::TRANSACTION_MAX_OFFSET);
        $limit = self::INVENTORY_PAGE_SIZE;

        $rows = QueryUtils::fetchRecords(
            "SELECT di.inventory_id, di.drug_id, di.lot_number, di.on_hand, di.expiration,
                    d.name AS drug_name, d.reorder_point, cost.unit_cost, sold.sold_qty,
                    vendor.organization AS vendor_organization,
                    vendor.fname AS vendor_fname, vendor.lname AS vendor_lname
             FROM drug_inventory di
             INNER JOIN drugs d ON d.drug_id = di.drug_id
             " . self::costJoin() . "
             " . self::CONSUMPTION_JOIN . "
             WHERE {$where}
             ORDER BY d.name ASC, di.expiration ASC, di.lot_number ASC
             LIMIT " . ($limit + 1) . " OFFSET " . $offset,
            $binds
        ) ?: [];

        $hasMore = count($rows) > $limit;
        $rows = array_slice($rows, 0, $limit);

        $today = new \DateTimeImmutable('today');
        $soon = $today->modify('+90 days');

        $items = array_map(static function (array $row) use ($today, $soon): array {
            $exp = trim((string) ($row['expiration'] ?? ''));
            $hasExp = $exp !== '' && $exp !== '0000-00-00';
            $expStatus = 'ok';
            if ($hasExp) {
                try {
                    $expDate = new \DateTimeImmutable($exp);
                    if ($expDate < $today) {
                        $expStatus = 'expired';
                    } elseif ($expDate <= $soon) {
                        $expStatus = 'expiring';
                    }
                } catch (\Exception) {
                    $hasExp = false;
                }
            }

            $onHand = (int) round((float) ($row['on_hand'] ?? 0));
            $unitCost = isset($row['unit_cost']) && $row['unit_cost'] !== null
                ? round((float) $row['unit_cost'], 2)
                : null;
            // Average daily consumption over the reorder window (INV-4), per drug.
            $avgPerDay = round((float) ($row['sold_qty'] ?? 0) / self::REORDER_WINDOW_DAYS, 3);

            return [
                'inventory_id' => (int) ($row['inventory_id'] ?? 0),
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'drug_name' => trim((string) ($row['drug_name'] ?? 'Medication')),
                'lot_number' => trim((string) ($row['lot_number'] ?? '')),
                'on_hand' => $onHand,
                'expiration' => $hasExp ? substr($exp, 0, 10) : '',
                'expiry_status' => $expStatus,
                // Stock valuation (INV-1): unit cost from the latest purchase; null = cost unknown.
                'unit_cost' => $unitCost,
                'value' => $unitCost !== null ? round($onHand * $unitCost, 2) : null,
                // Consumption velocity (INV-4): units/day, per drug (same on every lot of the drug).
                'avg_per_day' => $avgPerDay,
                // Supplier (INV-7): from the latest purchase; null = no supplier on record.
                'supplier_name' => self::supplierName($row),
            ];
        }, $rows);

        $currency = $this->money->getFormatPayload($this->visitScope->resolveDefaultFacilityId());

        return [
            'offset' => $offset,
            'has_more' => $hasMore,
            // Only compute the stockroom-health summary on the first page.
            'summary' => $offset === 0 ? $this->stockSummary() : null,
            'currency_symbol' => (string) (is_array($currency) ? ($currency['currency_symbol'] ?? '') : ''),
            'generated_at' => date('c'),
            'items' => $items,
        ];
    }

    /**
     * Stockroom-health counts for the inventory summary strip: distinct in-stock
     * SKUs, lots expiring within 90 days, expired lots, out-of-stock active
     * dispensable drugs, and drugs at/below their reorder point.
     *
     * @return array<string, int>
     */
    private function stockSummary(): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT
                COUNT(DISTINCT CASE WHEN di.on_hand <> 0 THEN di.drug_id END) AS sku_count,
                SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration >= CURDATE()
                         AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS expiring,
                SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration < CURDATE() THEN 1 ELSE 0 END) AS expired,
                COALESCE(SUM(di.on_hand * cost.unit_cost), 0) AS total_value,
                COALESCE(SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration >= CURDATE()
                         AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
                         THEN di.on_hand * cost.unit_cost ELSE 0 END), 0) AS value_expiring,
                COALESCE(SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration < CURDATE()
                         THEN di.on_hand * cost.unit_cost ELSE 0 END), 0) AS value_expired,
                SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration >= CURDATE()
                         AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS expiring_30,
                SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration >= CURDATE()
                         AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) AS expiring_60,
                COALESCE(SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration >= CURDATE()
                         AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                         THEN di.on_hand * cost.unit_cost ELSE 0 END), 0) AS value_expiring_30,
                COALESCE(SUM(CASE WHEN di.expiration IS NOT NULL AND di.expiration >= CURDATE()
                         AND di.expiration <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                         THEN di.on_hand * cost.unit_cost ELSE 0 END), 0) AS value_expiring_60
             FROM drug_inventory di
             INNER JOIN drugs d ON d.drug_id = di.drug_id
             " . self::costJoin() . "
             WHERE di.destroy_date IS NULL AND d.active = 1"
        );

        // Out-of-stock + at-reorder are per-drug (aggregate on-hand vs reorder point).
        $reorderRow = QueryUtils::querySingleRow(
            "SELECT
                SUM(CASE WHEN oh.on_hand <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
                SUM(CASE WHEN d.reorder_point > 0 AND oh.on_hand <= d.reorder_point THEN 1 ELSE 0 END) AS at_reorder
             FROM drugs d
             LEFT JOIN (
                 SELECT drug_id, SUM(on_hand) AS on_hand
                 FROM drug_inventory WHERE destroy_date IS NULL GROUP BY drug_id
             ) oh ON oh.drug_id = d.drug_id
             WHERE d.active = 1 AND d.dispensable = 1"
        );

        $totalValue = (float) (is_array($row) ? ($row['total_value'] ?? 0) : 0);
        $valueExpired = (float) (is_array($row) ? ($row['value_expired'] ?? 0) : 0);

        return [
            'sku_count' => (int) (is_array($row) ? ($row['sku_count'] ?? 0) : 0),
            'expiring' => (int) (is_array($row) ? ($row['expiring'] ?? 0) : 0),
            'expired' => (int) (is_array($row) ? ($row['expired'] ?? 0) : 0),
            'out_of_stock' => (int) (is_array($reorderRow) ? ($reorderRow['out_of_stock'] ?? 0) : 0),
            'at_reorder' => (int) (is_array($reorderRow) ? ($reorderRow['at_reorder'] ?? 0) : 0),
            // Stock valuation (INV-1): value at cost of all on-hand stock, and the slice at risk.
            'total_value' => round($totalValue, 2),
            'value_expiring' => round((float) (is_array($row) ? ($row['value_expiring'] ?? 0) : 0), 2),
            'value_expired' => round($valueExpired, 2),
            // Wastage rate: expired value as a share of total value (0 when nothing on hand).
            'wastage_rate_pct' => $totalValue > 0 ? round(($valueExpired / $totalValue) * 100, 1) : 0.0,
            // Expiry tiers (INV-6): finer horizons than the 90-day "expiring" bucket above, for
            // triage — what needs attention this month vs next.
            'expiring_30' => (int) (is_array($row) ? ($row['expiring_30'] ?? 0) : 0),
            'expiring_60' => (int) (is_array($row) ? ($row['expiring_60'] ?? 0) : 0),
            'value_expiring_30' => round((float) (is_array($row) ? ($row['value_expiring_30'] ?? 0) : 0), 2),
            'value_expiring_60' => round((float) (is_array($row) ? ($row['value_expiring_60'] ?? 0) : 0), 2),
        ];
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
                    'embed_url' => '',
                    // Rendered by a native pane (velocity + days-of-supply + suggested qty)
                    // instead of the stock embed. The embed_url stays as the fallback link.
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_ACTIVITY,
                    'label' => 'Inventory activity',
                    'description' => 'Summary of stock movements for the selected period.',
                    'embed_url' => '',
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_TRANSACTIONS,
                    'label' => 'Inventory transactions',
                    'description' => 'Detailed purchase, sale, and adjustment ledger.',
                    'embed_url' => '',
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_DESTROYED,
                    'label' => 'Destroyed drugs',
                    'description' => 'Lots written off or destroyed.',
                    'embed_url' => '',
                    'native' => true,
                ],
                [
                    'id' => self::REPORT_PRESCRIPTIONS,
                    'label' => 'Prescriptions vs dispensed',
                    'description' => 'Compare prescribed and dispensed quantities.',
                    'embed_url' => '',
                    'native' => true,
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