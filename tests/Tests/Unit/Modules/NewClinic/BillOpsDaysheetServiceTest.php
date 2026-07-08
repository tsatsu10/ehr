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
use OpenEMR\Modules\NewClinic\Services\BillOpsDaysheetService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ReconciliationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class BillOpsDaysheetServiceTest extends TestCase
{
    private function makeService(?BillOpsAccessService $access = null): BillOpsDaysheetService
    {
        return new BillOpsDaysheetService(
            $this->createMock(ClinicConfigService::class),
            $this->createMock(VisitScopeService::class),
            $this->createMock(ReconciliationService::class),
            $access ?? $this->createMock(BillOpsAccessService::class),
        );
    }

    public function testGetDaysheetRejectsMalformedDate(): void
    {
        $service = $this->makeService();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid date');

        $service->getDaysheet(1, '07/06/2026');
    }

    public function testGetDaysheetEnforcesCloseAccess(): void
    {
        $access = $this->createMock(BillOpsAccessService::class);
        $access->method('assertCloseAccess')
            ->willThrowException(new \RuntimeException('Forbidden', 403));
        $service = $this->makeService($access);

        try {
            $service->getDaysheet(1, '2026-07-08');
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }

    public function testNormalizeDateDefaultsBlankToToday(): void
    {
        $service = $this->makeService();
        $method = new ReflectionMethod(BillOpsDaysheetService::class, 'normalizeDate');

        $this->assertSame(date('Y-m-d'), $method->invoke($service, ''));
        $this->assertSame(date('Y-m-d'), $method->invoke($service, '   '));
        $this->assertSame('2026-07-01', $method->invoke($service, '2026-07-01'));
    }

    public function testNormalizeDateRejectsImpossibleCalendarDate(): void
    {
        $service = $this->makeService();
        $method = new ReflectionMethod(BillOpsDaysheetService::class, 'normalizeDate');

        $this->expectException(\InvalidArgumentException::class);

        $method->invoke($service, '2026-02-31');
    }
}
