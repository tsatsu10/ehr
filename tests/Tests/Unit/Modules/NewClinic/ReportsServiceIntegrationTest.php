<?php

/**
 * Integration tests for daily reports (requires local DB via tests/bootstrap.php)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ReportsService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ReportsServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetDailyReportIncludesDataQualityWithoutSqlErrors(): void
    {
        $visitDate = $this->resolveReportDate();
        $report = (new ReportsService())->getDailyReport($this->facilityId, $visitDate);

        $this->assertSame($visitDate, $report['visit_date']);
        $this->assertSame($this->facilityId, $report['facility_id']);
        $this->assertArrayHasKey('visits', $report);
        $this->assertArrayHasKey('cash', $report);
        $this->assertArrayHasKey('data_quality', $report);

        $quality = $report['data_quality'];
        $this->assertIsInt($quality['dup_overrides_today']);
        $this->assertIsInt($quality['patients_registered_today']);
        $this->assertIsArray($quality['completion_buckets']);
        $this->assertArrayHasKey('billing_threshold', $quality);
    }

    public function testDataQualityDupOverrideQueryUsesLogPatientIdColumn(): void
    {
        $visitDate = $this->resolveReportDate();

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT l.id) AS cnt FROM log l
             WHERE DATE(l.date) = ? AND l.event = 'new_patient' AND l.category = 'dup_override'
             AND (
                l.patient_id = 0
                OR EXISTS (
                    SELECT 1 FROM new_visit v
                    WHERE v.pid = l.patient_id AND v.facility_id = ? AND v.visit_date = ?
                )
             )",
            [$visitDate, $this->facilityId, $visitDate]
        );

        $this->assertIsArray($row);
        $this->assertArrayHasKey('cnt', $row);
    }

    private function resolveReportDate(): string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT visit_date FROM new_visit WHERE facility_id = ? ORDER BY visit_date DESC LIMIT 1',
            [$this->facilityId]
        );

        if (is_array($row) && !empty($row['visit_date'])) {
            return (string) $row['visit_date'];
        }

        return date('Y-m-d');
    }
}
