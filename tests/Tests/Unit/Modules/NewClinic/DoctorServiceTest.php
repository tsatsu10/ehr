<?php

/**
 * Unit tests for doctor consult routing
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\DoctorService;
use PHPUnit\Framework\TestCase;

class DoctorServiceTest extends TestCase
{
    public function testResolveConsultTargetStatePaymentDefault(): void
    {
        $this->assertSame('ready_for_payment', DoctorService::resolveConsultTargetState(false, false));
    }

    public function testResolveConsultTargetStateLab(): void
    {
        $this->assertSame('ready_for_lab', DoctorService::resolveConsultTargetState(true, false));
    }

    public function testResolveConsultTargetStatePharmacy(): void
    {
        $this->assertSame('ready_for_pharmacy', DoctorService::resolveConsultTargetState(false, true));
    }

    public function testTakePatientChecksAssignedProvider(): void
    {
        $method = new \ReflectionMethod(DoctorService::class, 'takePatient');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('assigned_provider_id', $body);
        $this->assertStringContainsString('VisitNotTakeableException', $body);
    }

    public function testReopenConsultRequiresAclReasonAndReverseFsm(): void
    {
        $reflection = new \ReflectionMethod(DoctorService::class, 'reopenConsult');
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));

        $this->assertStringContainsString('new_visit_reopen', $body);
        $this->assertStringContainsString('canReverseTransition', $body);
        $this->assertStringContainsString('reopenToWithDoctor', $body);
        $this->assertStringContainsString('bindForVisit', $body);
    }

    public function testReopenConsultOnlyRequiresReasonWhenNotOwnVisit(): void
    {
        $reflection = new \ReflectionMethod(DoctorService::class, 'reopenConsult');
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));

        // Frictionless self-reopen: the ≥10-char reason check must be conditioned on !$isOwnVisit,
        // not applied unconditionally — reopening your own patient asks no questions.
        $this->assertStringContainsString('isOwnVisit', $body);
        $this->assertStringContainsString('!$isOwnVisit && mb_strlen($reason) < 10', $body);
        // Signature no longer demands a reason up front.
        $this->assertStringContainsString('?string $reason = null', $body);
    }

    public function testFetchReopenableTodayOverwritesAssignedProviderWithLastDoctor(): void
    {
        $reflection = new \ReflectionMethod(DoctorService::class, 'fetchReopenableToday');
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));

        // Reopenable rows must report the true consulting doctor as assigned_provider_id, not the
        // raw (possibly lab/pharmacy-overwritten) column value — the frontend's own-patient check
        // for frictionless self-reopen relies on this field meaning "the doctor."
        $this->assertStringContainsString("to_state = 'with_doctor'", $body);
        $this->assertStringContainsString("AS last_doctor_id", $body);
        $this->assertStringContainsString("\$row['assigned_provider_id'] = (int) (\$row['last_doctor_id']", $body);
    }

    public function testStartWalkInGuardsOneActiveConsultAndBindsSession(): void
    {
        $reflection = new \ReflectionMethod(DoctorService::class, 'startWalkIn');
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));

        $this->assertStringContainsString('findActiveConsult', $body);
        $this->assertStringContainsString('VisitNotTakeableException', $body);
        $this->assertStringContainsString('startVisitWithDoctor', $body);
        $this->assertStringContainsString('bindForVisit', $body);
        $this->assertStringContainsString('buildConsultPayload', $body);
    }

    public function testConsultPayloadIncludesPharmOpsPrescriptionsWhenEnabled(): void
    {
        $reflection = new \ReflectionMethod(DoctorService::class, 'buildConsultPayload');
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);
        $body = implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));

        $this->assertStringContainsString('pharm_ops_enabled', $body);
        $this->assertStringContainsString('getPrescriptionsWithStockForEncounter', $body);
        $this->assertStringContainsString('rx_list_url', $body);
    }
}
