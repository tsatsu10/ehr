<?php

/**
 * Enable V1.2 hard provider assignment + doctor ready notify for E2E / pilot smoke (§6.5.3–4).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-hard-assign.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/golden-path-e2e-prep.php';
require_once __DIR__ . '/lib/v12-pilot-seed.php';

use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No service-location facility configured.\n");
    exit(1);
}

v12ApplyPilotConfigFlags($facilityId, [
    'enable_hard_provider_assignment' => '1',
    'enable_doctor_ready_notify' => '1',
    'notify_unassigned_to_all_on_duty' => '1',
    'enable_doctor_roster' => '1',
]);

goldenPathGrantAclToGroup('New Clinic Nurse', 'new_hard_assign_provider', 'Hard Assign Provider');
goldenPathGrantAclToGroup('New Clinic Reception', 'new_hard_assign_provider', 'Hard Assign Provider');
v12EnsurePilotDoctorRoster($facilityId);

echo "Set V1.2 hard-assign + notify flags=1 for facility 0 and {$facilityId}.\n";
echo "  enable_hard_provider_assignment\n";
echo "  enable_doctor_ready_notify\n";
echo "  notify_unassigned_to_all_on_duty\n";
echo "  enable_doctor_roster\n";
