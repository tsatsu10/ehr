<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicDateService;
use OpenEMR\Modules\NewClinic\Services\FrontDeskStatsService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class FrontDeskStatsServiceTest extends TestCase
{
    public function testDeskStatsEnforceFacilityScopeBeforeQuerying(): void
    {
        $visitScope = $this->createMock(VisitScopeService::class);
        $visitScope->expects($this->once())
            ->method('assertFacilityAccessible')
            ->with(9)
            ->willThrowException(new \RuntimeException('Forbidden', 403));
        $clinicDate = $this->createMock(ClinicDateService::class);
        $clinicDate->expects($this->never())->method('today');

        $service = new FrontDeskStatsService($clinicDate, $visitScope);

        try {
            $service->getDeskStats(7, 9);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }
}
