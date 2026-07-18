<?php

/**
 * S1 Scheduling shell URL resolution tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SchedulingShellService;
use PHPUnit\Framework\TestCase;

class SchedulingShellServiceTest extends TestCase
{
    public function testResolveIntegrationUrlsAlwaysUsesS1(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $service = new SchedulingShellService();

        $urls = $service->resolveIntegrationUrls(3);

        $this->assertStringContainsString('scheduling/index.php?lens=calendar', $urls['scheduling_url']);
        $this->assertStringContainsString('scheduling/index.php?lens=flow', $urls['flow_board_url']);
        $this->assertStringContainsString('scheduling/index.php?lens=recalls', $urls['recalls_url']);
    }

    public function testResolveIntegrationUrlsNeverPointsAtStockScreens(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $service = new SchedulingShellService();

        $urls = $service->resolveIntegrationUrls(0);

        foreach ($urls as $url) {
            $this->assertStringNotContainsString('patient_tracker.php', $url);
            $this->assertStringNotContainsString('main/calendar/index.php', $url);
            $this->assertStringNotContainsString('messages.php', $url);
        }
    }
}
