<?php

/**
 * Enable S1 Scheduling & Flow shell for E2E / pilot smoke.
 *
 * Requires enable_scheduled_integration (set here per facility).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-scheduling.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pilotEnsureNewClinicAclObjects();

foreach ($facilityIds as $facilityId) {
    $config->set('enable_scheduled_integration', '1', $facilityId);
    $config->set('enable_scheduling_redesign', '1', $facilityId);
    $config->set('enable_react_scheduling', '1', $facilityId);
    echo "Set enable_scheduled_integration=1 for facility {$facilityId}.\n";
    echo "Set enable_scheduling_redesign=1 for facility {$facilityId}.\n";
    echo "Set enable_react_scheduling=1 for facility {$facilityId}.\n";
}

$access = new SchedulingAccessService();
$scheduledOn = (new ScheduledIntegrationService())->isEnabled($defaultFacilityId);

echo 'Set S1 Scheduling & Flow flags for facilities: ' . implode(', ', $facilityIds) . ".\n";
echo "  enable_scheduled_integration\n";
echo "  enable_scheduling_redesign\n";
echo "  enable_react_scheduling\n";
echo '  scheduled_integration=' . ($scheduledOn ? 'yes' : 'no') . "\n";
echo '  scheduling_hub_ready=' . ($access->isHubEnabled($defaultFacilityId) ? 'yes' : 'no') . "\n";
echo "Open: …/public/scheduling/index.php?lens=calendar|flow|recalls\n";
