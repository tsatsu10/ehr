<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Exceptions\UndispensedRxException;
use OpenEMR\Modules\NewClinic\Services\PharmOpsUndispensedGate;
use PHPUnit\Framework\TestCase;

class PharmOpsUndispensedGateTest extends TestCase
{
    public function testOverrideRequiresTenCharacters(): void
    {
        $this->assertFalse(PharmOpsUndispensedGate::isOverrideAllowed('short', true));
        $this->assertTrue(PharmOpsUndispensedGate::isOverrideAllowed('patient left early', true));
        $this->assertFalse(PharmOpsUndispensedGate::isOverrideAllowed('patient left early', false));
    }

    public function testAssertResolvedSkipsWhenInhousePharmacyOff(): void
    {
        PharmOpsUndispensedGate::assertResolved(false, 3, null, true);
        $this->addToAssertionCount(1);
    }

    public function testAssertResolvedSkipsWhenNoUndispensed(): void
    {
        PharmOpsUndispensedGate::assertResolved(true, 0, null, false);
        $this->addToAssertionCount(1);
    }

    public function testAssertResolvedAllowsValidOverride(): void
    {
        PharmOpsUndispensedGate::assertResolved(true, 2, 'community pharmacy pickup', true);
        $this->addToAssertionCount(1);
    }

    public function testAssertResolvedThrowsWhenBlocked(): void
    {
        $this->expectException(UndispensedRxException::class);
        $this->expectExceptionMessage('2 prescriptions');

        PharmOpsUndispensedGate::assertResolved(true, 2, null, false);
    }

    public function testDispenseAuditEventUsesPartialEvent(): void
    {
        $this->assertSame('pharmacy_ops.partial_dispensed', PharmOpsUndispensedGate::dispenseAuditEvent('partial'));
        $this->assertSame('pharmacy_ops.dispensed', PharmOpsUndispensedGate::dispenseAuditEvent('dispensed'));
    }
}
