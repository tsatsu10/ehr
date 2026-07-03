<?php

/**
 * S1 scheduling menu cutover unit tests (S-P6).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use PHPUnit\Framework\TestCase;

class MainMenuRestrictSchedulingTest extends TestCase
{
    public function testStockSchedulingMenuUrlsTargetLegacySuite(): void
    {
        $urls = MainMenuRestrictService::STOCK_SCHEDULING_MENU_URLS;
        $this->assertContains('/interface/main/main_info.php', $urls);
        $this->assertContains('/interface/patient_tracker/patient_tracker.php?skip_timeout_reset=1', $urls);
        $this->assertContains('/interface/main/messages/messages.php?go=Recalls', $urls);
    }

    public function testFilterMainMenuByUrlRemovesLegacySchedulingItems(): void
    {
        $service = new MainMenuRestrictService();
        $calendar = (object) [
            'menu_id' => 'cal0',
            'label' => 'Calendar',
            'url' => '/interface/main/main_info.php',
            'children' => [],
        ];
        $flowBoard = (object) [
            'menu_id' => 'pfb0',
            'label' => 'Flow Board',
            'url' => '/interface/patient_tracker/patient_tracker.php?skip_timeout_reset=1',
            'children' => [],
        ];
        $recalls = (object) [
            'menu_id' => 'pfb0',
            'label' => 'Recall Board',
            'url' => '/interface/main/messages/messages.php?go=Recalls',
            'children' => [],
        ];
        $addressBook = (object) [
            'menu_id' => 'adb0',
            'label' => 'Address Book',
            'url' => '/interface/usergroup/addrbook_list.php',
            'children' => [],
        ];

        $filtered = $service->filterMainMenuByUrl(
            [$calendar, $flowBoard, $recalls, $addressBook],
            MainMenuRestrictService::STOCK_SCHEDULING_MENU_URLS,
        );

        $this->assertCount(1, $filtered);
        $this->assertSame('adb0', $filtered[0]->menu_id);
    }

    public function testFilterMainMenuRemovesCalendarMenuId(): void
    {
        $service = new MainMenuRestrictService();
        $calendar = (object) [
            'menu_id' => 'cal0',
            'label' => 'Calendar',
            'url' => '/interface/main/main_info.php',
            'children' => [],
        ];
        $other = (object) [
            'menu_id' => 'adb0',
            'label' => 'Address Book',
            'url' => '/interface/usergroup/addrbook_list.php',
            'children' => [],
        ];

        $filtered = $service->filterMainMenu(
            [$calendar, $other],
            MainMenuRestrictService::STOCK_SCHEDULING_MENU_IDS,
        );

        $this->assertCount(1, $filtered);
        $this->assertSame('adb0', $filtered[0]->menu_id);
    }
}
