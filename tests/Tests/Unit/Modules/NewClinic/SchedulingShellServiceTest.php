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

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingShellService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class SchedulingShellServiceTest extends TestCase
{
    public function testResolveIntegrationUrlsUsesLegacyWhenRedesignOff(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);
        $access = new SchedulingAccessService($config, $scheduled, new VisitScopeService());
        $service = new SchedulingShellService(schedulingAccess: $access);

        $urls = $service->resolveIntegrationUrls(3);

        $this->assertStringContainsString('patient_tracker.php', $urls['flow_board_url']);
        $this->assertStringContainsString('calendar/index.php', $urls['scheduling_url']);
    }

    public function testResolveIntegrationUrlsUsesS1WhenRedesignOn(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(
            static function (string $key, int $default = 0, int $facilityId = 0): int {
                if ($key === 'enable_scheduling_redesign') {
                    return 1;
                }

                return $default;
            }
        );
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);
        $access = new SchedulingAccessService($config, $scheduled, new VisitScopeService());
        $service = new SchedulingShellService(schedulingAccess: $access);

        $urls = $service->resolveIntegrationUrls(3);

        $this->assertStringContainsString('scheduling/index.php?lens=flow', $urls['flow_board_url']);
        $this->assertStringContainsString('scheduling/index.php?lens=calendar', $urls['scheduling_url']);
    }
}
