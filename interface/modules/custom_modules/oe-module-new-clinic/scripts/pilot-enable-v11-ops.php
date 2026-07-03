<?php

/**
 * Enable V1.1-OPS polish flags for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v11-ops.php
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
$flags = [
    'enable_scheduling_redesign' => '1',
    'enable_faster_queue_interrupts' => '1',
    'faster_queue_interrupt_poll_seconds' => '10',
    'enable_similar_surname_queue_warning' => '1',
    'enable_momo_payment' => '1',
    'enable_pinned_reception_preview' => '1',
    'enable_pregnancy_banner_chip' => '1',
    'enable_l3b_background_completion' => '1',
    'enable_lab_results_toast' => '1',
    'enable_visit_board_kiosk_chrome' => '1',
    'enable_banner_mrd_deep_links' => '1',
    'enable_allergy_count_chip' => '1',
    'enable_in_chart_patient_search' => '1',
    'enable_scheduling_full_analytics' => '1',
];

foreach ($flags as $configKey => $configValue) {
    $config->set($configKey, $configValue, 0);
    $config->set($configKey, $configValue, $facilityId);
}

echo "Set V1.1-OPS flags for facility 0 and {$facilityId}:\n";
foreach (array_keys($flags) as $configKey) {
    echo "  {$configKey}\n";
}
