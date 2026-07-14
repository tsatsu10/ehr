<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\EncounterIdentityStripService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\LabDirectService;
use OpenEMR\Modules\NewClinic\Services\LabShortcutService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderDeepLinkService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderEnginePolicy;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;

class LabShortcutServiceTest extends TestCase
{
    private VisitQueueService $queue;
    private EncounterSessionService $encounterSession;
    private EncounterIdentityStripService $identityStrip;
    private ProcedureOrderDeepLinkService $deepLinks;
    private ProcedureOrderEnginePolicy $procOrderPolicy;

    protected function setUp(): void
    {
        $this->queue = $this->createMock(VisitQueueService::class);
        $this->encounterSession = $this->createMock(EncounterSessionService::class);
        $this->identityStrip = $this->createMock(EncounterIdentityStripService::class);
        $this->deepLinks = $this->createMock(ProcedureOrderDeepLinkService::class);
        $this->procOrderPolicy = $this->createMock(ProcedureOrderEnginePolicy::class);
    }

    private function makeService(): LabShortcutService
    {
        return new LabShortcutService(
            $this->encounterSession,
            $this->queue,
            $this->deepLinks,
            $this->identityStrip,
            $this->createMock(LabDirectService::class),
            $this->procOrderPolicy,
        );
    }

    public function testRejectsUnknownShortcutBeforeTouchingVisit(): void
    {
        $this->queue->expects($this->never())->method('getVisitForActor');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown shortcut');

        $this->makeService()->preflight(5, 'billing', 7);
    }

    public function testRejectsVisitNotInActiveLabWork(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'ready_for_lab', 'pid' => 10, 'encounter' => 20,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit is not in active lab work');

        $this->makeService()->preflight(5, 'results', 7);
    }

    public function testResultsShortcutBindsSessionAndDeepLinksToLabData(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_lab', 'pid' => 10, 'encounter' => 20,
            'assigned_provider_id' => 0,
        ]);
        $this->encounterSession->expects($this->once())->method('bindForVisit')->with(5, 7);
        $this->encounterSession->expects($this->once())->method('assertBound')->with(5);
        $this->identityStrip->expects($this->once())
            ->method('markFromShortcut')
            ->with(5, 'lab', 'results');

        $result = $this->makeService()->preflight(5, 'RESULTS', 7);

        $this->assertSame('results', $result['shortcut']);
        $this->assertStringContainsString('labdata.php?set_pid=10', $result['redirect_url']);
    }

    /**
     * Regression guard (2026-07-13 audit): the Lab Desk's "Orders" shortcut
     * always deep-linked to the stock procedure_order bridge, even when a
     * clinic has the native proc-order form (proc-order.php) turned on -- the
     * native form existed and was already reachable from the Doctor Desk /
     * Clinical Doc Hub, it just was never consulted here.
     */
    public function testOrdersShortcutRoutesToNativeFormWhenEnabledForVisitFacility(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_lab', 'pid' => 10, 'encounter' => 20,
            'facility_id' => 3, 'assigned_provider_id' => 0,
        ]);
        $this->procOrderPolicy->expects($this->once())
            ->method('isNativeProcOrderEnabled')
            ->with(3)
            ->willReturn(true);
        $this->deepLinks->expects($this->never())->method('buildNewOrderUrl');

        $result = $this->makeService()->preflight(5, 'orders', 7);

        $this->assertSame('orders', $result['shortcut']);
        $this->assertStringContainsString('proc-order.php?visit_id=5', $result['redirect_url']);
        $this->assertStringContainsString('return_to=lab', $result['redirect_url']);
    }

    public function testOrdersShortcutFallsBackToStockBridgeWhenNativeFormDisabled(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_lab', 'pid' => 10, 'encounter' => 20,
            'facility_id' => 3, 'assigned_provider_id' => 0,
        ]);
        $this->procOrderPolicy->method('isNativeProcOrderEnabled')->with(3)->willReturn(false);
        $this->deepLinks->expects($this->once())
            ->method('buildNewOrderUrl')
            ->with(10, 20, $this->stringContains('lab.php'))
            ->willReturn('https://example.test/stock-bridge');

        $result = $this->makeService()->preflight(5, 'orders', 7);

        $this->assertSame('https://example.test/stock-bridge', $result['redirect_url']);
    }
}
