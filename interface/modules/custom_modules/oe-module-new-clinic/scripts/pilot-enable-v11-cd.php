<?php

/**
 * Enable V1.1-CD chart depth panels (CDa finance, CDb referrals, CDc export) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-cd.php
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
    'enable_chart_depth' => '1',
    'enable_chart_depth_finance' => '1',
    'enable_chart_depth_referral' => '1',
    'enable_chart_depth_export' => '1',
    'enable_react_chart_depth' => '1',
];

foreach ($flags as $configKey => $configValue) {
    $config->set($configKey, $configValue, 0);
    $config->set($configKey, $configValue, $facilityId);
}

echo "Set V1.1-CD flags for facility 0 and {$facilityId}:\n";
foreach (array_keys($flags) as $configKey) {
    echo "  {$configKey}\n";
}
