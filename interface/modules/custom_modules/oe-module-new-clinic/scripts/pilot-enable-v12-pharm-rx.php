<?php

/**
 * Enable V1.2-PHARM-RX (doctor formulary quick prescribe, M4-F37) for E2E / pilot smoke.
 *
 * Requires V1.1-PHARM hub + imported OPD starter formulary (D-PHARM-2).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-pharm-rx.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pharm-ops-pilot-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PharmFormularyRxService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pharmOpsPilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pharmOpsPilotEnablePharmacyRole($config, $facilityIds);
pharmOpsPilotEnsureInhousePharmacyGlobal();
pharmOpsPilotEnsureHubConfig($config, $facilityIds);
pharmOpsPilotEnsureLeadAcls();
pharmOpsPilotImportFormularyAndStock($config, $defaultFacilityId);

$enabled = (new PharmFormularyRxService())->isFeatureEnabled($defaultFacilityId);

echo "Set V1.2-PHARM-RX flags for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "  enable_pharmacy_role\n";
echo "  enable_pharm_ops\n";
echo "  enable_pharm_rx_favorites\n";
echo '  formulary_quick_rx=' . ($enabled ? 'ready' : 'not_ready') . "\n";
echo "Doctor Desk → Quick prescribe when consult active.\n";
