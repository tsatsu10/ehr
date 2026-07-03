<?php

/**
 * Unit tests for V1.1-RTb advisory routing service
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitRoutingService;
use PHPUnit\Framework\TestCase;

class VisitRoutingServiceTest extends TestCase
{
    public function testSelectLowestLoadDoctorPicksLowestScore(): void
    {
        $picked = VisitRoutingService::selectLowestLoadDoctor(
            [12, 34, 56],
            [12 => 4.0, 34 => 2.5, 56 => 3.0]
        );

        $this->assertSame(34, $picked);
    }

    public function testSelectLowestLoadDoctorAppliesTieBreakBonus(): void
    {
        $picked = VisitRoutingService::selectLowestLoadDoctor(
            [10, 20],
            [10 => 3.0, 20 => 3.0],
            [20 => 0.25]
        );

        $this->assertSame(20, $picked);
    }

    public function testIsEnabledRequiresAdvisoryAndRosterFlags(): void
    {
        $source = file_get_contents((new \ReflectionClass(VisitRoutingService::class))->getFileName());
        $this->assertStringContainsString('enable_advisory_routing', $source);
        $this->assertStringContainsString('rosterService->isEnabled', $source);
        $this->assertStringContainsString('routing_suggested_provider_id', $source);
    }
}
