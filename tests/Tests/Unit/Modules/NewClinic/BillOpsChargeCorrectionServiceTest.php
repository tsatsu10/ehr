<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\BillOpsChargeCorrectionService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService;
use OpenEMR\Modules\NewClinic\Services\VisitBoardService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class BillOpsChargeCorrectionServiceTest extends TestCase
{
    private function makeService(
        ?BillOpsAccessService $access = null,
        ?VisitQueueService $queue = null,
    ): BillOpsChargeCorrectionService {
        return new BillOpsChargeCorrectionService(
            $this->createMock(ClinicConfigService::class),
            $this->createMock(VisitScopeService::class),
            $access ?? $this->createMock(BillOpsAccessService::class),
            $queue ?? $this->createMock(VisitQueueService::class),
            $this->createMock(VisitBoardService::class),
            $this->createMock(FeeScheduleAdminService::class),
        );
    }

    public function testApplyCorrectionRequiresReason(): void
    {
        $service = $this->makeService();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Reason is required');

        $service->applyCorrection(1, [['fee_schedule_id' => 5]], [], '   ', 7);
    }

    public function testApplyCorrectionRequiresAtLeastOneLine(): void
    {
        $service = $this->makeService();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Add or remove at least one charge line');

        $service->applyCorrection(1, [], [], 'price entered wrong', 7);
    }

    public function testApplyCorrectionRejectsVisitInNonCorrectableState(): void
    {
        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->willReturn([
            'id' => 1,
            'state' => 'with_doctor',
            'pid' => 10,
            'encounter' => 20,
        ]);
        $service = $this->makeService(queue: $queue);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit is not eligible for charge correction');

        $service->applyCorrection(1, [['fee_schedule_id' => 5]], [], 'reason', 7);
    }

    public function testGetVisitChargesRejectsVisitInNonCorrectableState(): void
    {
        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->willReturn([
            'id' => 1,
            'state' => 'waiting',
            'pid' => 10,
            'encounter' => 20,
        ]);
        $service = $this->makeService(queue: $queue);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit is not eligible for charge correction');

        $service->getVisitCharges(1, 7);
    }

    public function testGetVisitChargesEnforcesCorrectAccessBeforeAnyWork(): void
    {
        $access = $this->createMock(BillOpsAccessService::class);
        $access->method('assertCorrectAccess')
            ->willThrowException(new \RuntimeException('Forbidden', 403));
        $queue = $this->createMock(VisitQueueService::class);
        $queue->expects($this->never())->method('getVisitForActor');
        $service = $this->makeService(access: $access, queue: $queue);

        try {
            $service->getVisitCharges(1, 7);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }
}
