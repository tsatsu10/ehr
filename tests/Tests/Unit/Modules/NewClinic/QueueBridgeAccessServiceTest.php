<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class QueueBridgeAccessServiceTest extends TestCase
{
    public function testHubDisabledWhenConfigOff(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);

        $access = new QueueBridgeAccessService($config, new VisitScopeService(), $scheduled);

        $this->assertFalse($access->isHubEnabled(3));
    }

    public function testHubReadIncludesReceptionLead(): void
    {
        $this->assertContains('new_queue_bridge', QueueBridgeAccessService::HUB_READ_ACLS);
        $this->assertContains('new_reception_lead', QueueBridgeAccessService::HUB_READ_ACLS);
    }

    public function testDismissScopeForReceptionLead(): void
    {
        $access = new QueueBridgeAccessService(
            aclChecker: static fn (string $aco): bool => $aco === 'new_reception_lead',
        );

        $this->assertTrue($access->canDismissExceptionCode('EX-03'));
        $this->assertTrue($access->canDismissExceptionCode('EX-07'));
        $this->assertFalse($access->canDismissExceptionCode('EX-04'));
    }

    public function testDismissScopeForAdmin(): void
    {
        $access = new QueueBridgeAccessService(
            aclChecker: static fn (string $aco): bool => $aco === 'new_admin',
        );

        $this->assertTrue($access->canDismissExceptionCode('EX-04'));
        $this->assertFalse($access->canDismissExceptionCode('EX-01'));
    }
}
