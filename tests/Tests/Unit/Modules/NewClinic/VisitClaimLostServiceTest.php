<?php

/**
 * Unit tests for visit claim_lost poll annotations
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitClaimLostService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class VisitClaimLostServiceTest extends TestCase
{
    public function testIsClaimLostDetectsConcurrentTake(): void
    {
        $method = new ReflectionMethod(VisitClaimLostService::class, 'isClaimLost');
        $service = new VisitClaimLostService();

        $lost = $method->invoke($service, [
            'state' => 'with_doctor',
            'assigned_provider_id' => 99,
        ], 'ready_for_doctor', 12);

        $this->assertTrue($lost);
    }

    public function testIsClaimLostFalseWhenStillWaiting(): void
    {
        $method = new ReflectionMethod(VisitClaimLostService::class, 'isClaimLost');
        $service = new VisitClaimLostService();

        $lost = $method->invoke($service, [
            'state' => 'waiting',
            'assigned_provider_id' => 0,
        ], 'waiting', 12);

        $this->assertFalse($lost);
    }

    public function testIsClaimLostFalseWhenActorWonClaim(): void
    {
        $method = new ReflectionMethod(VisitClaimLostService::class, 'isClaimLost');
        $service = new VisitClaimLostService();

        $lost = $method->invoke($service, [
            'state' => 'in_triage',
            'assigned_provider_id' => 12,
        ], 'waiting', 12);

        $this->assertFalse($lost);
    }
}
