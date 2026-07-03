<?php

/**
 * S1 Calendar lens service unit tests.
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
use OpenEMR\Modules\NewClinic\Services\SchedulingCalendarService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class SchedulingCalendarServiceTest extends TestCase
{
    public function testBookAppointmentRequiresWriteAcl(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(1);
        $scheduled = $this->createMock(ScheduledIntegrationService::class);
        $scheduled->method('isEnabled')->willReturn(true);

        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(false);

        $service = new SchedulingCalendarService(
            $access,
            new VisitScopeService(),
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Appointment write permission denied');
        $service->bookAppointment(3, [
            'pid' => 1,
            'pc_catid' => 5,
            'provider_id' => 10,
            'date' => '2026-06-30',
            'time' => '09:00',
            'duration_minutes' => 15,
        ], 1);
    }

    public function testBookAppointmentValidatesPatient(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingCalendarService(
            $access,
            new VisitScopeService(),
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Patient is required');
        $service->bookAppointment(3, [
            'pid' => 0,
            'pc_catid' => 5,
            'provider_id' => 10,
            'date' => '2026-06-30',
            'time' => '09:00',
            'duration_minutes' => 15,
        ], 1);
    }

    public function testMoveAppointmentValidatesIds(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingCalendarService(
            $access,
            new VisitScopeService(),
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Appointment id is required');
        $service->moveAppointment(3, [
            'pc_eid' => 0,
            'date' => '2026-06-30',
            'time' => '09:00',
        ], 1);
    }

    public function testResizeAppointmentValidatesDuration(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingCalendarService(
            $access,
            new VisitScopeService(),
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Duration must be between 5 and 480 minutes');
        $service->resizeAppointment(3, [
            'pc_eid' => 1,
            'duration_minutes' => 2,
        ], 1);
    }

    public function testPollRangeViewReturnsUnchangedWhenRevisionMatches(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = $this->getMockBuilder(SchedulingCalendarService::class)
            ->setConstructorArgs([$access, new VisitScopeService()])
            ->onlyMethods(['getRangeView'])
            ->getMock();

        $service->method('getRangeView')->willReturn([
            'revision' => 'same-rev',
            'poll_interval_ms' => 30000,
            'events' => [],
        ]);

        $result = $service->pollRangeView(3, '2026-06-30', 'day', null, 'same-rev');

        $this->assertTrue($result['unchanged']);
        $this->assertSame('same-rev', $result['revision']);
        $this->assertArrayNotHasKey('events', $result);
    }

    public function testMoveAppointmentRejectsInvalidRecurrScope(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingCalendarService(
            $access,
            new VisitScopeService(),
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('recurr_scope must be current, future, or all');
        $service->moveAppointment(3, [
            'pc_eid' => 1,
            'date' => '2026-06-30',
            'time' => '09:00',
            'recurr_scope' => 'series',
        ], 1);
    }
}
