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

    public function testSetUrgencySelfContainsAccessAndReasonValidation(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'setUrgency');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        // Re-validates access and state itself, like cancelVisit() — not just trusting the caller.
        $this->assertStringContainsString('getVisitForActor', $body);
        $this->assertStringContainsString("in_array(\$visit['state'], ['waiting', 'in_triage']", $body);

        // Reason-required-to-de-escalate is enforced at this layer, not only by the caller.
        $this->assertStringContainsString('Reason required to remove the urgent flag', $body);
    }

    public function testSetUrgencyPinsStateAndAlwaysEnforcesRowVersion(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'setUrgency');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        // The UPDATE's WHERE clause pins state, matching transition()/cancelVisit() — not just id + row_version.
        $this->assertStringContainsString("state IN ('waiting', 'in_triage') AND row_version = ?", $body);

        // No early return before the versioned UPDATE runs — even a value-unchanged request must
        // pass the optimistic-lock check, so a stale caller can never get a silent "success".
        $this->assertStringNotContainsString('return $visit;', $body);
        $this->assertStringContainsString('generic_sql_affected_rows() < 1', $body);
        $this->assertStringContainsString('throw new StaleVisitException($visitId);', $body);
    }

    public function testSetUrgencyThreadsActorIntoAuditPayload(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'setUrgency');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("'actor_user_id' => \$actorUserId", $body);
        $this->assertStringContainsString("'urgency_changed'", $body);
    }

    public function testSendBackToDoctorRoutesToSharedPoolNotWithDoctor(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'sendBackToDoctor');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('new_visit_return_to_doctor', $body);
        $this->assertStringContainsString("canReverseTransition(\$fromState, 'ready_for_doctor')", $body);
        // Never binds a session or targets with_doctor directly — shared pool, no session lock.
        $this->assertStringNotContainsString("state = 'with_doctor'", $body);
        $this->assertStringContainsString('routing_suggested_provider_id', $body);
        // The suggestion hint is the doctor who actually conducted the consult (from the state
        // log), not new_visit.assigned_provider_id — lab/pharmacy overwrite that field once they
        // take the patient after the doctor releases it.
        $this->assertStringContainsString('lastDoctorForVisit($visitId)', $body);
        $this->assertStringNotContainsString("\$visit['assigned_provider_id']", $body);
    }

    public function testStartVisitWithDoctorRequiresFullOpdAndBindsAssignedProvider(): void
    {
        $method = new ReflectionMethod(VisitQueueService::class, 'startVisitWithDoctor');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('new_doctor', $body);
        $this->assertStringContainsString("service_profile'] !== 'full_opd'", $body);
        $this->assertStringContainsString("'with_doctor'", $body);
        $this->assertStringContainsString('$actorUserId', $body);
    }
}
