<?php

/**
 * Integration tests for clinical meds strip (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicalMedsSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ClinicalMedsSummaryServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetClinicalStripHiddenWhenPharmOpsDisabled(): void
    {
        $config = new ClinicConfigService();
        if ($config->getInt('enable_pharmacy_role', 0, $this->facilityId) === 1
            && $config->getInt('enable_pharm_ops', 0, $this->facilityId) === 1) {
            $this->markTestSkipped('Pharm ops enabled at default facility — strip is expected to render');
        }

        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $payload = (new ClinicalMedsSummaryService())->getClinicalStrip($pid);

        $this->assertArrayHasKey('hidden', $payload);
        $this->assertArrayHasKey('undispensed_count', $payload);
        $this->assertTrue($payload['hidden']);
        $this->assertSame(0, $payload['undispensed_count']);
    }

    private function resolveAnyPatientPid(): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT pid FROM patient_data ORDER BY pid DESC LIMIT 1',
            []
        );

        return is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
    }
}
