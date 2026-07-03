<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use PHPUnit\Framework\TestCase;

class MainMenuRestrictBillOpsTest extends TestCase
{
    public function testFilterMainMenuRemovesStockFeesChildren(): void
    {
        $service = new MainMenuRestrictService();
        $fees = (object) [
            'menu_id' => 'feesimg',
            'label' => 'Fees',
            'children' => [
                (object) [
                    'menu_id' => 'bil1',
                    'label' => 'Billing Manager',
                    'url' => '/interface/billing/billing_report.php',
                ],
                (object) [
                    'menu_id' => 'pay1',
                    'label' => 'Payment',
                    'url' => '/interface/billing/search_payments.php',
                ],
            ],
        ];
        $patients = (object) [
            'menu_id' => 'patimg',
            'label' => 'Patients',
            'url' => '/interface/main/finder/patient_finder.php',
        ];

        $filtered = $service->filterMainMenu(
            [$fees, $patients],
            MainMenuRestrictService::STOCK_FEES_MENU_IDS,
        );

        $this->assertCount(2, $filtered);
        $this->assertSame('feesimg', $filtered[0]->menu_id);
        $this->assertCount(0, $filtered[0]->children);
        $this->assertSame('patimg', $filtered[1]->menu_id);
    }

    public function testStockFeesMenuIdsIncludesBillingManager(): void
    {
        $this->assertContains('bil1', MainMenuRestrictService::STOCK_FEES_MENU_IDS);
    }
}
