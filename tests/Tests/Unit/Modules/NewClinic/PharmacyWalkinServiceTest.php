<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PharmacyWalkinService;
use OpenEMR\Modules\NewClinic\Services\ReportsAncillaryService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PharmacyWalkinServiceTest extends TestCase
{
    public function testDispenseOutcomesAreSubsetOfAncillaryReport(): void
    {
        foreach (PharmacyWalkinService::DISPENSE_OUTCOMES as $outcome) {
            $this->assertContains($outcome, ReportsAncillaryService::PHARMACY_OUTCOMES);
        }
    }

    public function testRejectsInvalidDispenseOutcome(): void
    {
        $service = new PharmacyWalkinService();
        $this->expectException(\InvalidArgumentException::class);
        $service->assertDispenseOutcome('invalid');
    }

    public function testRejectsInvalidNonDispenseOutcome(): void
    {
        $service = new PharmacyWalkinService();
        $this->expectException(\InvalidArgumentException::class);
        $service->assertNonDispenseOutcome('otc_dispensed');
    }

    public function testDoctorAvailabilityGuardBlocksNoDoctorOutcomeWhenDoctorOnDuty(): void
    {
        $method = new ReflectionMethod(PharmacyWalkinService::class, 'assertDoctorAvailabilityForOutcome');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('rx_required_no_doctor_available', $body);
        $this->assertStringContainsString('A doctor is on duty', $body);
    }

    public function testAclSetupDefinesWalkinDispenseAndReferKeys(): void
    {
        $path = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic/acl/acl_setup.php';
        $this->assertFileExists($path);
        $source = file_get_contents($path);
        $this->assertIsString($source);
        $this->assertStringContainsString('new_pharmacy_walkin_dispense', $source);
        $this->assertStringContainsString('new_pharmacy_refer_to_opd', $source);
    }
}
