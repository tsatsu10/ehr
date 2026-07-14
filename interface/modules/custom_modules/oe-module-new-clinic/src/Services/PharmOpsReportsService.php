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
    private const REPORT_ROW_CAP = 500;

    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
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

    private function normalizeDate(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        $dt = \DateTimeImmutable::createFromFormat('Y-m-d', $value);

        return $dt !== false ? $dt->format('Y-m-d') : null;
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
                ],
                [
                    'id' => self::REPORT_TRANSACTIONS,
                    'label' => 'Inventory transactions',
                    'description' => 'Detailed purchase, sale, and adjustment ledger.',
                    'embed_url' => $webroot . '/interface/reports/inventory_transactions.php',
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