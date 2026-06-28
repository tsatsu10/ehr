<?php

/**
 * Integration tests for patient chart visits payload (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\PatientChartService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class PatientChartServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetVisitsPayloadShapeForPatientWithVisits(): void
    {
        $pid = $this->resolvePatientWithVisits();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient with new_visit rows');
        }

        $payload = (new PatientChartService())->getVisitsPayload($pid, 0, 5);

        $this->assertArrayHasKey('visit_date', $payload);
        $this->assertArrayHasKey('today_visits', $payload);
        $this->assertArrayHasKey('past_visits', $payload);
        $this->assertArrayHasKey('past_total', $payload);
        $this->assertArrayHasKey('past_has_more', $payload);
        $this->assertIsArray($payload['today_visits']);
        $this->assertIsArray($payload['past_visits']);
        $this->assertIsInt($payload['past_total']);

        if ($payload['today_visits'] !== []) {
            $visit = $payload['today_visits'][0];
            $this->assertArrayHasKey('id', $visit);
            $this->assertArrayHasKey('state', $visit);
            $this->assertArrayHasKey('queue_number', $visit);
            $this->assertArrayHasKey('visit_type_label', $visit);
            $this->assertArrayHasKey('documentation_url', $visit);
        }

        foreach (array_merge($payload['today_visits'], $payload['past_visits']) as $visit) {
            $encounter = (int) ($visit['encounter'] ?? 0);
            if ($encounter > 0) {
                $this->assertNotEmpty($visit['documentation_url']);
                $this->assertStringContainsString('set_encounter=' . $encounter, (string) $visit['documentation_url']);
            } else {
                $this->assertNull($visit['documentation_url']);
            }
        }
    }

    private function resolvePatientWithVisits(): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT pid FROM new_visit WHERE facility_id = ? ORDER BY visit_date DESC LIMIT 1',
            [$this->facilityId]
        );

        return is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
    }
}
