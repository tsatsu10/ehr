<?php

/**
 * Integration tests for patient activity feed (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\PatientActivityFeedService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class PatientActivityFeedServiceIntegrationTest extends TestCase
{
    private int $facilityId = 0;

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }
    }

    public function testGetActivityFeedShape(): void
    {
        $pid = $this->resolvePatientWithStateLog();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient with visit state log rows');
        }

        $feed = (new PatientActivityFeedService())->getActivityFeed($pid, 0, 5);

        $this->assertArrayHasKey('items', $feed);
        $this->assertArrayHasKey('total', $feed);
        $this->assertArrayHasKey('has_more', $feed);
        $this->assertArrayHasKey('lookback_days', $feed);
        $this->assertIsArray($feed['items']);

        if ($feed['items'] !== []) {
            $item = $feed['items'][0];
            $this->assertArrayHasKey('event_type', $item);
            $this->assertArrayHasKey('title', $item);
            $this->assertArrayHasKey('subtitle', $item);
        }
    }

    public function testGetOverviewBlocksShape(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $blocks = (new PatientActivityFeedService())->getOverviewBlocks($pid);

        $this->assertArrayHasKey('action_required', $blocks);
        $this->assertArrayHasKey('activity_feed', $blocks);
        $this->assertIsArray($blocks['action_required']);
    }

    private function resolvePatientWithStateLog(): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT v.pid FROM new_visit_state_log l
             INNER JOIN new_visit v ON v.id = l.visit_id
             WHERE v.facility_id = ?
             ORDER BY l.id DESC LIMIT 1',
            [$this->facilityId]
        );

        return is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
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
