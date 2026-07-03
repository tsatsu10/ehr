<?php

/**
 * Enable V1.1-ADMIN (M15 Admin Operations Hub) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-admin.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

foreach ($facilityIds as $facilityId) {
    $config->set('enable_admin_hub', '1', $facilityId);
    $config->set('enable_react_admin_hub', '1', $facilityId);
    echo "Set enable_admin_hub=1 for facility {$facilityId}.\n";
}

$enabled = $config->isEnabled('enable_admin_hub', 0, $defaultFacilityId);
$payload = $enabled
    ? (new ClinicAdminService())->getSettingsPayload('facility', $defaultFacilityId)
    : null;

$runbookCount = is_array($payload['runbooks']['cards'] ?? null)
    ? count($payload['runbooks']['cards'])
    : 0;
$formsCount = is_array($payload['forms_catalog']['items'] ?? null)
    ? count($payload['forms_catalog']['items'])
    : 0;

echo "Set V1.1-ADMIN flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_admin_hub\n";
echo "  enable_react_admin_hub\n";
echo '  admin_hub_ready=' . ($enabled ? 'yes' : 'no') . "\n";
echo "  runbook_cards={$runbookCount}\n";
echo "  forms_catalog_items={$formsCount}\n";
echo "Open: /interface/modules/custom_modules/oe-module-new-clinic/public/admin.php\n";
