<?php

/**
 * Enable V1.1-REP (M16 Reporting Operations Hub) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-rep.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ReportHubRunbookService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pilotEnsureNewClinicAclObjects();

foreach ($facilityIds as $facilityId) {
    $config->set('enable_report_hub', '1', $facilityId);
    $config->set('enable_react_report_hub', '1', $facilityId);
    echo "Set enable_report_hub=1 for facility {$facilityId}.\n";
}

$access = new ReportHubAccessService();
$runbookCount = count((new ReportHubRunbookService())->getCatalog()['cards'] ?? []);

echo "Set V1.1-REP flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_report_hub\n";
echo "  enable_react_report_hub\n";
echo '  report_hub_ready=' . ($access->isHubEnabled($defaultFacilityId) ? 'yes' : 'no') . "\n";
echo "  runbook_cards={$runbookCount}\n";
echo "Open: …/public/report-hub/index.php\n";
