<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\QueueBridgeSurfaceService;
use PHPUnit\Framework\TestCase;

class QueueBridgeSurfaceServiceTest extends TestCase
{
    public function testSchedulingFooterShapeWhenDisabled(): void
    {
        $surface = new QueueBridgeSurfaceService();
        $footer = $surface->schedulingFooter(1);

        $this->assertArrayHasKey('enabled', $footer);
        $this->assertArrayHasKey('hub_url', $footer);
    }

    public function testVisitBoardActionNullForInvalidVisit(): void
    {
        $surface = new QueueBridgeSurfaceService();

        $this->assertNull($surface->visitBoardAction(0, 3));
        $this->assertNull($surface->visitBoardAction(-1, 3));
    }

    public function testVisitBadgeMapReturnsArray(): void
    {
        $surface = new QueueBridgeSurfaceService();
        $map = $surface->visitBadgeMap(3);

        $this->assertIsArray($map);
        foreach ($map as $visitId => $badge) {
            $this->assertIsInt($visitId);
            $this->assertArrayHasKey('code', $badge);
            $this->assertContains($badge['code'], ['EX-03', 'EX-04']);
        }
    }

    public function testPatientFlagsShapeWhenHubOff(): void
    {
        $access = new \OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService(
            aclChecker: static fn (string $aco): bool => true,
        );
        if ($access->isHubEnabled(3)) {
            $this->markTestSkipped('Queue Bridge enabled on facility 3 — BRIDGE-7 off-path needs hub disabled');
        }

        $surface = new QueueBridgeSurfaceService();
        $flags = $surface->patientFlags(1, 3);

        $this->assertFalse($flags['enabled'] ?? true);
    }
}
