<?php

/**
 * Integration tests for clinical referrals strip (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ReferralCorrespondenceService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ReferralCorrespondenceServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetClinicalStripHiddenWhenReferralsDisabled(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        // Pin the test's own premise: "referrals disabled" must be forced, not
        // assumed from ambient DB state — an earlier test in a full-suite run can
        // leave enable_chart_depth(_referral) on and flip the strip visible
        // (ordering flake: passed in isolation, failed in the full run).
        // Both flags must be 1 for the strip, so pinning enable_chart_depth = 0
        // suffices; the facility-scoped row wins over global, so pin both rows
        // (raw-row-aware restore, matching the ReportHubExportServiceTest precedent).
        $config = new ClinicConfigService();
        $prevGlobal = $config->get('enable_chart_depth', '0', 0);
        $prevFacilityRaw = $this->rawConfigRow('enable_chart_depth', $this->facilityId);
        try {
            $config->set('enable_chart_depth', '0', 0);
            $config->set('enable_chart_depth', '0', $this->facilityId);

            $payload = (new ReferralCorrespondenceService())->getClinicalStrip($pid);

            $this->assertArrayHasKey('hidden', $payload);
            $this->assertArrayHasKey('items', $payload);
            $this->assertIsArray($payload['items']);
            $this->assertTrue($payload['hidden']);
        } finally {
            $config->set('enable_chart_depth', (string) $prevGlobal, 0);
            if ($prevFacilityRaw !== null) {
                $config->set('enable_chart_depth', $prevFacilityRaw, $this->facilityId);
            } else {
                sqlStatement(
                    'DELETE FROM new_clinic_config WHERE facility_id = ? AND config_key = ?',
                    [$this->facilityId, 'enable_chart_depth']
                );
            }
        }
    }

    private function rawConfigRow(string $key, int $facilityId): ?string
    {
        $row = sqlQuery(
            'SELECT config_value FROM new_clinic_config WHERE facility_id = ? AND config_key = ?',
            [$facilityId, $key]
        );

        return is_array($row) && array_key_exists('config_value', $row)
            ? (string) $row['config_value']
            : null;
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
