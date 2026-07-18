<?php

/**
 * Enable V1.1-COM (Communications Hub) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-comms.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pilotEnsureNewClinicAclObjects();

// The Communications Hub is always on now — only the React kill switch remains.
foreach ($facilityIds as $facilityId) {
    $config->set('enable_react_communications_hub', '1', $facilityId);
    echo "Set enable_react_communications_hub=1 for facility {$facilityId}.\n";
}

$reactOn = $config->get('enable_react_communications_hub', '1', $defaultFacilityId) === '1';

echo "Set V1.1-COM flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_react_communications_hub\n";
echo '  communications_hub_ready=' . ($reactOn ? 'yes' : 'no') . "\n";
echo "Open: …/public/communications.php\n";
