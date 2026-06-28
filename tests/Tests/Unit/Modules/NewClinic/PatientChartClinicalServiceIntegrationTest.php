<?php

/**
 * Integration tests for patient chart clinical payload (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\PatientChartClinicalService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class PatientChartClinicalServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetClinicalPayloadShape(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $payload = (new PatientChartClinicalService())->getClinicalPayload($pid);

        $this->assertArrayHasKey('background', $payload);
        $this->assertArrayHasKey('problems', $payload);
        $this->assertArrayHasKey('allergies', $payload);
        $this->assertArrayHasKey('medications', $payload);
        $this->assertArrayHasKey('medications', $payload);
        $this->assertArrayHasKey('immunizations', $payload);
        $this->assertArrayHasKey('labs', $payload);
        $this->assertArrayHasKey('vitals', $payload);
        $this->assertArrayHasKey('this_visit', $payload);
        $this->assertArrayHasKey('anchor', $payload['background']);
        $this->assertArrayHasKey('items', $payload['problems']);
        $this->assertIsArray($payload['problems']['items']);
        $this->assertArrayHasKey('hidden', $payload['this_visit']);
        $this->assertArrayHasKey('forms', $payload['this_visit']);
        $this->assertIsArray($payload['this_visit']['forms']);
        $this->assertArrayHasKey('hidden', $payload['immunizations']);
        $this->assertArrayHasKey('items', $payload['immunizations']);
        $this->assertIsArray($payload['immunizations']['items']);
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
