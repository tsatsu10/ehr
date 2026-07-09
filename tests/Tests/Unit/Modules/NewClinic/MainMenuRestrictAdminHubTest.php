<?php

/**
 * Admin menu cutover when M15 Admin Hub is ON (ADMIN §16.1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class MainMenuRestrictAdminHubTest extends TestCase
{
    public function testStockAdminMenuIdsTargetTopLevelAdmin(): void
    {
        $this->assertSame(['admimg'], MainMenuRestrictService::STOCK_ADMIN_MENU_IDS);
    }

    public function testFilterMainMenuRemovesStockAdminTopMenu(): void
    {
        $service = new MainMenuRestrictService();
        $admin = (object) [
            'menu_id' => 'admimg',
            'label' => 'Admin',
            'children' => [
                (object) [
                    'menu_id' => 'adm0',
                    'label' => 'Config',
                    'url' => '/interface/super/edit_globals.php',
                ],
            ],
        ];
        $patients = (object) [
            'menu_id' => 'patimg',
            'label' => 'Patients',
            'url' => '/interface/main/finder/patient_finder.php',
        ];

        $filtered = $service->filterMainMenu(
            [$admin, $patients],
            MainMenuRestrictService::STOCK_ADMIN_MENU_IDS,
        );

        $this->assertCount(1, $filtered);
        $this->assertSame('patimg', $filtered[0]->menu_id);
    }

    public function testCutoverGateChecksSuperAdminAndHubFlag(): void
    {
        $source = file_get_contents(
            (new ReflectionMethod(MainMenuRestrictService::class, 'shouldHideStockAdminMenusForCurrentUser'))->getFileName()
        );

        $this->assertNotFalse($source);
        // Core super keeps the stock Admin menu; clinic admins get the hub instead.
        $this->assertStringContainsString('shouldHideStockAdminMenusForCurrentUser', $source);
        $this->assertStringContainsString("aclCheckCore('admin', 'super')", $source);
        $this->assertStringContainsString('enable_admin_hub', $source);
        $this->assertStringContainsString('STOCK_ADMIN_MENU_IDS', $source);
    }
}
