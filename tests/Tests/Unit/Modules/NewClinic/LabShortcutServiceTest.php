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
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;

class LabShortcutServiceTest extends TestCase
{
    private VisitQueueService $queue;
    private EncounterSessionService $encounterSession;
    private EncounterIdentityStripService $identityStrip;

    protected function setUp(): void
    {
        $this->queue = $this->createMock(VisitQueueService::class);
        $this->encounterSession = $this->createMock(EncounterSessionService::class);
        $this->identityStrip = $this->createMock(EncounterIdentityStripService::class);
    }

    private function makeService(): LabShortcutService
    {
        return new LabShortcutService(
            $this->encounterSession,
            $this->queue,
            $this->createMock(ProcedureOrderDeepLinkService::class),
            $this->identityStrip,
            $this->createMock(LabDirectService::class),
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
}
