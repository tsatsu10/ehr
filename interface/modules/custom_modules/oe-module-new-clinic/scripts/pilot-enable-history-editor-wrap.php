<?php

/**
 * Enable History editor T1 wrap (V1.1-HIST-WRAP) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-history-editor-wrap.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No service-location facility configured.\n");
    exit(1);
}

$config = new ClinicConfigService();
$config->set('enable_history_editor_wrap', '1', 0);
$config->set('enable_history_editor_wrap', '1', $facilityId);

echo "Set enable_history_editor_wrap=1 for facility 0 and {$facilityId}.\n";
echo "Open chart Clinical → Edit history, or:\n";
echo "/interface/patient_file/history/history_full.php?set_pid=4&return=clinical-background\n";
