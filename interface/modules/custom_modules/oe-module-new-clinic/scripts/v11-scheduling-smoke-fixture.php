<?php

/**
 * Ensure calendar smoke fixture and emit JSON for S1 Scheduling E2E smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-scheduling-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Services\PatientService;

const NC_SCHEDULING_SMOKE_TITLE = 'NC-SCHEDULING-SMOKE-FIXTURE';
const NC_RECURRING_FIXTURE_TITLE = 'NC-RECURRING-E2E-FIXTURE';

function ensureSchedulingSmokeAppointment(int $facilityId): int
{
    $existing = QueryUtils::querySingleRow(
        "SELECT pc_eid FROM openemr_postcalendar_events
         WHERE pc_title = ? AND pc_eventDate = CURDATE() LIMIT 1",
        [NC_SCHEDULING_SMOKE_TITLE]
    );
    if (is_array($existing) && !empty($existing['pc_eid'])) {
        return (int) $existing['pc_eid'];
    }

    $patient = QueryUtils::querySingleRow(
        'SELECT pid FROM patient_data ORDER BY pid ASC LIMIT 1'
    );
    $pid = (int) ($patient['pid'] ?? 0);
    if ($pid <= 0) {
        $suffix = (string) time();
        $created = (new PatientService())->insert([
            'fname' => 'Scheduling',
            'lname' => 'Smoke' . substr($suffix, -4),
            'DOB' => '1992-06-01',
            'sex' => 'Female',
            'pubpid' => 'SS' . $suffix,
            'phone_cell' => '0247999' . substr($suffix, -4),
        ]);
        if (!$created->isValid()) {
            return 0;
        }
        $pid = (int) ($created->getData()[0]['pid'] ?? 0);
    }

    if ($pid <= 0) {
        return 0;
    }

    $today = date('Y-m-d');
    sqlStatement(
        "INSERT INTO openemr_postcalendar_events
            (pc_catid, pc_multiple, pc_aid, pc_pid, pc_title, pc_eventDate, pc_endDate,
             pc_duration, pc_recurrtype, pc_startTime, pc_endTime, pc_eventstatus, pc_apptstatus, pc_facility)
         VALUES (?, 0, '1', ?, ?, ?, ?, 900, 0, '11:00:00', '11:15:00', 1, '-', ?)",
        [5, (string) $pid, NC_SCHEDULING_SMOKE_TITLE, $today, $today, $facilityId]
    );

    $created = QueryUtils::querySingleRow(
        "SELECT pc_eid FROM openemr_postcalendar_events
         WHERE pc_title = ? AND pc_eventDate = CURDATE()
         ORDER BY pc_eid DESC LIMIT 1",
        [NC_SCHEDULING_SMOKE_TITLE]
    );

    return is_array($created) ? (int) ($created['pc_eid'] ?? 0) : 0;
}

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$hubOn = (new SchedulingAccessService())->isHubEnabled($facilityId);
$scheduledOn = (new ScheduledIntegrationService())->isEnabled($facilityId);
$smokePcEid = ensureSchedulingSmokeAppointment($facilityId);

$todayCountRow = QueryUtils::querySingleRow(
    "SELECT COUNT(*) AS cnt FROM openemr_postcalendar_events
     WHERE pc_eventDate = CURDATE() AND pc_facility = ?",
    [$facilityId]
);
$calendarEventCountToday = (int) ($todayCountRow['cnt'] ?? 0);

$recurringRow = QueryUtils::querySingleRow(
    'SELECT pc_eid FROM openemr_postcalendar_events WHERE pc_title = ? ORDER BY pc_eid DESC LIMIT 1',
    [NC_RECURRING_FIXTURE_TITLE]
);
$recurringFixturePcEid = is_array($recurringRow) ? (int) ($recurringRow['pc_eid'] ?? 0) : 0;

echo json_encode([
    'facility_id' => $facilityId,
    'enable_scheduled_integration' => $scheduledOn,
    'enable_scheduling_redesign' => $hubOn,
    'calendar_event_count_today' => $calendarEventCountToday,
    'smoke_fixture_pc_eid' => $smokePcEid,
    'smoke_fixture_title' => NC_SCHEDULING_SMOKE_TITLE,
    'recurring_fixture_pc_eid' => $recurringFixturePcEid,
    'recurring_fixture_present' => $recurringFixturePcEid > 0,
], JSON_THROW_ON_ERROR) . PHP_EOL;
