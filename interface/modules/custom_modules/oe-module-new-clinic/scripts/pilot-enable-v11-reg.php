<?php

/**
 * Enable V1.1-REG (Patient Registry M10) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-reg.php
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
$flags = [
    'enable_patient_registry' => '1',
    'enable_react_patient_registry' => '1',
    'registry_redirect_global_search' => '1',
];

foreach ($flags as $configKey => $configValue) {
    $config->set($configKey, $configValue, 0);
    $config->set($configKey, $configValue, $facilityId);
}

echo "V1.1-REG enabled for facility 0 and {$facilityId}:\n";
foreach (array_keys($flags) as $configKey) {
    echo "  {$configKey}=1\n";
}
echo "Patient Registry: .../public/patient-registry.php\n";
echo "Reception roles: legacy Finder (fin0) hidden; clinical roles retain Finder.\n";
