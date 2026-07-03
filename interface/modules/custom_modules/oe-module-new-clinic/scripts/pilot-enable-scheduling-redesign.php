<?php

/**
 * Enable S1 Scheduling & Flow shell on a pilot facility.
 *
 * Requires enable_scheduled_integration (set by pilot-rollout.php).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-scheduling-redesign.php
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
$config->set('enable_scheduled_integration', '1', 0);
$config->set('enable_scheduled_integration', '1', $facilityId);
$config->set('enable_scheduling_redesign', '1', 0);
$config->set('enable_scheduling_redesign', '1', $facilityId);
$config->set('enable_react_scheduling', '1', 0);

echo "Set enable_scheduled_integration=1, enable_scheduling_redesign=1 for facility {$facilityId}.\n";
echo "Open: /interface/modules/custom_modules/oe-module-new-clinic/public/scheduling/index.php\n";
