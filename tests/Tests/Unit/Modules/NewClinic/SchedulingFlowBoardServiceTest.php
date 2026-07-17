<?php

/**
 * S1 Flow Board service unit tests.
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
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class SchedulingFlowBoardServiceTest extends TestCase
{
    public function testAdvanceStatusRequiresEnabledHub(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);

        $service = new SchedulingFlowBoardService(
            new SchedulingAccessService($config, $scheduled, new VisitScopeService())
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Scheduling & Flow is not enabled');
        $service->advanceStatus(3, 1, '@', 1);
    }

    public function testNextStatusFollowsLaneOrderNotRawStatusOrder(): void
    {
        $service = new SchedulingFlowBoardService();
        $method = new \ReflectionMethod($service, 'mapAppointmentRow');
        $method->setAccessible(true);

        // Raw status order (-, x, @) deliberately differs from lane order (-, @):
        // the pre-fix bug ignored laneConfig and would return 'x' (raw next).
        $statuses = [
            '-' => ['label' => 'Pending'],
            'x' => ['label' => 'Cancelled-ish'],
            '@' => ['label' => 'Arrived'],
        ];
        $laneConfig = [
            ['lane_key' => 'waiting', 'status_codes' => ['-'], 'representative_status' => '-'],
            ['lane_key' => 'with', 'status_codes' => ['@'], 'representative_status' => '@'],
        ];
        $row = [
            'pid' => 1,
            'pc_eid' => 2,
            'pc_apptstatus' => '-',
            'status' => '-',
            'fname' => 'A',
            'lname' => 'B',
            'pc_startTime' => '09:00:00',
            'pc_recurrtype' => 0,
        ];

        $card = $method->invoke($service, $row, $statuses, [], $laneConfig, null);

        $this->assertSame('@', $card['next_status'], 'next_status must follow the lane map, not raw status order');
    }

    public function testStartMinutesParsesTimeOfDay(): void
    {
        $service = new SchedulingFlowBoardService();
        $method = new \ReflectionMethod($service, 'startMinutes');
        $method->setAccessible(true);

        $this->assertSame(0, $method->invoke($service, '00:00:00'));
        $this->assertSame(9 * 60 + 30, $method->invoke($service, '09:30:00'));
        $this->assertSame(14 * 60 + 5, $method->invoke($service, '14:05'));
        $this->assertNull($method->invoke($service, ''));
        $this->assertNull($method->invoke($service, 'not-a-time'));
    }

    public function testUpdateRoomRequiresEnabledHub(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);

        $service = new SchedulingFlowBoardService(
            new SchedulingAccessService($config, $scheduled, new VisitScopeService())
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Scheduling & Flow is not enabled');
        $service->updateRoom(3, 1, 'Rm 1', 1);
    }

    public function testPollBoardReturnsUnchangedWhenRevisionMatches(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);

        $access = new SchedulingAccessService($config, $scheduled, new VisitScopeService());
        $service = $this->getMockBuilder(SchedulingFlowBoardService::class)
            ->setConstructorArgs([$access, new VisitScopeService()])
            ->onlyMethods(['getBoard'])
            ->getMock();

        $service->method('getBoard')->willReturn([
            'revision' => 'board-rev',
            'poll_interval_ms' => 20000,
            'lanes' => [],
        ]);

        $result = $service->pollBoard(3, '2026-06-30', null, 'board-rev');

        $this->assertTrue($result['unchanged']);
        $this->assertSame('board-rev', $result['revision']);
        $this->assertArrayNotHasKey('lanes', $result);
    }
}
