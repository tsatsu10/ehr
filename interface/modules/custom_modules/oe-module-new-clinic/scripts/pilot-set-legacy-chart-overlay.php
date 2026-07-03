<?php

/**
 * Set enable_legacy_patient_context_overlay for pilot / smoke scripts.
 *
 * Usage:
 *   php .../pilot-set-legacy-chart-overlay.php 1
 *   php .../pilot-set-legacy-chart-overlay.php 0
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$overlayFlag = $argv[1] ?? '1';
if ($overlayFlag !== '0' && $overlayFlag !== '1') {
    fwrite(STDERR, "Value must be 0 or 1.\n");
    exit(1);
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$config = new ClinicConfigService();
$config->set('enable_legacy_patient_context_overlay', $overlayFlag, 0);
$config->set('enable_legacy_patient_context_overlay', $overlayFlag, $facilityId);

echo "Set enable_legacy_patient_context_overlay={$overlayFlag} for facility 0 and {$facilityId}.\n";
