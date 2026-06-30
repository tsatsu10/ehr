<?php

/**
 * Enable Reporting Operations Hub (M16) for pilot facilities.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-report-hub.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();

pilotEnsureNewClinicAclObjects();

foreach ($facilityIds as $facilityId) {
    $config->set('enable_report_hub', '1', $facilityId);
    echo "Set enable_report_hub=1 for facility {$facilityId}.\n";
}

echo "Report hub pilot enable complete for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "Open: …/public/report-hub/index.php (requires reports or new_reports_* ACL).\n";
