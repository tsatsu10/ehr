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
use OpenEMR\Modules\NewClinic\Services\PharmacyShortcutService;
use OpenEMR\Modules\NewClinic\Services\PrescriptionEditPolicy;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;

class PharmacyShortcutServiceTest extends TestCase
{
    private VisitQueueService $queue;
    private EncounterSessionService $encounterSession;
    private EncounterIdentityStripService $identityStrip;
    private PrescriptionEditPolicy $rxEditPolicy;

    protected function setUp(): void
    {
        $this->queue = $this->createMock(VisitQueueService::class);
        $this->encounterSession = $this->createMock(EncounterSessionService::class);
        $this->identityStrip = $this->createMock(EncounterIdentityStripService::class);
        $this->rxEditPolicy = $this->createMock(PrescriptionEditPolicy::class);
    }

    private function makeService(): PharmacyShortcutService
    {
        return new PharmacyShortcutService(
            $this->encounterSession,
            $this->queue,
            $this->identityStrip,
            $this->rxEditPolicy,
        );
    }

    public function testRejectsUnknownShortcut(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown shortcut');

        $this->makeService()->preflight(5, 'orders', 7);
    }

    public function testRejectsVisitNotInActivePharmacyWork(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'ready_for_pharmacy', 'pid' => 10,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visit is not in active pharmacy work');

        $this->makeService()->preflight(5, 'dispense', 7);
    }

    public function testRxEditShortcutFallsBackToStockBridgeWhenNativeFormDisabled(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_pharmacy', 'pid' => 10, 'facility_id' => 3,
            'assigned_provider_id' => 0,
        ]);
        $this->rxEditPolicy->method('isNativeRxEditEnabled')->with(3)->willReturn(false);
        $this->encounterSession->expects($this->once())->method('bindForVisit')->with(5, 7);
        $this->encounterSession->expects($this->once())->method('assertBound')->with(5);
        $this->identityStrip->expects($this->once())
            ->method('markFromShortcut')
            ->with(5, 'pharmacy', 'rx_edit');

        $result = $this->makeService()->preflight(5, 'rx_edit', 7);

        $this->assertSame('rx_edit', $result['shortcut']);
        $this->assertStringContainsString('controller.php?prescription&edit&id=&pid=10', $result['redirect_url']);
    }

    /**
     * Regression guard (2026-07-14 build): the Pharmacy Desk's "Add Rx"
     * shortcut always deep-linked to the stock controller.php prescription
     * editor, with no native alternative -- this asserts the new one is
     * actually consulted once the flag is on.
     */
    public function testRxEditShortcutRoutesToNativeFormWhenEnabledForVisitFacility(): void
    {
        $this->queue->method('getVisitForActor')->willReturn([
            'id' => 5, 'state' => 'in_pharmacy', 'pid' => 10, 'facility_id' => 3,
            'assigned_provider_id' => 0,
        ]);
        $this->rxEditPolicy->expects($this->once())
            ->method('isNativeRxEditEnabled')
            ->with(3)
            ->willReturn(true);

        $result = $this->makeService()->preflight(5, 'rx_edit', 7);

        $this->assertSame('rx_edit', $result['shortcut']);
        $this->assertStringContainsString('rx-edit.php?visit_id=5', $result['redirect_url']);
        $this->assertStringContainsString('return_to=pharmacy', $result['redirect_url']);
    }
}
