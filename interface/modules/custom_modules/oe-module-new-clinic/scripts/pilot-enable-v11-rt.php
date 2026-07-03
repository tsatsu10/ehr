<?php

/**
 * Enable V1.1-RTa/RTb (doctor roster + advisory routing) for E2E / pilot smoke (§6.5.2).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-rt.php
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
    'enable_doctor_roster' => '1',
    'enable_advisory_routing' => '1',
    'enable_multi_doctor_filters' => '1',
    'enable_hard_provider_assignment' => '0',
    'enable_doctor_ready_notify' => '0',
    'require_override_reason' => '0',
]);

v12EnsurePilotDoctorRoster($facilityId, ['doctor_user', 'doctor2_user']);

echo "Set V1.1-RT flags for facility 0 and {$facilityId}.\n";
echo "  enable_doctor_roster\n";
echo "  enable_advisory_routing\n";
echo "  enable_multi_doctor_filters\n";
echo "  enable_hard_provider_assignment=0\n";
