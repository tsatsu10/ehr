<?php

/**
 * Release stale with_doctor desk work for pilot doctors (E2E cleanup).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/release-pilot-doctor-desks.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/golden-path-e2e-prep.php';

foreach (['doctor_user', 'doctor2_user'] as $username) {
    goldenPathReleaseStaleDeskWork($username, 'with_doctor', 'completed', false);
}

echo "Pilot doctor desks released.\n";
