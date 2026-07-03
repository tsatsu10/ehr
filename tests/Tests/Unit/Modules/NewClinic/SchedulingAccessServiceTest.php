<?php

/**
 * S1 Scheduling & Flow access service unit tests.
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
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class SchedulingAccessServiceTest extends TestCase
{
    public function testHubDisabledWithoutRedesignFlag(): void
    {
        $access = $this->makeAccess(false, static fn (string $aco): bool => $aco === 'new_reception');

        $this->assertFalse($access->isHubEnabled(3));
    }

    public function testAssertHubAccessFailsWhenHubOff(): void
    {
        $access = $this->makeAccess(false);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Scheduling & Flow is not enabled');
        $access->assertHubAccess();
    }

    public function testAssertHubAccessFailsWithoutAclWhenHubOn(): void
    {
        $access = $this->makeAccess(true, static fn (string $aco): bool => false);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Scheduling access denied');
        $access->assertHubAccess();
    }

    private function makeAccess(bool $hubEnabled, ?callable $aclChecker = null): SchedulingAccessService
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(
            static function (string $key, int $default = 0, int $facilityId = 0) use ($hubEnabled): int {
                if ($key === 'enable_scheduling_redesign') {
                    return $hubEnabled ? 1 : 0;
                }

                return $default;
            }
        );

        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);

        return new SchedulingAccessService(
            $config,
            $scheduled,
            new VisitScopeService(),
            $aclChecker
        );
    }
}
