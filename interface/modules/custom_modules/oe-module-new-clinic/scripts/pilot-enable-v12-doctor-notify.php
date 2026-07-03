<?php

/**
 * Enable V1.2 doctor ready in-app notify (without hard assign) for E2E / pilot smoke (§6.5.4).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-doctor-notify.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/v12-pilot-seed.php';

use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No service-location facility configured.\n");
    exit(1);
}

v12ApplyPilotConfigFlags($facilityId, [
    'enable_hard_provider_assignment' => '0',
    'enable_doctor_ready_notify' => '1',
    'notify_unassigned_to_all_on_duty' => '1',
    'enable_doctor_roster' => '1',
]);

v12EnsurePilotDoctorRoster($facilityId);

echo "Set V1.2 doctor-notify flags for facility 0 and {$facilityId}.\n";
echo "  enable_doctor_ready_notify=1\n";
echo "  notify_unassigned_to_all_on_duty=1\n";
echo "  enable_doctor_roster=1\n";
echo "  enable_hard_provider_assignment=0\n";
