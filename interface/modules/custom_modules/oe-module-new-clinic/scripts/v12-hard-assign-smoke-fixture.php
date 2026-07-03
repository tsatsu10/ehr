<?php

/**
 * Ensure a waiting visit exists for V1.2 hard-assign E2E smoke; emit JSON fixture.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-hard-assign-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicDateService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use OpenEMR\Services\PatientService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$today = (new ClinicDateService())->today();

$existing = QueryUtils::querySingleRow(
    "SELECT v.id AS visit_id, v.queue_number, v.row_version, v.state, pd.fname, pd.lname, pd.pid
     FROM new_visit v
     INNER JOIN patient_data pd ON pd.pid = v.pid
     WHERE v.facility_id = ?
       AND v.visit_date = ?
       AND v.state = 'waiting'
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
    $fname = 'HAE2E';
    $lname = 'Pt' . substr($suffix, -6);
    $pubpid = 'HA' . $suffix;
    $patientService = new PatientService();
    $created = $patientService->insert([
        'fname' => $fname,
        'lname' => $lname,
        'DOB' => '1992-06-01',
        'sex' => 'Male',
        'pubpid' => $pubpid,
        'phone_cell' => '0247000' . substr($suffix, -4),
    ]);
    if (!$created->isValid()) {
        fwrite(STDERR, "Failed to create smoke patient: " . json_encode($created->getValidationMessages()) . "\n");
        exit(1);
    }
    $pid = (int) ($created->getData()[0]['pid'] ?? 0);
    if ($pid <= 0) {
        fwrite(STDERR, "Failed to create smoke patient\n");
        exit(1);
    }

    $reception = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['reception_user']);
    $actorId = (int) ($reception['id'] ?? 1);
    $visit = (new VisitQueueService())->startVisit($pid, $visitTypeId, $actorId, $facilityId, 'E2E hard assign smoke');
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
    'visit_id' => (int) ($existing['visit_id'] ?? 0),
    'queue_number' => (int) ($existing['queue_number'] ?? 0),
    'row_version' => (int) ($existing['row_version'] ?? 0),
    'state' => (string) ($existing['state'] ?? ''),
    'fname' => (string) ($existing['fname'] ?? ''),
    'lname' => (string) ($existing['lname'] ?? ''),
    'pid' => (int) ($existing['pid'] ?? 0),
    'facility_id' => $facilityId,
], JSON_THROW_ON_ERROR) . PHP_EOL;
