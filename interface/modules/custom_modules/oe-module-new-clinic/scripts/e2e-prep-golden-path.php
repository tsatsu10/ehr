<?php

/**
 * Prepare local DB for New Clinic golden-path E2E.
 *
 * - Release stale doctor / pharmacy / lab desk work
 * - Enable Pharmacy Operations hub + formulary + stock (shared pilot seed)
 * - Enable Billing back office (M14) for close-day E2E
 * - Grant skip-queue, e-sign override, and bill-ops close ACLs for pilot users
 *
 * Usage: php interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-prep-golden-path.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pharm-ops-pilot-seed.php';
require_once __DIR__ . '/lib/golden-path-e2e-prep.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

goldenPathReleaseStaleDeskWork('doctor_user', 'with_doctor', 'ready_for_doctor');
goldenPathReleaseStaleDeskWork('doctor2_user', 'with_doctor', 'ready_for_doctor');
goldenPathReleaseStaleDeskWork('pharmacy_user', 'in_pharmacy', 'ready_for_pharmacy');
goldenPathReleaseStaleDeskWork('lab_user', 'in_lab', 'ready_for_lab');

$config = new ClinicConfigService();
$facilityIds = pharmOpsPilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pharmOpsPilotEnablePharmacyRole($config, $facilityIds);
pharmOpsPilotEnsureInhousePharmacyGlobal();
pharmOpsPilotEnsureHubConfig($config, $facilityIds);
pharmOpsPilotImportFormularyAndStock($config, $defaultFacilityId);
goldenPathEnsureBillOpsConfig($config, $facilityIds);
goldenPathEnsureDeskSkipAcls();
goldenPathEnsureBillOpsAcls();
goldenPathEnsureBillOpsAdminUser();
goldenPathEnsureClinicalDocConfig($config, $facilityIds);

echo "Golden-path E2E prep complete.\n";
