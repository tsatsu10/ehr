<?php

/**
 * Unit tests for visit facility scoping
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class VisitScopeServiceTest extends TestCase
{
    public function testOrphanRepairKeyIsStable(): void
    {
        $service = new VisitScopeService();
        $this->assertSame('3:2026-06-25', $service->buildOrphanRepairKey(3, '2026-06-25'));
    }

    public function testAggressiveOrphanRepairGateExists(): void
    {
        $service = new VisitScopeService();
        $this->assertTrue(method_exists($service, 'repairOrphanVisits'));
        $this->assertTrue(method_exists($service, 'resolveDeskFacilityId'));
        $method = new \ReflectionMethod(VisitScopeService::class, 'shouldRunAggressiveOrphanRepair');
        $this->assertTrue($method->isPrivate());
    }
}
