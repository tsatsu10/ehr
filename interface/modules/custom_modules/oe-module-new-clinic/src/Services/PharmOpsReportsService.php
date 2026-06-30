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

class PharmOpsReportsService
{
    public const REPORT_REORDER = 'reorder';
    public const REPORT_ACTIVITY = 'activity';
    public const REPORT_TRANSACTIONS = 'transactions';
    public const REPORT_DESTROYED = 'destroyed';
    public const REPORT_PRESCRIPTIONS = 'prescriptions';
    public const REPORT_CONTROLLED = 'controlled';

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