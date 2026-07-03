<?php

/**
 * Emit JSON fixture for V1.1-ADMIN E2E smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-admin-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$config = new ClinicConfigService();
$hubEnabled = $config->isEnabled('enable_admin_hub', 0, $facilityId);

$runbookCount = 0;
$formsCount = 0;
$hasSystemHealth = false;
$setupPercent = 0;

if ($hubEnabled) {
    $payload = (new ClinicAdminService())->getSettingsPayload('facility', $facilityId);
    $runbookCount = is_array($payload['runbooks']['cards'] ?? null)
        ? count($payload['runbooks']['cards'])
        : 0;
    $formsCount = is_array($payload['forms_catalog']['items'] ?? null)
        ? count($payload['forms_catalog']['items'])
        : 0;
    $hasSystemHealth = is_array($payload['system_health'] ?? null);
    $setupPercent = (int) ($payload['setup_progress']['score_percent'] ?? 0);
}

echo json_encode([
    'facility_id' => $facilityId,
    'enable_admin_hub' => $hubEnabled,
    'runbook_count' => $runbookCount,
    'forms_catalog_count' => $formsCount,
    'has_system_health' => $hasSystemHealth,
    'setup_percent' => $setupPercent,
], JSON_THROW_ON_ERROR) . PHP_EOL;
