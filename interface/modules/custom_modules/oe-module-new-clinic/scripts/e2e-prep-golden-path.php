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

// E2E janitor: earlier specs abandon UI-registered fixture patients (fname Etoe*)
// mid-queue; with doctor-ready notify on, a leftover ready_for_doctor visit fires
// a persistent Patient-ready toast on every later doctor-desk load that parks
// over the queue toolbar and intercepts clicks in UNRELATED specs.
sqlStatement(
    "UPDATE new_visit v
     INNER JOIN patient_data pd ON pd.pid = v.pid
     SET v.state = 'cancelled', v.updated_at = NOW()
     WHERE v.state NOT IN ('completed', 'cancelled')
       AND (pd.fname LIKE 'Etoe%' OR pd.fname = 'EncInt' OR pd.fname LIKE 'DNE2E%'
            OR pd.lname LIKE 'RtE2E%' OR pd.lname LIKE 'Notify%'
            OR pd.lname LIKE 'LabOrd%' OR pd.lname LIKE 'PharmRx%')"
);

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
