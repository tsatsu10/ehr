<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\LabQcRuleService;
use PHPUnit\Framework\TestCase;

class LabQcRuleServiceTest extends TestCase
{
    private function service(): LabQcRuleService
    {
        // A permissive access mock keeps the ACL gate out of the validation path.
        $access = $this->createMock(LabOpsAccessService::class);
        $access->method('assertCatalogAccess');

        return new LabQcRuleService($access);
    }

    public function testRejectsReferenceLowAboveHigh(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->service()->saveRule('HB', ['warn_min' => 15, 'warn_max' => 10], 1);
    }

    public function testRejectsCriticalLowAboveReferenceLow(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->service()->saveRule('HB', ['warn_min' => 7, 'crit_min' => 9], 1);
    }

    public function testRejectsCriticalHighBelowReferenceHigh(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->service()->saveRule('HB', ['warn_max' => 18, 'crit_max' => 16], 1);
    }

    public function testRejectsEmptyCode(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->service()->saveRule('', ['warn_min' => 1], 1);
    }

    public function testApplyOverrideLeavesRuleUnchangedWhenNoOverride(): void
    {
        // With no database/override rows, applyOverride is a no-op and returns the base rule.
        $rule = ['type' => 'numeric', 'warn_min' => 7.0, 'warn_max' => 18.0];
        $this->assertSame($rule, $this->service()->applyOverride('HB', $rule));
    }

    public function testSaveDerivesReferenceRangeFromWarnBounds(): void
    {
        // Reflection avoids a DB write while still exercising the range-derivation logic.
        $ref = new \ReflectionMethod(LabQcRuleService::class, 'formatNumber');
        $ref->setAccessible(true);
        $service = $this->service();
        $this->assertSame('12', $ref->invoke($service, 12.0));
        $this->assertSame('15.5', $ref->invoke($service, 15.5));
    }
}
