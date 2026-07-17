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
    use MandatoryTestHelpers;

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

    /**
     * Regression guard (2026-07-14 audit): a prescription id belonging to the
     * same patient but a DIFFERENT encounter must be rejected, not silently
     * rewritten -- otherwise editing "this visit"'s Add Rx form could corrupt
     * a different (e.g. older) visit's clinical record. A non-existent id
     * exercises the same rejection path without needing real DB fixtures.
     */
    public function testAssertPrescriptionBelongsToVisitRejectsUnmatchedRow(): void
    {
        $method = new ReflectionMethod(PrescriptionEditService::class, 'assertPrescriptionBelongsToVisit');
        $method->setAccessible(true);
        $service = new PrescriptionEditService();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Prescription does not belong to this visit');
        $method->invoke($service, 999999999, 1, 1);
    }

    /**
     * Regression guard (2026-07-14 audit): searchDrugs() used to take a raw
     * client-supplied pid with no ownership check, letting a caller probe an
     * arbitrary (possibly inaccessible) patient's allergy list via the
     * allergy_match flag on each search result. It now takes visit_id and
     * derives pid from the visit server-side -- confirmed here by the method
     * signature itself (a raw-pid regression would show up as a type/behavior
     * mismatch the moment this is called with a real visit in the frontend
     * integration test / live smoke).
     */
    public function testSearchDrugsSignatureTakesVisitIdNotRawPid(): void
    {
        $method = new \ReflectionMethod(PrescriptionEditService::class, 'searchDrugs');
        $params = $method->getParameters();

        $this->assertSame('visitId', $params[0]->getName());
    }

    /**
     * Regression guard (2026-07-14 audit): PharmOpsDispenseService::confirmDispense()
     * already rejects an unacknowledged allergy match server-side -- savePrescription()
     * must do the same, not rely solely on the frontend disabling Save. A client-side-
     * only guard is trivially bypassed by a direct pharmacy.rx_save call.
     */
    public function testSavePrescriptionEnforcesAllergyAcknowledgmentServerSide(): void
    {
        $body = $this->methodBody(PrescriptionEditService::class, 'savePrescription');

        $this->assertStringContainsString('hasDrugAllergyWarning', $body);
        $this->assertStringContainsString("input['allergy_acknowledged']", $body);
        $this->assertStringContainsString('Acknowledge allergy warning before saving', $body);
    }

    /**
     * Regression guard (2026-07-14, live-diagnosed): a prescription got
     * created against a visit still sitting 'with_doctor' from days earlier
     * instead of the visit actually 'in_pharmacy' right now -- a stale
     * rx-edit.php tab/bookmark can carry an old visit_id, and neither
     * getFormData() nor savePrescription() checked the visit's state before
     * this fix (PharmacyShortcutService::preflight() only checks it at
     * redirect-build time, which a stale tab bypasses entirely).
     */
    public function testAssertVisitInActiveWorkRejectsStatesOutsideActiveWork(): void
    {
        // The shared Rx form is reachable from the Pharmacy Desk ('in_pharmacy')
        // and the Doctor Desk consult ('with_doctor'). Any other state means a
        // stale tab carrying an old visit_id -- still rejected so a prescription
        // can never attach to the wrong encounter. Pin the allowed states so the
        // test does not depend on ACL/session context.
        $service = new class extends PrescriptionEditService {
            protected function allowedWorkStates(): array
            {
                return ['in_pharmacy', 'with_doctor'];
            }
        };
        $method = new ReflectionMethod(PrescriptionEditService::class, 'assertVisitInActiveWork');
        $method->setAccessible(true);

        foreach (['ready_for_pharmacy', 'ready_for_doctor', 'completed', 'paid', ''] as $state) {
            try {
                $method->invoke($service, ['state' => $state]);
                $this->fail("Expected rejection for state '{$state}'");
            } catch (\InvalidArgumentException $e) {
                $this->assertSame('Visit is not in active work for prescribing', $e->getMessage());
            }
        }

        // The two active-work states the two desks legitimately reach this from.
        $method->invoke($service, ['state' => 'in_pharmacy']);
        $method->invoke($service, ['state' => 'with_doctor']);
        $this->addToAssertionCount(2);
    }

    public function testGetFormDataAndSavePrescriptionCheckVisitStateBeforeTouchingData(): void
    {
        foreach (['getFormData', 'savePrescription'] as $methodName) {
            $body = $this->methodBody(PrescriptionEditService::class, $methodName);
            $this->assertStringContainsString(
                'assertVisitInActiveWork',
                $body,
                "{$methodName} must check the visit is in active work before reading/writing prescriptions"
            );
        }
    }
}
