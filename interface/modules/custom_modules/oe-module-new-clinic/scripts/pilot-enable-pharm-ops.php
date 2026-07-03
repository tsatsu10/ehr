<?php

/**
 * Enable Pharmacy Operations Hub for pilot / local UAT.
 *
 * - enable_pharmacy_role + enable_pharm_ops + quick Rx + labels + print Rx
 * - inhouse_pharmacy global
 * - Starter formulary import + Paracetamol stock seed
 *
 * Usage: php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-pharm-ops.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pharm-ops-pilot-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pharmOpsPilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pharmOpsPilotEnablePharmacyRole($config, $facilityIds);
pharmOpsPilotEnsureInhousePharmacyGlobal();
pharmOpsPilotEnsureHubConfig($config, $facilityIds);
pharmOpsPilotEnsureLeadAcls();
pharmOpsPilotImportFormularyAndStock($config, $defaultFacilityId);

echo "Pharm ops pilot enable complete for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "Open: …/public/pharm-ops/index.php (requires pharmacy_user or admin ACL).\n";
