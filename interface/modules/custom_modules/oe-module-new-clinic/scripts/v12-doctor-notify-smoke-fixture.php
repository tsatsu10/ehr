<?php

/**
 * Ensure two waiting visits for V1.2 doctor-ready notify E2E; emit JSON fixture.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-doctor-notify-smoke-fixture.php [clear_queue=1]
 *
 * clear_queue=1 additionally cancels today's non-fixture ready_for_doctor visits and wipes
 * today's notify log at the facility (fully deterministic toast target). Off by default so
 * a hand-run smoke never swallows a visit someone is testing manually on this shared DB.
 *
 * cleanup=1 (spec afterAll): cancel the Notify% fixture visits themselves. A leftover
 * ready_for_doctor NotifyB (hard-assigned) makes every LATER doctor-desk load fire a
 * persistent "Patient ready" toast that parks over the queue toolbar and intercepts
 * clicks — it broke unrelated specs across a full-suite run.
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

if (in_array('cleanup=1', array_slice($argv, 1), true)) {
    sqlStatement(
        "UPDATE new_visit v
         INNER JOIN patient_data pd ON pd.pid = v.pid
         SET v.state = 'cancelled', v.updated_at = NOW()
         WHERE pd.lname LIKE 'Notify%' AND v.state NOT IN ('completed', 'cancelled')"
    );
    echo json_encode(['cleaned' => true]) . "\n";
    exit(0);
}

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicDateService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Services\PatientService;

/**
 * @return array<string, mixed>
 */
function v12NotifyEnsureWaitingVisit(int $facilityId, string $today, string $tag): array
{
    $existing = QueryUtils::querySingleRow(
        "SELECT v.id AS visit_id, v.queue_number, v.row_version, v.state, pd.fname, pd.lname, pd.pid
         FROM new_visit v
         INNER JOIN patient_data pd ON pd.pid = v.pid
         WHERE v.facility_id = ?
           AND v.visit_date = ?
           AND v.state = 'waiting'
           AND pd.lname LIKE ?
         ORDER BY v.id DESC
         LIMIT 1",
        [$facilityId, $today, $tag . '%']
    );

    if (is_array($existing) && !empty($existing['visit_id'])) {
        return $existing;
    }

    $visitType = QueryUtils::querySingleRow(
        "SELECT id FROM new_visit_type WHERE facility_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1",
        [$facilityId]
    );
    $visitTypeId = is_array($visitType) ? (int) ($visitType['id'] ?? 0) : 0;
    if ($visitTypeId <= 0) {
        fwrite(STDERR, "No visit type for facility {$facilityId}\n");
        exit(1);
    }

    $suffix = (string) time() . random_int(10, 99);
    $fname = 'DNE2E';
    $lname = $tag . substr($suffix, -5);
    $pubpid = 'DN' . $suffix;
    $patientService = new PatientService();
    $created = $patientService->insert([
        'fname' => $fname,
        'lname' => $lname,
        'DOB' => '1990-03-15',
        'sex' => 'Female',
        'pubpid' => $pubpid,
        'phone_cell' => '0247111' . substr($suffix, -4),
    ]);
    if (!$created->isValid()) {
        fwrite(STDERR, "Failed to create smoke patient {$tag}: " . json_encode($created->getValidationMessages()) . "\n");
        exit(1);
    }
    $pid = (int) ($created->getData()[0]['pid'] ?? 0);
    if ($pid <= 0) {
        fwrite(STDERR, "Failed to create smoke patient {$tag}\n");
        exit(1);
    }

    $reception = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['reception_user']);
    $actorId = (int) ($reception['id'] ?? 1);
    $visit = (new VisitQueueService())->startVisit($pid, $visitTypeId, $actorId, $facilityId, 'E2E doctor notify smoke');

    return [
        'visit_id' => (int) ($visit['id'] ?? 0),
        'queue_number' => (int) ($visit['queue_number'] ?? 0),
        'row_version' => (int) ($visit['row_version'] ?? 0),
        'state' => (string) ($visit['state'] ?? 'waiting'),
        'fname' => $fname,
        'lname' => $lname,
        'pid' => $pid,
    ];
}

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$today = (new ClinicDateService())->today();

// Reset tagged smoke visits + drop stale notify rows so Doctor Desk toast targets this fixture only.
$clearQueue = in_array('clear_queue=1', array_slice($argv, 1), true);
if ($clearQueue) {
    sqlStatement(
        "DELETE n FROM new_visit_notify_log n
         INNER JOIN new_visit v ON v.id = n.visit_id
         WHERE v.facility_id = ? AND v.visit_date = ?",
        [$facilityId, $today]
    );
    sqlStatement(
        "UPDATE new_visit v
         INNER JOIN patient_data pd ON pd.pid = v.pid
         SET v.state = 'cancelled', v.updated_at = NOW()
         WHERE v.facility_id = ? AND v.visit_date = ?
           AND v.state = 'ready_for_doctor'
           AND pd.lname NOT LIKE 'Notify%'",
        [$facilityId, $today]
    );
} else {
    // Fixture-scoped by default: only this smoke's own visits lose their notify rows.
    sqlStatement(
        "DELETE n FROM new_visit_notify_log n
         INNER JOIN new_visit v ON v.id = n.visit_id
         INNER JOIN patient_data pd ON pd.pid = v.pid
         WHERE v.facility_id = ? AND v.visit_date = ? AND pd.lname LIKE 'Notify%'",
        [$facilityId, $today]
    );
    $othersReady = QueryUtils::querySingleRow(
        "SELECT COUNT(*) AS n FROM new_visit v
         INNER JOIN patient_data pd ON pd.pid = v.pid
         WHERE v.facility_id = ? AND v.visit_date = ?
           AND v.state = 'ready_for_doctor'
           AND pd.lname NOT LIKE 'Notify%'",
        [$facilityId, $today]
    );
    if ((int) ($othersReady['n'] ?? 0) > 0) {
        fwrite(STDERR, "WARNING: {$othersReady['n']} non-fixture ready_for_doctor visit(s) present — "
            . "notify toast may target the wrong visit. Re-run with clear_queue=1 to cancel them.\n");
    }
}
sqlStatement(
    "UPDATE new_visit v
     INNER JOIN patient_data pd ON pd.pid = v.pid
     SET v.state = 'waiting', v.hard_assigned_provider_id = NULL, v.updated_at = NOW()
     WHERE v.facility_id = ? AND v.visit_date = ?
       AND (pd.lname LIKE 'NotifyA%' OR pd.lname LIKE 'NotifyB%')",
    [$facilityId, $today]
);
$encounters = QueryUtils::fetchRecords(
    "SELECT v.pid, v.encounter
     FROM new_visit v
     INNER JOIN patient_data pd ON pd.pid = v.pid
     WHERE v.facility_id = ? AND v.visit_date = ?
       AND (pd.lname LIKE 'NotifyA%' OR pd.lname LIKE 'NotifyB%')",
    [$facilityId, $today]
) ?: [];
foreach ($encounters as $row) {
    $pid = (int) ($row['pid'] ?? 0);
    $encounter = (int) ($row['encounter'] ?? 0);
    if ($pid <= 0 || $encounter <= 0) {
        continue;
    }
    sqlStatement(
        "DELETE fv FROM form_vitals fv
         INNER JOIN forms f ON f.form_id = fv.id AND f.formdir = 'vitals'
         WHERE f.pid = ? AND f.encounter = ?",
        [$pid, $encounter]
    );
    sqlStatement(
        "DELETE FROM forms WHERE pid = ? AND encounter = ? AND formdir = 'vitals'",
        [$pid, $encounter]
    );
}

$primary = v12NotifyEnsureWaitingVisit($facilityId, $today, 'NotifyA');
usleep(10000);
$secondary = v12NotifyEnsureWaitingVisit($facilityId, $today, 'NotifyB');

$doctor = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['doctor_user']);
$doctorUserId = (int) ($doctor['id'] ?? 0);

echo json_encode([
    'facility_id' => $facilityId,
    'doctor_user_id' => $doctorUserId,
    'primary' => [
        'visit_id' => (int) ($primary['visit_id'] ?? 0),
        'queue_number' => (int) ($primary['queue_number'] ?? 0),
        'row_version' => (int) ($primary['row_version'] ?? 0),
        'fname' => (string) ($primary['fname'] ?? ''),
        'lname' => (string) ($primary['lname'] ?? ''),
    ],
    'secondary' => [
        'visit_id' => (int) ($secondary['visit_id'] ?? 0),
        'queue_number' => (int) ($secondary['queue_number'] ?? 0),
        'row_version' => (int) ($secondary['row_version'] ?? 0),
        'fname' => (string) ($secondary['fname'] ?? ''),
        'lname' => (string) ($secondary['lname'] ?? ''),
    ],
], JSON_THROW_ON_ERROR) . PHP_EOL;
