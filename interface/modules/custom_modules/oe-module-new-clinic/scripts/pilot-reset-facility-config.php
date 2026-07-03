<?php

/**
 * Reset pilot slice config flags to install defaults on facility 0 + default clinic.
 *
 * Run after E2E smoke suites or before PHPUnit when live DB is shared with XAMPP pilot.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-reset-facility-config.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-config-defaults.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No service-location facility configured.\n");
    exit(1);
}

$config = new ClinicConfigService();
$flags = pilotSliceConfigDefaults();
$facilityIds = array_values(array_unique([0, $facilityId]));

foreach ($facilityIds as $targetFacilityId) {
    foreach ($flags as $configKey => $configValue) {
        $config->set($configKey, $configValue, $targetFacilityId);
    }
}

echo 'Reset pilot slice config defaults for facilities: ' . implode(', ', $facilityIds) . PHP_EOL;
echo 'Keys: ' . count($flags) . PHP_EOL;
