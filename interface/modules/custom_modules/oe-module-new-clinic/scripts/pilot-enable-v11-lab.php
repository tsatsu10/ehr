<?php

/**
 * Enable V1.1-LAB (M12 Lab Operations Hub) for E2E / pilot smoke (§21.1q).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-lab.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/lab-ops-pilot-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = labOpsPilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

labOpsPilotEnableLabRole($config, $facilityIds);
labOpsPilotEnsureHubConfig($config, $facilityIds);
labOpsPilotImportStarterPanel($config, $defaultFacilityId);

echo "V1.1-LAB pilot enable complete for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "Open: …/public/lab-ops/index.php (lab_user, lab lead, doctor, or admin ACL).\n";
