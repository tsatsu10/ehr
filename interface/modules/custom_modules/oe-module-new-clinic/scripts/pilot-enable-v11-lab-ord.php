<?php

/**
 * Enable V1.1-LAB-ORD (doctor panel quick order, M4-F36) for E2E / pilot smoke.
 *
 * Requires V1.1-LAB hub + imported OPD starter panel (D-LAB-2).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-lab-ord.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/lab-ops-pilot-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\LabPanelOrderService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = labOpsPilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

labOpsPilotEnableLabRole($config, $facilityIds);
labOpsPilotEnsureHubConfig($config, $facilityIds);
labOpsPilotImportStarterPanel($config, $defaultFacilityId);

$enabled = (new LabPanelOrderService())->isFeatureEnabled($defaultFacilityId);

echo "Set V1.1-LAB-ORD flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_lab_role\n";
echo "  enable_lab_ops\n";
echo "  enable_lab_panel_order\n";
echo '  lab_panel_quick_order=' . ($enabled ? 'ready' : 'not_ready') . "\n";
echo "Doctor Desk → Quick lab order when consult active.\n";
