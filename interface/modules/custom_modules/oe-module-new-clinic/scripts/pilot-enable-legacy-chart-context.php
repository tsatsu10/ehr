<?php

/**
 * Enable V1.2-CTX flags for E2E / pilot smoke (T1-F18 + T1-F19).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-legacy-chart-context.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No service-location facility configured.\n");
    exit(1);
}

$config = new ClinicConfigService();
$keys = [
    'enable_legacy_patient_context_overlay' => '1',
    'enable_shared_device_session_warning' => '1',
    'enable_legacy_strip_desk_return' => '1',
];

foreach ($keys as $key => $value) {
    $config->set($key, $value, 0);
    $config->set($key, $value, $facilityId);
}

echo "Set V1.2-CTX flags=1 for facility 0 and {$facilityId}.\n";
echo "  enable_legacy_patient_context_overlay\n";
echo "  enable_shared_device_session_warning\n";
echo "  enable_legacy_strip_desk_return\n";
echo "Open stock demographics:\n";
echo "/interface/patient_file/summary/demographics.php?set_pid=4\n";
