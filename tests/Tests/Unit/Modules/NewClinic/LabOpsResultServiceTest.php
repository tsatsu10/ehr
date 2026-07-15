<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\LabOpsResultService;
use OpenEMR\Modules\NewClinic\Services\LabResultsReadinessService;
use OpenEMR\Modules\NewClinic\Services\LabResultValidationService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderDeepLinkService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class LabOpsResultServiceTest extends TestCase
{
    private function makeService(?LabOpsAccessService $access = null): LabOpsResultService
    {
        return new LabOpsResultService(
            $access ?? $this->createMock(LabOpsAccessService::class),
            $this->createMock(FacilityScopeService::class),
            $this->createMock(LabResultsReadinessService::class),
            $this->createMock(VisitScopeService::class),
            $this->createMock(ProcedureOrderDeepLinkService::class),
            $this->createMock(LabResultValidationService::class),
        );
    }

    public function testSaveEntryRequiresEnterAccess(): void
    {
        $access = $this->createMock(LabOpsAccessService::class);
        $access->method('assertEnterAccess')
            ->willThrowException(new \RuntimeException('Forbidden', 403));

        try {
            $this->makeService($access)->saveEntry(1, ['lines' => [['x' => 1]]], 7);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }

    public function testReleaseOrderRequiresReleaseAccessAndValidId(): void
    {
        $access = $this->createMock(LabOpsAccessService::class);
        $access->method('assertReleaseAccess')
            ->willThrowException(new \RuntimeException('Forbidden', 403));
        try {
            $this->makeService($access)->releaseOrder(1, 7);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Procedure order id is required');
        $this->makeService()->releaseOrder(0, 7);
    }

    public function testReleaseReportRejectsInvalidId(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Procedure report id is required');

        $this->makeService()->releaseReport(0, 7);
    }

    public function testAmendRequiresReleaseAccess(): void
    {
        $access = $this->createMock(LabOpsAccessService::class);
        $access->method('assertReleaseAccess')
            ->willThrowException(new \RuntimeException('Forbidden', 403));

        try {
            $this->makeService($access)->amendReleasedOrder(1, 'typo', 7);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }

    public function testAmendRequiresAReason(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('An amendment reason is required');

        // Release access is permitted by the default mock; the empty reason is rejected
        // before any database work.
        $this->makeService()->amendReleasedOrder(5, '   ', 7);
    }
}
