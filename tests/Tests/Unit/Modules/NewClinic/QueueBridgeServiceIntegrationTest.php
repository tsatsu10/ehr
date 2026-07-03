<?php

/**
 * M18 Queue Bridge integration tests (BRIDGE-1, BRIDGE-5, BRIDGE-6, BRIDGE-7).
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
use OpenEMR\Modules\NewClinic\Services\QueueBridgeExceptionService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeSurfaceService;
use OpenEMR\Modules\NewClinic\Services\ReportsSchedulingService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class QueueBridgeServiceIntegrationTest extends TestCase
{
    private const FIXTURE_TITLE = 'NC-BRIDGE-FIXTURE-EX01';

    private static bool $bootstrapped = false;

    private int $facilityId = 0;

    public static function setUpBeforeClass(): void
    {
        if (!self::$bootstrapped) {
            $_GET['site'] = 'default';
            $ignoreAuth = true;
            require_once dirname(__DIR__, 5) . '/interface/globals.php';
            require_once dirname(__DIR__, 5)
                . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/golden-path-e2e-prep.php';
            goldenPathGrantAclToGroup('Administrators', 'new_queue_bridge', 'Queue Bridge Hub');
            goldenPathGrantAclToGroup('Administrators', 'new_queue_bridge_resolve', 'Queue Bridge Resolve Actions');
            self::$bootstrapped = true;
        }
    }

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }

        $admin = QueryUtils::querySingleRow(
            "SELECT id, username FROM users WHERE username = 'Adminstrator' OR username = 'admin' ORDER BY id ASC LIMIT 1"
        );
        if (!is_array($admin) || empty($admin['id'])) {
            $this->markTestSkipped('No admin user for ACL-backed bridge resolve test');
        }

        $_SESSION['authUser'] = (string) ($admin['username'] ?? 'Adminstrator');
        $_SESSION['authUserID'] = (int) $admin['id'];
        $_SESSION['facilityId'] = $this->facilityId;
    }

    public function testListExceptionsPayloadShape(): void
    {
        $this->ensureHubEnabled();

        $list = (new QueueBridgeService())->listExceptions($this->facilityId, 'action');

        $this->assertArrayHasKey('rows', $list);
        $this->assertArrayHasKey('counts', $list);
        $this->assertArrayHasKey('links', $list);
        $this->assertArrayHasKey('snapshot_date', $list);
        $this->assertSame('action', $list['lens']);
    }

    public function testEx01FixtureDetectedWhenPresent(): void
    {
        $this->ensureHubEnabled();
        if (!$this->fixtureExists()) {
            $this->markTestSkipped('Run scripts/queue-bridge-fixture-seed.php to create EX-01 fixture');
        }

        $fixture = QueryUtils::querySingleRow(
            "SELECT pc_eid, pc_pid FROM openemr_postcalendar_events
             WHERE pc_title = ? AND pc_eventDate = CURDATE() LIMIT 1",
            [self::FIXTURE_TITLE]
        );
        if (!is_array($fixture)) {
            $this->markTestSkipped('Fixture row missing');
        }

        $pcEid = (int) ($fixture['pc_eid'] ?? 0);
        $linked = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit WHERE pc_eid = ? AND visit_date = CURDATE() AND state NOT IN (\'cancelled\') LIMIT 1',
            [$pcEid]
        );
        if (is_array($linked) && !empty($linked['id'])) {
            $this->markTestSkipped('Fixture already consumed — run queue-bridge-fixture-seed.php --cleanup then re-seed');
        }

        $rows = (new QueueBridgeExceptionService())->detectToday($this->facilityId, date('Y-m-d'));
        $ex01 = array_values(array_filter(
            $rows,
            static fn (array $row): bool => ($row['exception_code'] ?? '') === 'EX-01'
                && (int) ($row['pc_eid'] ?? 0) === $pcEid
        ));

        $this->assertNotEmpty($ex01, 'EX-01 should appear for arrived-without-visit fixture (BRIDGE-1)');
    }

    public function testResolveAuditSnapshotWritten(): void
    {
        $this->ensureHubEnabled();
        if (!$this->fixtureExists()) {
            $this->markTestSkipped('Run scripts/queue-bridge-fixture-seed.php to create EX-01 fixture');
        }

        $fixture = QueryUtils::querySingleRow(
            "SELECT pc_eid, pc_pid FROM openemr_postcalendar_events
             WHERE pc_title = ? AND pc_eventDate = CURDATE() LIMIT 1",
            [self::FIXTURE_TITLE]
        );
        if (!is_array($fixture)) {
            $this->markTestSkipped('Fixture row missing');
        }

        $pid = (int) ($fixture['pc_pid'] ?? 0);
        $pcEid = (int) ($fixture['pc_eid'] ?? 0);
        $linked = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit WHERE pc_eid = ? AND visit_date = CURDATE() AND state NOT IN (\'cancelled\') LIMIT 1',
            [$pcEid]
        );
        if (is_array($linked) && !empty($linked['id'])) {
            $this->markTestSkipped('Fixture already resolved to a visit today');
        }

        $activeToday = QueryUtils::querySingleRow(
            "SELECT id FROM new_visit WHERE pid = ? AND visit_date = CURDATE()
             AND facility_id = ? AND state NOT IN ('cancelled', 'completed', 'closed_unpaid') LIMIT 1",
            [$pid, $this->facilityId]
        );
        if (is_array($activeToday) && !empty($activeToday['id'])) {
            $this->markTestSkipped('Fixture patient already has an active visit today');
        }

        $actorUserId = (int) (QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ? LIMIT 1', ['Adminstrator'])['id'] ?? 1);

        $service = new QueueBridgeService();
        try {
            $service->resolve(
                'EX-01',
                'start_visit_checkin',
                $pid,
                $this->facilityId,
                $actorUserId,
                $pcEid,
                null,
                date('Y-m-d')
            );
        } catch (\InvalidArgumentException $e) {
            if (str_contains($e->getMessage(), 'Active visit already exists')) {
                $this->markTestSkipped($e->getMessage());
            }
            throw $e;
        }

        $snapshot = QueryUtils::querySingleRow(
            "SELECT resolve_action FROM queue_bridge_exception_snapshot
             WHERE facility_id = ? AND snapshot_date = CURDATE() AND exception_code = 'EX-01'
               AND pid = ? AND pc_eid = ? AND resolve_action = 'start_visit_checkin'
             ORDER BY id DESC LIMIT 1",
            [$this->facilityId, $pid, $pcEid]
        );

        $this->assertIsArray($snapshot);
        $this->assertSame('start_visit_checkin', $snapshot['resolve_action'] ?? null);
    }

    public function testHubOffSurfacesAreEmpty(): void
    {
        $config = new ClinicConfigService();
        $prevGlobal = $config->get('enable_queue_bridge', '0', 0);
        $prevFacility = $config->get('enable_queue_bridge', '0', $this->facilityId);

        $config->set('enable_queue_bridge', '0', 0);
        $config->set('enable_queue_bridge', '0', $this->facilityId);

        try {
            $surface = new QueueBridgeSurfaceService();
            $this->assertSame([], $surface->visitBadgeMap($this->facilityId));
            $this->assertFalse($surface->patientFlags(1, $this->facilityId)['enabled'] ?? true);
            $footer = $surface->schedulingFooter($this->facilityId);
            $this->assertFalse($footer['enabled'] ?? true);
        } finally {
            $config->set('enable_queue_bridge', $prevGlobal, 0);
            $config->set('enable_queue_bridge', $prevFacility, $this->facilityId);
        }
    }

    public function testSchedulingReportOrthogonalityNote(): void
    {
        $this->ensureHubEnabled();

        $report = (new ReportsSchedulingService())->getReport($this->facilityId, date('Y-m-d'));

        $this->assertTrue($report['enabled'] ?? false);
        $this->assertStringContainsString('do not add them together', strtolower((string) ($report['orthogonality_note'] ?? '')));
        $this->assertArrayHasKey('queue_bridge', $report);
    }

    private function ensureHubEnabled(): void
    {
        $config = new ClinicConfigService();
        $config->set('enable_scheduled_integration', '1', 0);
        $config->set('enable_scheduled_integration', '1', $this->facilityId);
        $config->set('enable_queue_bridge', '1', 0);
        $config->set('enable_queue_bridge', '1', $this->facilityId);
    }

    private function fixtureExists(): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT pc_eid FROM openemr_postcalendar_events
             WHERE pc_title = ? AND pc_eventDate = CURDATE() AND pc_apptstatus = '@' LIMIT 1",
            [self::FIXTURE_TITLE]
        );

        return is_array($row) && !empty($row['pc_eid']);
    }
}
