<?php

/**
 * Enable V1.1-ANC for E2E / pilot smoke (§6.8, §21.1i).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-anc.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-ancillary-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No service-location facility configured.\n");
    exit(1);
}

$result = pilotAncillaryEnsureAll(new ClinicConfigService());

echo "V1.1-ANC enabled for facilities: " . implode(', ', $result['facility_ids']) . PHP_EOL;
echo "  enable_ancillary_services=1 (requires lab + pharmacy desk roles ON)\n";
echo "  visit types seeded per facility: Lab-only (direct), Pharmacy walk-in\n";
echo "Front Desk Start visit should list lab_direct + pharmacy_walkin profiles.\n";
echo "Daily Reports → Ancillary tab when logged in with reports access.\n";
