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

class MainMenuRestrictReportHubTest extends TestCase
{
    public function testFilterMainMenuRemovesReportsTopLevel(): void
    {
        $service = new MainMenuRestrictService();
        $reports = (object) [
            'menu_id' => 'repimg',
            'label' => 'Reports',
            'children' => [],
        ];
        $patients = (object) [
            'menu_id' => 'patimg',
            'label' => 'Patients',
            'children' => [],
        ];

        $filtered = $service->filterMainMenu(
            [$reports, $patients],
            MainMenuRestrictService::STOCK_REPORTS_MENU_IDS,
        );

        $this->assertCount(1, $filtered);
        $this->assertSame('patimg', $filtered[0]->menu_id);
    }

    public function testStockReportsMenuIdsTargetsTopLevelReports(): void
    {
        $this->assertSame(['repimg'], MainMenuRestrictService::STOCK_REPORTS_MENU_IDS);
    }

    public function testPruneEmptyMenuBranchesRemovesEmptyReportsGroup(): void
    {
        $service = new MainMenuRestrictService();
        $reports = (object) [
            'menu_id' => 'repimg',
            'label' => 'Reports',
            'children' => [],
        ];
        $patients = (object) [
            'menu_id' => 'patimg',
            'label' => 'Patients',
            'url' => '/interface/main/finder/patient_finder.php',
            'children' => [],
        ];

        $pruned = $service->pruneEmptyMenuBranches([$reports, $patients]);

        $this->assertCount(1, $pruned);
        $this->assertSame('patimg', $pruned[0]->menu_id);
    }
}
