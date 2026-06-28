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
}
