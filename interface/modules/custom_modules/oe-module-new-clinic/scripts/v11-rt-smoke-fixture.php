<?php

/**
 * Ensure waiting visit + roster state for V1.1-RT advisory routing E2E; emit JSON fixture.
 *
 * Sets doctor_user taking=ON, doctor2_user taking=OFF (paused doctors excluded from suggestions).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-rt-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/v12-pilot-seed.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicDateService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Services\PatientService;

/**
 * @return array{user_id: int, username: string, display_name: string}
 */
function v11RtDoctorMeta(string $username): array
{
    $row = QueryUtils::querySingleRow(
        'SELECT id, fname, lname FROM users WHERE username = ?',
        [$username]
    );
    if (!is_array($row) || empty($row['id'])) {
        fwrite(STDERR, "Pilot doctor not found: {$username}. Run seed_pilot_users.php first.\n");
        exit(1);
    }

    $fname = trim((string) ($row['fname'] ?? ''));
    $lname = trim((string) ($row['lname'] ?? ''));

    return [
        'user_id' => (int) $row['id'],
        'username' => $username,
        'display_name' => trim($fname . ' ' . $lname),
    ];
}

function v11RtSetTaking(int $facilityId, int $userId, bool $taking): void
{
    sqlStatement(
        'UPDATE new_doctor_availability SET taking_patients = ? WHERE user_id = ? AND facility_id = ?',
        [$taking ? 1 : 0, $userId, $facilityId]
    );
}

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$today = (new ClinicDateService())->today();

v12EnsurePilotDoctorRoster($facilityId, ['doctor_user', 'doctor2_user']);

$primaryDoctor = v11RtDoctorMeta('doctor_user');
$secondaryDoctor = v11RtDoctorMeta('doctor2_user');

v11RtSetTaking($facilityId, $primaryDoctor['user_id'], true);
v11RtSetTaking($facilityId, $secondaryDoctor['user_id'], false);

sqlStatement(
    "UPDATE new_visit v
     INNER JOIN patient_data pd ON pd.pid = v.pid
     SET v.state = 'cancelled', v.updated_at = NOW()
     WHERE v.facility_id = ? AND v.visit_date = ?
       AND v.state = 'ready_for_doctor'
       AND pd.lname NOT LIKE 'RtE2E%'",
    [$facilityId, $today]
);

$existing = QueryUtils::querySingleRow(
    "SELECT v.id AS visit_id, v.queue_number, v.row_version, v.state, pd.fname, pd.lname, pd.pid
     FROM new_visit v
     INNER JOIN patient_data pd ON pd.pid = v.pid
     WHERE v.facility_id = ?
       AND v.visit_date = ?
       AND v.state = 'waiting'
       AND pd.lname LIKE 'RtE2E%'
     ORDER BY v.id DESC
     LIMIT 1",
    [$facilityId, $today]
);

if (!is_array($existing) || empty($existing['visit_id'])) {
    $visitType = QueryUtils::querySingleRow(
        "SELECT id FROM new_visit_type WHERE facility_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1",
        [$facilityId]
    );
    $visitTypeId = is_array($visitType) ? (int) ($visitType['id'] ?? 0) : 0;
    if ($visitTypeId <= 0) {
        fwrite(STDERR, "No visit type for facility {$facilityId}\n");
        exit(1);
    }

    $suffix = (string) time();
    $fname = 'RtE2E';
    $lname = 'RtE2E' . substr($suffix, -5);
    $pubpid = 'RT' . $suffix;
    $patientService = new PatientService();
    $created = $patientService->insert([
        'fname' => $fname,
        'lname' => $lname,
        'DOB' => '1991-08-20',
        'sex' => 'Female',
        'pubpid' => $pubpid,
        'phone_cell' => '0247222' . substr($suffix, -4),
    ]);
    if (!$created->isValid()) {
        fwrite(STDERR, 'Failed to create smoke patient: ' . json_encode($created->getValidationMessages()) . "\n");
        exit(1);
    }
    $pid = (int) ($created->getData()[0]['pid'] ?? 0);
    if ($pid <= 0) {
        fwrite(STDERR, "Failed to create smoke patient\n");
        exit(1);
    }

    $reception = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['reception_user']);
    $actorId = (int) ($reception['id'] ?? 1);
    $visit = (new VisitQueueService())->startVisit($pid, $visitTypeId, $actorId, $facilityId, 'E2E advisory routing smoke');
    $existing = [
        'visit_id' => (int) ($visit['id'] ?? 0),
        'queue_number' => (int) ($visit['queue_number'] ?? 0),
        'row_version' => (int) ($visit['row_version'] ?? 0),
        'state' => (string) ($visit['state'] ?? 'waiting'),
        'fname' => $fname,
        'lname' => $lname,
        'pid' => $pid,
    ];
}

echo json_encode([
    'facility_id' => $facilityId,
    'primary_doctor' => $primaryDoctor,
    'secondary_doctor' => $secondaryDoctor,
    'visit' => [
        'visit_id' => (int) ($existing['visit_id'] ?? 0),
        'queue_number' => (int) ($existing['queue_number'] ?? 0),
        'row_version' => (int) ($existing['row_version'] ?? 0),
        'fname' => (string) ($existing['fname'] ?? ''),
        'lname' => (string) ($existing['lname'] ?? ''),
        'pid' => (int) ($existing['pid'] ?? 0),
    ],
], JSON_THROW_ON_ERROR) . PHP_EOL;
