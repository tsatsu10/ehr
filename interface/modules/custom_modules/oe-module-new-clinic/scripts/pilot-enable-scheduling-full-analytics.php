<?php

/**
 * Enable full S1-F09 scheduling analytics (V1.1-OPS) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-scheduling-full-analytics.php
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
$config->set('enable_scheduling_full_analytics', '1', 0);
$config->set('enable_scheduling_full_analytics', '1', $facilityId);

echo "Set enable_scheduling_full_analytics=1 for facility 0 and {$facilityId}.\n";
