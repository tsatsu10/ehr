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

class MainMenuRestrictPharmOpsTest extends TestCase
{
    public function testFilterMainMenuRemovesInventoryTopLevel(): void
    {
        $service = new MainMenuRestrictService();
        $inventory = (object) [
            'menu_id' => 'invimg',
            'label' => 'Inventory',
            'children' => [],
        ];
        $patients = (object) [
            'menu_id' => 'patimg',
            'label' => 'Patients',
            'children' => [],
        ];

        $filtered = $service->filterMainMenu(
            [$inventory, $patients],
            MainMenuRestrictService::STOCK_PHARM_MENU_IDS,
        );

        $this->assertCount(1, $filtered);
        $this->assertSame('patimg', $filtered[0]->menu_id);
    }

    public function testFilterMainMenuByUrlRemovesInventoryReports(): void
    {
        $service = new MainMenuRestrictService();
        $reorder = (object) [
            'label' => 'List',
            'url' => '/interface/reports/inventory_list.php',
            'children' => [],
        ];
        $rx = (object) [
            'label' => 'Rx',
            'url' => '/interface/reports/prescriptions_report.php',
            'children' => [],
        ];
        $inventory = (object) [
            'label' => 'Inventory',
            'children' => [$reorder, $rx],
        ];
        $reports = (object) [
            'label' => 'Reports',
            'children' => [$inventory],
        ];

        $filtered = $service->filterMainMenuByUrl(
            [$reports],
            MainMenuRestrictService::STOCK_PHARM_MENU_URLS,
        );

        $this->assertCount(1, $filtered);
        $this->assertCount(1, $filtered[0]->children);
        $inventoryGroup = $filtered[0]->children[0];
        $this->assertCount(1, $inventoryGroup->children);
        $this->assertSame('/interface/reports/prescriptions_report.php', $inventoryGroup->children[0]->url);
    }

    public function testPruneEmptyMenuBranchesRemovesEmptyInventoryGroup(): void
    {
        $service = new MainMenuRestrictService();
        $inventory = (object) [
            'label' => 'Inventory',
            'children' => [],
        ];
        $reports = (object) [
            'label' => 'Reports',
            'children' => [$inventory],
        ];

        $pruned = $service->pruneEmptyMenuBranches([$reports]);

        $this->assertSame([], $pruned);
    }

    public function testFilterAndPruneRemovesInventoryReportsSection(): void
    {
        $service = new MainMenuRestrictService();
        $reorder = (object) [
            'label' => 'List',
            'url' => '/interface/reports/inventory_list.php',
            'children' => [],
        ];
        $inventory = (object) [
            'label' => 'Inventory',
            'children' => [$reorder],
        ];
        $reports = (object) [
            'label' => 'Reports',
            'children' => [$inventory],
        ];

        $filtered = $service->filterMainMenuByUrl(
            [$reports],
            MainMenuRestrictService::STOCK_PHARM_MENU_URLS,
        );
        $pruned = $service->pruneEmptyMenuBranches($filtered);

        $this->assertSame([], $pruned);
    }
}
