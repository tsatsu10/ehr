<?php

/**
 * Enable V1.1-PRINT-RX (community pharmacy Rx PDF, M4-F38) for E2E / pilot smoke.
 *
 * Gate: enable_rx_print (not hub-gated per D-PHARM-4). Quick prescribe path also
 * enables formulary favorites for smoke flows.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-print-rx.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pharm-ops-pilot-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pharmOpsPilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pharmOpsPilotEnablePharmacyRole($config, $facilityIds);
pharmOpsPilotEnsureInhousePharmacyGlobal();

foreach ($facilityIds as $facilityId) {
    $config->set('enable_rx_print', '1', $facilityId);
    $config->set('enable_pharm_rx_favorites', '1', $facilityId);
    $config->set('enable_pharm_ops', '0', $facilityId);
    echo "Set enable_rx_print=1 for facility {$facilityId}.\n";
    echo "Set enable_pharm_rx_favorites=1 for facility {$facilityId}.\n";
    echo "Set enable_pharm_ops=0 for facility {$facilityId}.\n";
}

pharmOpsPilotImportFormularyAndStock($config, $defaultFacilityId);

$access = new PharmOpsAccessService();
$rxPrintOn = $access->isRxPrintEnabled($defaultFacilityId);

echo "Set V1.1-PRINT-RX flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_rx_print\n";
echo '  rx_print_ready=' . ($rxPrintOn ? 'yes' : 'no') . "\n";
echo "Doctor Desk → Print Rx on active prescriptions (no pharm_ops hub required).\n";
