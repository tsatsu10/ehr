<?php

/**
 * Seed daily recurring appointment for scheduling E2E (recurring move + scope modal).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/scheduling-recurring-fixture-seed.php
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/scheduling-recurring-fixture-seed.php --cleanup
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

const NC_RECURRING_FIXTURE_TITLE = 'NC-RECURRING-E2E-FIXTURE';
const NC_RECURRING_START_TIME = '10:00:00';

$cleanup = in_array('--cleanup', $argv ?? [], true);
$config = new ClinicConfigService();
$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    echo "No default facility — abort.\n";
    exit(1);
}

pilotEnsureNewClinicAclObjects();
$config->set('enable_scheduled_integration', '1', $facilityId);
$config->set('enable_scheduled_integration', '1', 0);
$config->set('enable_scheduling_redesign', '1', $facilityId);
$config->set('enable_scheduling_redesign', '1', 0);
$config->set('enable_react_scheduling', '1', 0);

$removeFixtures = static function (): int {
    $rows = QueryUtils::fetchRecords(
        "SELECT pc_eid FROM openemr_postcalendar_events WHERE pc_title = ?",
        [NC_RECURRING_FIXTURE_TITLE]
    ) ?: [];
    foreach ($rows as $row) {
        sqlStatement(
            'DELETE FROM openemr_postcalendar_events WHERE pc_eid = ?',
            [(int) ($row['pc_eid'] ?? 0)]
        );
    }

    return count($rows);
};

if ($cleanup) {
    $removed = $removeFixtures();
    echo "Removed {$removed} recurring fixture appointment(s).\n";
    exit(0);
}

$removed = $removeFixtures();
if ($removed > 0) {
    echo "Refreshed {$removed} stale recurring fixture appointment(s).\n";
}

$patient = QueryUtils::querySingleRow(
    'SELECT pid, fname, lname FROM patient_data ORDER BY pid ASC LIMIT 1'
);
$pid = (int) ($patient['pid'] ?? 0);
if ($pid <= 0) {
    echo "No patient in database — abort.\n";
    exit(1);
}

$provider = QueryUtils::querySingleRow(
    'SELECT id FROM users WHERE authorized = 1 AND active = 1 ORDER BY id ASC LIMIT 1'
);
$providerId = (int) ($provider['id'] ?? 0);
if ($providerId <= 0) {
    echo "No authorized provider — abort.\n";
    exit(1);
}

$today = date('Y-m-d');
$endDate = date('Y-m-d', strtotime('+14 days'));
$recurrspec = serialize([
    'event_repeat_freq' => '1',
    'event_repeat_freq_type' => '0',
    'event_repeat_on_num' => '1',
    'event_repeat_on_day' => '0',
    'event_repeat_on_freq' => '0',
    'exdate' => '',
]);

sqlStatement(
    "INSERT INTO openemr_postcalendar_events
        (pc_catid, pc_multiple, pc_aid, pc_pid, pc_title, pc_eventDate, pc_endDate,
         pc_duration, pc_recurrtype, pc_recurrspec, pc_startTime, pc_endTime,
         pc_eventstatus, pc_apptstatus, pc_facility)
     VALUES (?, 0, ?, ?, ?, ?, ?, 900, 1, ?, ?, '10:15:00', 1, '-', ?)",
    [
        5,
        (string) $providerId,
        (string) $pid,
        NC_RECURRING_FIXTURE_TITLE,
        $today,
        $endDate,
        $recurrspec,
        NC_RECURRING_START_TIME,
        $facilityId,
    ]
);

$newRow = QueryUtils::querySingleRow(
    "SELECT pc_eid FROM openemr_postcalendar_events
     WHERE pc_title = ? AND pc_eventDate = ?
     ORDER BY pc_eid DESC LIMIT 1",
    [NC_RECURRING_FIXTURE_TITLE, $today]
);
$newId = is_array($newRow) ? (int) ($newRow['pc_eid'] ?? 0) : 0;
$patientName = trim(((string) ($patient['fname'] ?? '')) . ' ' . ((string) ($patient['lname'] ?? '')));
echo "Created recurring fixture pc_eid={$newId} pid={$pid} patient=\"{$patientName}\" provider={$providerId} time=10:00 date={$today}\n";
