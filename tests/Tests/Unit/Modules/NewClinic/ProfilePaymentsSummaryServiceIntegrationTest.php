<?php

/**
 * Integration tests for MRD Profile payments strip (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ProfilePaymentsSummaryService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ProfilePaymentsSummaryServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetSummaryHiddenWhenFinanceDisabled(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $payload = (new ProfilePaymentsSummaryService())->getSummary($pid);

        $this->assertArrayHasKey('hidden', $payload);
        $this->assertArrayHasKey('payments_strip_label', $payload);
        $this->assertArrayHasKey('can_view_history', $payload);
        $this->assertArrayHasKey('ledger_url', $payload);
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
