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
use OpenEMR\Modules\NewClinic\Services\SchedulingProviderColorService;
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
            'visit_type_id' => 5,
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
            'visit_type_id' => 5,
            'provider_id' => 10,
            'date' => '2026-06-30',
            'time' => '09:00',
            'duration_minutes' => 15,
        ], 1);
    }

    public function testBookAppointmentValidatesVisitType(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingCalendarService(
            $access,
            new VisitScopeService(),
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit type is required');
        $service->bookAppointment(3, [
            'pid' => 1,
            'visit_type_id' => 0,
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

    public function testCancelAppointmentRequiresWriteAcl(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(false);

        $service = new SchedulingCalendarService($access, new VisitScopeService());

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Appointment write permission denied');
        $service->cancelAppointment(3, ['pc_eid' => 1], 1);
    }

    public function testCancelAppointmentValidatesId(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingCalendarService($access, new VisitScopeService());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Appointment id is required');
        $service->cancelAppointment(3, ['pc_eid' => 0], 1);
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

    public function testPollRangeViewSkipsRebuildWhenSignatureMatches(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');

        $service = $this->getMockBuilder(SchedulingCalendarService::class)
            ->setConstructorArgs([$access, new VisitScopeService()])
            ->onlyMethods(['computeRangeSignature', 'getRangeView'])
            ->getMock();

        // The cheap signature matches the client's → the full rebuild is skipped.
        $service->method('computeRangeSignature')->willReturn('v2:3:12345');
        $service->expects($this->never())->method('getRangeView');

        $result = $service->pollRangeView(3, '2026-06-30', 'day', null, 'v2:3:12345');

        $this->assertTrue($result['unchanged']);
        $this->assertSame('v2:3:12345', $result['revision']);
        $this->assertArrayNotHasKey('events', $result);
    }

    public function testPollRangeViewRebuildsWhenSignatureDiffers(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');

        $service = $this->getMockBuilder(SchedulingCalendarService::class)
            ->setConstructorArgs([$access, new VisitScopeService()])
            ->onlyMethods(['computeRangeSignature', 'getRangeView'])
            ->getMock();

        $service->method('computeRangeSignature')->willReturn('v2:5:999');
        $service->method('getRangeView')->willReturn([
            'revision' => 'v2:5:999',
            'poll_interval_ms' => 30000,
            'events' => [],
        ]);

        $result = $service->pollRangeView(3, '2026-06-30', 'day', null, 'stale-revision');

        $this->assertFalse($result['unchanged']);
        $this->assertArrayHasKey('events', $result);
    }

    public function testComputeFreeSlotsSkipsBusyRangesAndHonorsLimit(): void
    {
        // Clinic 08:00–10:00, 15-min grid, 15-min visits; 08:30–09:00 booked.
        $slots = SchedulingCalendarService::computeFreeSlots(
            [[510, 540]], // 08:30–09:00
            480,          // 08:00
            600,          // 10:00
            15,
            15,
            null,
            5
        );

        $this->assertSame(['08:00', '08:15', '09:00', '09:15', '09:30'], $slots);
    }

    public function testComputeFreeSlotsRespectsDurationAndClosingTime(): void
    {
        // 30-min visit must END by close (10:00), so 09:30 is the last valid start.
        $slots = SchedulingCalendarService::computeFreeSlots([], 540, 600, 15, 30, null, 10);

        $this->assertSame(['09:00', '09:15', '09:30'], $slots);
    }

    public function testComputeFreeSlotsSkipsPastTimesForToday(): void
    {
        $slots = SchedulingCalendarService::computeFreeSlots([], 480, 600, 15, 15, 545, 3);

        $this->assertSame(['09:15', '09:30', '09:45'], $slots);
    }

    public function testResolveRepeatSpecMapsRepeatOptions(): void
    {
        $service = new SchedulingCalendarService(
            $this->createMock(SchedulingAccessService::class),
            new VisitScopeService(),
        );
        $method = new \ReflectionMethod($service, 'resolveRepeatSpec');
        $method->setAccessible(true);

        $this->assertSame([1, 1], $method->invoke($service, 'weekly'));
        $this->assertSame([2, 1], $method->invoke($service, 'biweekly'));
        $this->assertSame([1, 2], $method->invoke($service, 'monthly'));
    }

    public function testResolveRepeatSpecRejectsUnknownOption(): void
    {
        $service = new SchedulingCalendarService(
            $this->createMock(SchedulingAccessService::class),
            new VisitScopeService(),
        );
        $method = new \ReflectionMethod($service, 'resolveRepeatSpec');
        $method->setAccessible(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unsupported repeat option');
        $method->invoke($service, 'daily');
    }

    public function testRecurringBookingRequiresUntilDate(): void
    {
        $service = new SchedulingCalendarService(
            $this->createMock(SchedulingAccessService::class),
            new VisitScopeService(),
        );
        $method = new \ReflectionMethod($service, 'insertRecurringBooking');
        $method->setAccessible(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('repeat-until date is required');
        // Validation throws before any DB write.
        $method->invoke($service, 1, 5, 'X', 15, '', '2026-07-20', '09:00:00', '09:15:00', 3, 10, 'weekly', '');
    }

    public function testRecurringBookingRejectsUntilBeforeStart(): void
    {
        $service = new SchedulingCalendarService(
            $this->createMock(SchedulingAccessService::class),
            new VisitScopeService(),
        );
        $method = new \ReflectionMethod($service, 'insertRecurringBooking');
        $method->setAccessible(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('must be on or after');
        $method->invoke($service, 1, 5, 'X', 15, '', '2026-07-20', '09:00:00', '09:15:00', 3, 10, 'weekly', '2026-07-10');
    }

    public function testResolveVisitTypeColorsAssignsPaletteByIndex(): void
    {
        $service = new SchedulingCalendarService(
            $this->createMock(SchedulingAccessService::class),
            new VisitScopeService(),
        );
        $method = new \ReflectionMethod($service, 'resolveVisitTypeColors');
        $method->setAccessible(true);

        $colors = $method->invoke($service, [
            ['id' => 7, 'label' => 'New consult'],
            ['id' => 9, 'label' => 'Follow-up'],
            ['id' => 0, 'label' => 'ignored'],
        ]);

        $this->assertSame(SchedulingProviderColorService::defaultColorForIndex(0), $colors[7]);
        $this->assertSame(SchedulingProviderColorService::defaultColorForIndex(1), $colors[9]);
        $this->assertArrayNotHasKey(0, $colors);
    }

    public function testResolveEventVisitTypeMatchesTitleCaseInsensitively(): void
    {
        $service = new SchedulingCalendarService(
            $this->createMock(SchedulingAccessService::class),
            new VisitScopeService(),
        );
        $method = new \ReflectionMethod($service, 'resolveEventVisitType');
        $method->setAccessible(true);

        [$id, $label] = $method->invoke(
            $service,
            ['pc_title' => 'Follow-Up', 'pc_catname' => 'Office Visit'],
            ['follow-up' => 9],
        );
        $this->assertSame(9, $id);
        $this->assertSame('Follow-Up', $label);

        // No visit-type match (a block/legacy title) → id 0, label from title.
        [$id2, $label2] = $method->invoke(
            $service,
            ['pc_title' => 'Vaccination clinic', 'pc_catname' => 'Office Visit'],
            ['follow-up' => 9],
        );
        $this->assertSame(0, $id2);
        $this->assertSame('Vaccination clinic', $label2);
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
