<?php

/**
 * Native patient-wide Prescription History tests (closes "Open Rx list (core)" gap).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PrescriptionHistoryPolicy;
use OpenEMR\Modules\NewClinic\Services\PrescriptionHistoryService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class PrescriptionHistoryServiceTest extends TestCase
{
    use MandatoryTestHelpers;

    public function testPolicyDefaultsOff(): void
    {
        // Flag defaults OFF (install.sql) → stock bridge, 100% legacy (PRD §5.6).
        $facilityId = (new VisitScopeService())->resolveDeskFacilityId();
        $config = new ClinicConfigService();
        if ($config->getInt('enable_native_rx_history', 0, $facilityId) === 1) {
            $this->markTestSkipped('enable_native_rx_history is ON in this environment');
        }
        $this->assertFalse((new PrescriptionHistoryPolicy())->isNativeRxHistoryEnabled($facilityId));
    }

    public function testDeriveStatusDiscontinuedWinsOverFilledDate(): void
    {
        // Discontinuation is definitive regardless of whether it was filled
        // beforehand -- a stopped prescription must never read as "dispensed"
        // or "pending" again.
        $this->assertSame('discontinued', PrescriptionHistoryService::deriveStatus([
            'active' => 0,
            'filled_date' => '2026-07-01',
        ]));
    }

    public function testDeriveStatusPendingWhenNotYetFilled(): void
    {
        $this->assertSame('pending', PrescriptionHistoryService::deriveStatus([
            'active' => 1,
            'filled_date' => '',
        ]));
    }

    public function testDeriveStatusPendingWhenFilledDateIsZeroDate(): void
    {
        $this->assertSame('pending', PrescriptionHistoryService::deriveStatus([
            'active' => 1,
            'filled_date' => '0000-00-00',
        ]));
    }

    public function testDeriveStatusDispensedWhenFilled(): void
    {
        $this->assertSame('dispensed', PrescriptionHistoryService::deriveStatus([
            'active' => 1,
            'filled_date' => '2026-07-14',
        ]));
    }

    public function testFormatSigCombinesDosageRouteAndInterval(): void
    {
        $this->assertSame('500mg PO q8', PrescriptionHistoryService::formatSig([
            'dosage' => '500mg',
            'route' => 'PO',
            'interval' => 8,
        ]));
        $this->assertSame('500mg', PrescriptionHistoryService::formatSig([
            'dosage' => '500mg',
            'route' => '',
            'interval' => null,
        ]));
    }

    /**
     * Regression guard: this read is patient-scoped only (PRD's own bind=NONE
     * classification for the Rx list link) -- it must NOT gate on visit state
     * the way rx-edit.php's assertVisitInPharmacy() does, or historical
     * prescriptions from finished visits would become invisible.
     */
    public function testGetHistoryDoesNotGateOnVisitState(): void
    {
        $body = $this->methodBody(PrescriptionHistoryService::class, 'getHistory');

        $this->assertStringNotContainsString('assertVisitInPharmacy', $body);
        $this->assertStringContainsString('assertPatientAccessible', $body);
    }

    public function testGetHistoryRequiresAccessCheck(): void
    {
        $body = $this->methodBody(PrescriptionHistoryService::class, 'getHistory');

        $this->assertStringContainsString('assertAccess', $body);
    }
}
