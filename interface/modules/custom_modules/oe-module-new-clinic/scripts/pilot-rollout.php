<?php

/**
 * Enable New Clinic V1 pilot product flags for global + default clinic facility.
 *
 * Desks, Lab Ops, Pharm Ops (formulary + stock), chart depth, comms hub, bill ops.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-rollout.php
 *
 * Run acl/seed_pilot_users.php first if desk users are missing.
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-rollout-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$config = new ClinicConfigService();
$facilityIds = pharmOpsPilotFacilityIds();
$defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

pilotRolloutEnsureProductFlags($config, $facilityIds);
pharmOpsPilotImportFormularyAndStock($config, $defaultFacilityId);

echo "Pilot rollout complete for facilities: " . implode(', ', $facilityIds) . ".\n";
echo "Smoke: npx playwright test tests/e2e/new-clinic/specs/module-pages-smoke.spec.js\n";
