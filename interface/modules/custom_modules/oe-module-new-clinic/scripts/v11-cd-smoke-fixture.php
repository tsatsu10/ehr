<?php

/**
 * Emit JSON fixture for V1.1-CD E2E — patient with payment history when available.
 *
 * Prerequisite: golden-path or bill smoke data (non-reversed receipt).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-cd-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

$row = null;
if ($defaultFacilityId > 0) {
    $row = QueryUtils::querySingleRow(
        "SELECT pd.pid, pd.fname, pd.lname, pd.pubpid,
                r.id AS receipt_id, r.receipt_number, r.visit_id, r.facility_id, r.created_at,
                v.state AS visit_state, v.queue_number, v.encounter
         FROM new_receipt r
         INNER JOIN new_visit v ON v.id = r.visit_id
         INNER JOIN patient_data pd ON pd.pid = v.pid
         WHERE r.reversed_at IS NULL AND r.facility_id = ?
         ORDER BY r.id DESC
         LIMIT 1",
        [$defaultFacilityId]
    );
}

if (!is_array($row) || empty($row['pid'])) {
    $row = QueryUtils::querySingleRow(
        "SELECT pd.pid, pd.fname, pd.lname, pd.pubpid,
                r.id AS receipt_id, r.receipt_number, r.visit_id, r.facility_id, r.created_at,
                v.state AS visit_state, v.queue_number, v.encounter
         FROM new_receipt r
         INNER JOIN new_visit v ON v.id = r.visit_id
         INNER JOIN patient_data pd ON pd.pid = v.pid
         WHERE r.reversed_at IS NULL
         ORDER BY r.id DESC
         LIMIT 1"
    );
}

$pid = is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
if ($pid <= 0) {
    $fallbackPid = (int) (getenv('TEST_CHART_PID') ?: 4);
    $patient = QueryUtils::querySingleRow(
        'SELECT pid, fname, lname, pubpid FROM patient_data WHERE pid = ?',
        [$fallbackPid]
    );
    if (!is_array($patient) || empty($patient['pid'])) {
        fwrite(STDERR, "No receipt-backed patient found. Run e2e-prep-golden-path.php first.\n");
        exit(1);
    }

    echo json_encode([
        'pid' => (int) $patient['pid'],
        'fname' => (string) ($patient['fname'] ?? ''),
        'lname' => (string) ($patient['lname'] ?? ''),
        'pubpid' => (string) ($patient['pubpid'] ?? ''),
        'receipt_id' => 0,
        'receipt_number' => '',
        'visit_id' => 0,
        'encounter_id' => 0,
        'facility_id' => $defaultFacilityId,
        'has_receipt' => false,
    ], JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(0);
}

$createdAt = (string) ($row['created_at'] ?? '');

echo json_encode([
    'pid' => $pid,
    'fname' => (string) ($row['fname'] ?? ''),
    'lname' => (string) ($row['lname'] ?? ''),
    'pubpid' => (string) ($row['pubpid'] ?? ''),
    'receipt_id' => (int) ($row['receipt_id'] ?? 0),
    'receipt_number' => (string) ($row['receipt_number'] ?? ''),
    'visit_id' => (int) ($row['visit_id'] ?? 0),
    'encounter_id' => (int) ($row['encounter'] ?? 0),
    'facility_id' => (int) ($row['facility_id'] ?? $defaultFacilityId),
    'visit_state' => (string) ($row['visit_state'] ?? ''),
    'queue_number' => (int) ($row['queue_number'] ?? 0),
    'receipt_date' => $createdAt !== '' ? substr($createdAt, 0, 10) : '',
    'has_receipt' => true,
], JSON_THROW_ON_ERROR) . PHP_EOL;
