<?php

/**
 * Unit tests for visit transition conflict classification (G12 / §16.1.1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Support\VisitTransitionConflictResolver;
use PHPUnit\Framework\TestCase;

class VisitTransitionConflictResolverTest extends TestCase
{
    public function testConcurrentTakePatientIsClaimLoss(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'ready_for_doctor',
            'with_doctor',
            'with_doctor',
            2,
            3
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_CLAIM_LOSS, $outcome);
        $meta = VisitTransitionConflictResolver::claimMetaForState('with_doctor');
        $this->assertSame('take_patient', $meta['kind'] ?? null);
    }

    public function testConcurrentStartTriageIsClaimLoss(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'waiting',
            'in_triage',
            'in_triage',
            1,
            2
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_CLAIM_LOSS, $outcome);
    }

    public function testSendToDoctorRaceIsStaleVisit(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'in_triage',
            'ready_for_doctor',
            'ready_for_doctor',
            4,
            5
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_STALE_VISIT, $outcome);
    }

    public function testSameStateVersionMismatchIsStaleVisit(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'with_doctor',
            'ready_for_lab',
            'with_doctor',
            2,
            3
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_STALE_VISIT, $outcome);
    }

    public function testCancelledWhileTakingIsStaleVisit(): void
    {
        $outcome = VisitTransitionConflictResolver::classify(
            'ready_for_doctor',
            'with_doctor',
            'cancelled',
            1,
            1
        );

        $this->assertSame(VisitTransitionConflictResolver::OUTCOME_STALE_VISIT, $outcome);
    }
}
