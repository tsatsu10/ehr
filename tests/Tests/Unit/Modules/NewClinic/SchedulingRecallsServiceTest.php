<?php

/**
 * S1 Recalls lens service unit tests.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingRecallsService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class SchedulingRecallsServiceTest extends TestCase
{
    public function testSaveRecallRequiresWriteAcl(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(false);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Recall write permission denied');
        $service->saveRecall(3, [
            'pid' => 1,
            'due_date' => '2026-07-01',
            'provider_id' => 10,
            'facility_id' => 3,
        ], 1);
    }

    public function testUpdateStatusValidatesRecallId(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Recall is required');
        $service->updateStatus(0, 'contacted', null, 1);
    }

    public function testSnoozeValidatesRecallId(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Recall is required');
        $service->snoozeRecall(0, 7, 1);
    }

    public function testFlagFollowUpRequiresWriteAcl(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(false);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Recall write permission denied');
        $service->flagFollowUp(1, '2026-08-01', 'Recheck BP', 1);
    }

    public function testFlagFollowUpRejectsInvalidDueDate(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Valid due date is required');
        $service->flagFollowUp(1, 'next week', 'Recheck BP', 1);
    }

    public function testFlagFollowUpRejectsImpossibleCalendarDate(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        // Passes the YYYY-MM-DD regex but is not a real date — checkdate() must reject it.
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Valid due date is required');
        $service->flagFollowUp(1, '2026-13-45', 'Recheck BP', 1);
    }

    public function testFlagFollowUpRejectsMissingPatient(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);
        $access->method('assertHubAccess');
        $access->method('canBookAppointment')->willReturn(true);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Patient is required');
        $service->flagFollowUp(0, '2026-08-01', 'Recheck BP', 1);
    }

    public function testCompleteLinkedRecallOnCheckInReturnsFalseForInvalidIds(): void
    {
        $access = $this->createMock(SchedulingAccessService::class);

        $service = new SchedulingRecallsService($access, new VisitScopeService());

        $this->assertFalse($service->completeLinkedRecallOnCheckIn(0, 1, 1));
        $this->assertFalse($service->completeLinkedRecallOnCheckIn(1, 0, 1));
    }
}
