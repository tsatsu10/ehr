<?php

/**
 * Emit JSON fixture for V1.1-REP E2E smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-rep-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ReportHubRunbookService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$config = new ClinicConfigService();
$hubEnabled = $config->isEnabled('enable_report_hub', 0, $facilityId);
$runbookCount = count((new ReportHubRunbookService())->getCatalog()['cards'] ?? []);

echo json_encode([
    'facility_id' => $facilityId,
    'enable_report_hub' => $hubEnabled,
    'runbook_count' => $runbookCount,
    'show_us_quality_default' => $config->getInt('report_hub_show_us_quality', 0, $facilityId) === 1,
], JSON_THROW_ON_ERROR) . PHP_EOL;
