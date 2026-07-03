<?php

/**
 * Enable V1.2-BILL (M14 Billing Back Office) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v12-bill.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/golden-path-e2e-prep.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No service-location facility configured.\n");
    exit(1);
}

$config = new ClinicConfigService();
$flags = [
    'enable_bill_ops' => '1',
    'enable_bill_ops_outstanding' => '1',
    'enable_react_bill_ops' => '1',
    'enable_insurance' => '1',
];

foreach ($flags as $configKey => $configValue) {
    $config->set($configKey, $configValue, 0);
    $config->set($configKey, $configValue, $facilityId);
}

echo "V1.2-BILL enabled for facility 0 and {$facilityId}:\n";
foreach (array_keys($flags) as $configKey) {
    echo "  {$configKey}=1\n";
}
goldenPathEnsureBillOpsAcls();
goldenPathEnsureBillOpsAdminUser();
echo "Hub: .../public/bill-ops/index.php\n";
echo "Clinic desk roles: stock Fees menus hidden (M14-F06).\n";
