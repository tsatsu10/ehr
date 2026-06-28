<?php

/**
 * Release stale doctor desk consults before golden-path E2E.
 *
 * Clears with_doctor visits assigned to pilot doctor_user for today so
 * doctor.queue does not return has_active_consult from prior failed runs.
 *
 * Usage: php interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-reset-doctor-consults.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

$doctor = sqlQuery("SELECT id FROM users WHERE username = 'doctor_user' LIMIT 1");
$doctorId = (int) ($doctor['id'] ?? 0);
if ($doctorId <= 0) {
    echo "doctor_user not found — skip\n";
    exit(0);
}

$released = sqlStatement(
    "UPDATE new_visit SET state = 'ready_for_doctor', assigned_provider_id = NULL "
    . "WHERE assigned_provider_id = ? AND visit_date = CURDATE() AND state = 'with_doctor'",
    [$doctorId]
);

echo "Released stale doctor consults for user id {$doctorId}.\n";
