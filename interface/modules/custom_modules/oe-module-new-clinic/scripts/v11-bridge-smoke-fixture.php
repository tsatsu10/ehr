<?php

/**
 * Ensure EX-01 fixture and emit JSON for V1.1-BRIDGE E2E smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-bridge-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeExceptionService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Services\PatientService;

const NC_BRIDGE_FIXTURE_TITLE = 'NC-BRIDGE-FIXTURE-EX01';

function ensureBridgeEx01Fixture(int $facilityId): int
{
    $existing = QueryUtils::querySingleRow(
        "SELECT pc_eid FROM openemr_postcalendar_events
         WHERE pc_title = ? AND pc_eventDate = CURDATE() LIMIT 1",
        [NC_BRIDGE_FIXTURE_TITLE]
    );
    if (is_array($existing) && !empty($existing['pc_eid'])) {
        return (int) $existing['pc_eid'];
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
        $suffix = (string) time();
        $created = (new PatientService())->insert([
            'fname' => 'Bridge',
            'lname' => 'Fixture' . substr($suffix, -5),
            'DOB' => '1990-03-15',
            'sex' => 'Female',
            'pubpid' => 'BF' . $suffix,
            'phone_cell' => '0247888' . substr($suffix, -4),
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
         VALUES (?, 0, '1', ?, ?, ?, ?, 900, 0, '09:00:00', '09:15:00', 1, '@', ?)",
        [5, (string) $pid, NC_BRIDGE_FIXTURE_TITLE, $today, $today, $facilityId]
    );

    $created = QueryUtils::querySingleRow(
        "SELECT pc_eid FROM openemr_postcalendar_events
         WHERE pc_title = ? AND pc_eventDate = CURDATE()
         ORDER BY pc_eid DESC LIMIT 1",
        [NC_BRIDGE_FIXTURE_TITLE]
    );

    return is_array($created) ? (int) ($created['pc_eid'] ?? 0) : 0;
}

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$bridgeOn = (new QueueBridgeAccessService())->isHubEnabled($facilityId);
$scheduledOn = (new ScheduledIntegrationService())->isEnabled($facilityId);

$fixturePcEid = ensureBridgeEx01Fixture($facilityId);

$list = $bridgeOn
    ? (new QueueBridgeService())->listExceptions($facilityId, 'action')
    : ['counts' => ['action' => 0, 'info' => 0, 'resolved' => 0], 'rows' => []];

$ex01Present = false;
if ($fixturePcEid > 0) {
    $detected = (new QueueBridgeExceptionService())->detectToday($facilityId, date('Y-m-d'));
    foreach ($detected as $row) {
        if (($row['exception_code'] ?? '') === 'EX-01'
            && (int) ($row['pc_eid'] ?? 0) === $fixturePcEid) {
            $ex01Present = true;
            break;
        }
    }
}

echo json_encode([
    'facility_id' => $facilityId,
    'enable_queue_bridge' => $bridgeOn,
    'enable_scheduled_integration' => $scheduledOn,
    'action_exception_count' => (int) ($list['counts']['action'] ?? 0),
    'ex01_fixture_present' => $ex01Present,
    'fixture_pc_eid' => $fixturePcEid,
    'fixture_title' => NC_BRIDGE_FIXTURE_TITLE,
], JSON_THROW_ON_ERROR) . PHP_EOL;
