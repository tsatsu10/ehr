<?php

/**
 * Enable V1.1-BRIDGE (M18 Queue Bridge Hub) for E2E / pilot smoke.
 *
 * Requires enable_scheduled_integration (set here per facility).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-bridge.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\ScheduledIntegrationService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pilotEnsureNewClinicAclObjects();

foreach ($facilityIds as $facilityId) {
    $config->set('enable_scheduled_integration', '1', $facilityId);
    $config->set('enable_queue_bridge', '1', $facilityId);
    $config->set('enable_react_queue_bridge', '1', $facilityId);
    echo "Set enable_scheduled_integration=1 for facility {$facilityId}.\n";
    echo "Set enable_queue_bridge=1 for facility {$facilityId}.\n";
    echo "Set enable_react_queue_bridge=1 for facility {$facilityId}.\n";
}

$access = new QueueBridgeAccessService();
$scheduledOn = (new ScheduledIntegrationService())->isEnabled($defaultFacilityId);

echo "Set V1.1-BRIDGE flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_scheduled_integration\n";
echo "  enable_queue_bridge\n";
echo '  scheduled_integration=' . ($scheduledOn ? 'yes' : 'no') . "\n";
echo '  queue_bridge_ready=' . ($access->isHubEnabled($defaultFacilityId) ? 'yes' : 'no') . "\n";
echo "Open: …/public/queue-bridge/index.php\n";
