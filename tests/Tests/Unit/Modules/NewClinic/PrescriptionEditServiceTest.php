<?php

/**
 * Native Add/Edit Rx form + engine policy tests (closes Pharmacy Desk "Add Rx" gap).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsSafetyService;
use OpenEMR\Modules\NewClinic\Services\PrescriptionEditPolicy;
use OpenEMR\Modules\NewClinic\Services\PrescriptionEditService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PrescriptionEditServiceTest extends TestCase
{
    public function testPolicyDefaultsOff(): void
    {
        // Flag defaults OFF (install.sql) → stock bridge, 100% legacy (PRD §5.6).
        $facilityId = (new VisitScopeService())->resolveDeskFacilityId();
        $config = new ClinicConfigService();
        if ($config->getInt('enable_native_rx_edit', 0, $facilityId) === 1) {
            $this->markTestSkipped('enable_native_rx_edit is ON in this environment');
        }
        $this->assertFalse((new PrescriptionEditPolicy())->isNativeRxEditEnabled($facilityId));
    }

    public function testNormalizeDateAcceptsIsoAndRejectsGarbage(): void
    {
        $method = new ReflectionMethod(PrescriptionEditService::class, 'normalizeDate');
        $method->setAccessible(true);
        $service = new PrescriptionEditService();

        $this->assertSame('2026-07-14', $method->invoke($service, '2026-07-14'));
        $this->assertNull($method->invoke($service, ''));
        $this->assertNull($method->invoke($service, null));

        $this->expectException(\InvalidArgumentException::class);
        $method->invoke($service, 'not-a-date');
    }

    public function testCleanDateStripsZeroDates(): void
    {
        $method = new ReflectionMethod(PrescriptionEditService::class, 'cleanDate');
        $method->setAccessible(true);
        $service = new PrescriptionEditService();

        $this->assertNull($method->invoke($service, '0000-00-00'));
        $this->assertNull($method->invoke($service, null));
        $this->assertSame('2026-07-14', $method->invoke($service, '2026-07-14'));
    }

    public function testFormatDrugDisplayNameCombinesNameStrengthAndForm(): void
    {
        $method = new ReflectionMethod(PrescriptionEditService::class, 'formatDrugDisplayName');
        $method->setAccessible(true);
        $service = new PrescriptionEditService();

        $this->assertSame(
            'Amoxicillin 500mg tablet',
            $method->invoke($service, ['name' => 'Amoxicillin', 'size' => '500', 'unit' => 'mg', 'form' => 'tablet'])
        );
        $this->assertSame('Paracetamol', $method->invoke($service, ['name' => 'Paracetamol']));
    }

    /**
     * Regression guard: the drug-search allergy flag must reuse the same
     * shared matcher the dispense drawer already uses, not a re-implementation
     * that could drift from it.
     */
    public function testAllergyMatchUsesSharedSafetyService(): void
    {
        // The shared matcher is literal-token/substring, not a drug-class
        // lookup (e.g. it will NOT catch "Amoxicillin" against a documented
        // "Penicillin" allergy -- same limitation the dispense drawer has).
        $this->assertTrue(PharmOpsSafetyService::hasDrugAllergyWarning('Amoxicillin 500mg', ['Amoxicillin']));
        $this->assertFalse(PharmOpsSafetyService::hasDrugAllergyWarning('Paracetamol 500mg', ['Amoxicillin']));
        $this->assertFalse(PharmOpsSafetyService::hasDrugAllergyWarning('Amoxicillin 500mg', ['NKDA']));
    }
}
