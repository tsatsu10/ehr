<?php

/**
 * Native procedure-order form + engine policy tests (GAP-D / D3).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderEnginePolicy;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderFormService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class ProcedureOrderFormServiceTest extends TestCase
{
    public function testPolicyIgnoresNonProcedureOrderFormdir(): void
    {
        // Deterministic regardless of flag state: only 'procedure_order' can
        // route native, so a consult formdir never does.
        $policy = new ProcedureOrderEnginePolicy();
        $this->assertFalse($policy->shouldOpenNativeProcOrder('soap', 0));
        $this->assertFalse($policy->shouldOpenNativeProcOrder('vitals', 0));
    }

    public function testPolicyDefaultsOff(): void
    {
        // Flag defaults OFF (install.sql) → stock bridge, 100% legacy (PRD §5.6).
        // The policy resolves a 0/null facility to the *desk* facility, so the
        // skip-guard must read the flag at that SAME resolved facility — reading
        // facility 0 while the policy checks the desk facility is what made an
        // earlier version of this test non-deterministic.
        $facilityId = (new VisitScopeService())->resolveDeskFacilityId();
        $config = new ClinicConfigService();
        if ($config->getInt('enable_native_proc_order', 0, $facilityId) === 1) {
            $this->markTestSkipped('enable_native_proc_order is ON in this environment');
        }
        $this->assertFalse((new ProcedureOrderEnginePolicy())->isNativeProcOrderEnabled($facilityId));
        $this->assertFalse(
            (new ProcedureOrderEnginePolicy())->shouldOpenNativeProcOrder('procedure_order', $facilityId)
        );
    }

    public function testNormalizePriorityRejectsUnknownValues(): void
    {
        $method = new ReflectionMethod(ProcedureOrderFormService::class, 'normalizePriority');
        $method->setAccessible(true);
        $service = new ProcedureOrderFormService();

        // Known fallback values survive; anything else collapses to 'normal'
        // so a bad client value can never write a garbage priority.
        $this->assertSame('normal', $method->invoke($service, 'normal'));
        $this->assertSame('stat', $method->invoke($service, 'STAT'));
        $this->assertSame('normal', $method->invoke($service, 'definitely-not-a-priority'));
        $this->assertSame('normal', $method->invoke($service, ''));
    }

    public function testPriorityOptionsFallBackToDefaultsWhenListUnseeded(): void
    {
        // The Order_Priority list_options may be empty (as in a stock cash
        // install) — the service must still offer usable priorities.
        $method = new ReflectionMethod(ProcedureOrderFormService::class, 'fetchPriorityOptions');
        $method->setAccessible(true);
        $options = $method->invoke(new ProcedureOrderFormService());

        $this->assertNotEmpty($options);
        $ids = array_column($options, 'id');
        $this->assertContains('normal', $ids);
        foreach ($options as $opt) {
            $this->assertArrayHasKey('id', $opt);
            $this->assertArrayHasKey('title', $opt);
        }
    }

    public function testResolveOrderLinesRejectsEmptySelection(): void
    {
        $method = new ReflectionMethod(ProcedureOrderFormService::class, 'resolveOrderLines');
        $method->setAccessible(true);
        $service = new ProcedureOrderFormService();

        $this->assertSame([], $method->invoke($service, 1, []));
        $this->assertSame([], $method->invoke($service, 1, 'not-an-array'));
        $this->assertSame([], $method->invoke($service, 1, [0, -3]));
    }
}
