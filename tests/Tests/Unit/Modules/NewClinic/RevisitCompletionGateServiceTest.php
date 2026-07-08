<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\RevisitCompletionGateService;
use PHPUnit\Framework\TestCase;

class RevisitCompletionGateServiceTest extends TestCase
{
    /**
     * @param array<string, mixed> $gate
     */
    private function makeServiceWithGate(array $gate): RevisitCompletionGateService
    {
        $service = $this->createPartialMock(
            RevisitCompletionGateService::class,
            ['assess', 'logOverride']
        );
        $service->method('assess')->willReturn($gate);

        return $service;
    }

    /**
     * @return array<string, mixed>
     */
    private function blockedGate(bool $canOverride): array
    {
        return [
            'applies' => true,
            'blocked' => true,
            'score' => 40,
            'threshold' => 80,
            'pediatric_dob_block' => false,
            'missing_labels' => ['Phone number'],
            'can_manager_override' => $canOverride,
        ];
    }

    public function testStartVisitPassesWhenGateNotBlocked(): void
    {
        $service = $this->makeServiceWithGate([
            'applies' => false,
            'blocked' => false,
            'score' => 100,
            'threshold' => 80,
            'pediatric_dob_block' => false,
            'missing_labels' => [],
            'can_manager_override' => false,
        ]);
        $service->expects($this->never())->method('logOverride');

        $service->assertCanStartVisit(10, 7, 1, null);

        $this->addToAssertionCount(1);
    }

    public function testBlockedRevisitWithoutOverrideReasonIsRejected(): void
    {
        $service = $this->makeServiceWithGate($this->blockedGate(true));

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Profile incomplete for revisit');

        $service->assertCanStartVisit(10, 7, 1, '');
    }

    public function testOverrideRejectedWithoutManagerAcl(): void
    {
        $service = $this->makeServiceWithGate($this->blockedGate(false));

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Manager override not permitted for incomplete profile');

        $service->assertCanStartVisit(10, 7, 1, 'patient travelling, will complete next visit');
    }

    public function testManagerOverrideIsAuditedAndAllowsStart(): void
    {
        $service = $this->makeServiceWithGate($this->blockedGate(true));
        $service->expects($this->once())
            ->method('logOverride')
            ->with(10, 7, $this->anything(), 'patient travelling, will complete next visit');

        $service->assertCanStartVisit(10, 7, 1, 'patient travelling, will complete next visit');
    }
}
