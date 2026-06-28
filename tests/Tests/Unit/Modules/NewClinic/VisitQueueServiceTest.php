<?php

/**
 * Unit tests for visit queue take helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class VisitQueueServiceTest extends TestCase
{
    public function testTakeLabPatientPassesAssignedProviderToTransition(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'takeLabPatient');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("'in_lab'", $body);
        $this->assertStringContainsString('$actorUserId', $body);
        $this->assertMatchesRegularExpression('/transition\([^)]+\$actorUserId\s*\)/', $body);
    }

    public function testTakePharmacyPatientPassesAssignedProviderToTransition(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'takePharmacyPatient');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("'in_pharmacy'", $body);
        $this->assertStringContainsString('$actorUserId', $body);
        $this->assertMatchesRegularExpression('/transition\([^)]+\$actorUserId\s*\)/', $body);
    }

    public function testAssertCanStartVisitScopesByFacility(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'assertCanStartVisit');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('facility_id = ?', $body);
        $this->assertStringContainsString('allow_multiple_visits_per_day', $body);
    }

    public function testCreateVisitChecksPatientFacility(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'createVisit');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('assertPatientAccessible', $body);
        $this->assertStringContainsString('loadVisitTypeForFacility', $body);
    }

    public function testTransitionUsesClaimConflictResolver(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'transition');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('resolveTransitionConflict', $body);
        $this->assertStringNotContainsString('throw new StaleVisitException($visitId);', $body);
    }

    public function testResolveTransitionConflictDelegatesToClassifier(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'resolveTransitionConflict');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('VisitTransitionConflictResolver::classify', $body);
        $this->assertStringContainsString('throw new StaleVisitException($visitId);', $body);
        $this->assertStringNotContainsString('Visit is no longer available in the queue', $body);
    }

    public function testClaimConflictResolverBuildsTakenElsewherePayload(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'buildTakenElsewhereException');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("'interrupt' => 'taken_elsewhere'", $body);
        $this->assertStringContainsString('start_triage', $body);
        $this->assertStringContainsString('VisitNotTakeableException', $body);
    }

    public function testStartVisitFromAppointmentUsesAtomicTransactionAndAudit(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'startVisitFromAppointment');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('sqlBeginTrans', $body);
        $this->assertStringContainsString('updateAppointmentStatus', $body);
        $this->assertStringContainsString('started_from_appointment', $body);
        $this->assertStringContainsString('appointment_linked', $body);
        $this->assertStringContainsString('pc_recurrtype', $body);
    }
}
