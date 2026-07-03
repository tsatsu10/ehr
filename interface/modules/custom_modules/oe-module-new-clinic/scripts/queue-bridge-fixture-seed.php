<?php

/**
 * Seed EX-01 fixture for Queue Bridge integration / E2E tests (BRIDGE-1).
 *
 * Creates an arrived (@) appointment today with no matching new_visit — safe marker title.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/queue-bridge-fixture-seed.php
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/queue-bridge-fixture-seed.php --cleanup
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

const NC_BRIDGE_FIXTURE_TITLE = 'NC-BRIDGE-FIXTURE-EX01';

$cleanup = in_array('--cleanup', $argv ?? [], true);
$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    echo "No default facility — abort.\n";
    exit(1);
}

if ($cleanup) {
    $rows = QueryUtils::fetchRecords(
        "SELECT pc_eid FROM openemr_postcalendar_events WHERE pc_title = ?",
        [NC_BRIDGE_FIXTURE_TITLE]
    ) ?: [];
    foreach ($rows as $row) {
        $pcEid = (int) ($row['pc_eid'] ?? 0);
        if ($pcEid > 0) {
            sqlStatement(
                'DELETE FROM new_visit WHERE pc_eid = ? AND visit_date = CURDATE()',
                [$pcEid]
            );
        }
        sqlStatement(
            'DELETE FROM openemr_postcalendar_events WHERE pc_eid = ?',
            [$pcEid]
        );
    }
    sqlStatement(
        "DELETE FROM queue_bridge_exception_snapshot
         WHERE exception_code = 'EX-01' AND snapshot_date = CURDATE()"
    );
    echo 'Removed ' . count($rows) . " bridge fixture appointment(s).\n";
    exit(0);
}

$existing = QueryUtils::querySingleRow(
    "SELECT pc_eid FROM openemr_postcalendar_events WHERE pc_title = ? AND pc_eventDate = CURDATE() LIMIT 1",
    [NC_BRIDGE_FIXTURE_TITLE]
);
if (is_array($existing) && !empty($existing['pc_eid'])) {
    echo 'Fixture already exists: pc_eid ' . (int) $existing['pc_eid'] . "\n";
    exit(0);
}

$patient = QueryUtils::querySingleRow(
    "SELECT pd.pid FROM patient_data pd
     WHERE NOT EXISTS (
         SELECT 1 FROM new_visit nv
         WHERE nv.pid = pd.pid AND nv.visit_date = CURDATE()
           AND nv.facility_id = ? AND nv.state NOT IN ('cancelled', 'completed', 'closed_unpaid')
     )
     ORDER BY pd.pid ASC LIMIT 1",
    [$facilityId]
);
$pid = (int) ($patient['pid'] ?? 0);
if ($pid <= 0) {
    echo "No patient in database — abort.\n";
    exit(1);
}

$today = date('Y-m-d');
sqlStatement(
    "INSERT INTO openemr_postcalendar_events
        (pc_catid, pc_multiple, pc_aid, pc_pid, pc_title, pc_eventDate, pc_endDate,
         pc_duration, pc_recurrtype, pc_startTime, pc_endTime, pc_eventstatus, pc_apptstatus, pc_facility)
     VALUES (?, 0, '1', ?, ?, ?, ?, 900, 0, '09:00:00', '09:15:00', 1, '@', ?)",
    [5, (string) $pid, NC_BRIDGE_FIXTURE_TITLE, $today, $today, $facilityId]
);

$created = QueryUtils::querySingleRow(
    "SELECT pc_eid FROM openemr_postcalendar_events
     WHERE pc_title = ? AND pc_eventDate = CURDATE()
     ORDER BY pc_eid DESC LIMIT 1",
    [NC_BRIDGE_FIXTURE_TITLE]
);
$newId = is_array($created) ? (int) ($created['pc_eid'] ?? 0) : 0;
echo "Created EX-01 fixture pc_eid={$newId} pid={$pid} facility={$facilityId}.\n";
echo "Run PHPUnit: vendor/bin/phpunit tests/Tests/Unit/Modules/NewClinic/QueueBridgeServiceIntegrationTest.php\n";
