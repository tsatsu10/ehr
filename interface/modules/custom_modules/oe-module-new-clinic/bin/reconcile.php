<?php

/**
 * CLI: daily cashier reconciliation for all enabled facilities (§16.2).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/bin/reconcile.php
 *   php interface/modules/custom_modules/oe-module-new-clinic/bin/reconcile.php 2026-06-26
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$ignoreAuth = true;
require_once dirname(__DIR__, 5) . '/interface/globals.php';

use OpenEMR\Modules\NewClinic\Services\ReconciliationService;

$runDate = $argv[1] ?? date('Y-m-d');
$service = new ReconciliationService();
$results = $service->runAllEnabledFacilities($runDate, 'scheduled');

foreach ($results as $result) {
    if (!empty($result['skipped'])) {
        echo sprintf(
            "Skipped facility %d (%s)\n",
            (int) ($result['facility_id'] ?? 0),
            (string) ($result['reason'] ?? '')
        );
        continue;
    }

    if (($result['status'] ?? '') === 'error') {
        echo sprintf(
            "ERROR facility %d date %s: %s\n",
            (int) ($result['facility_id'] ?? 0),
            (string) ($result['run_date'] ?? $runDate),
            (string) ($result['error_message'] ?? 'unknown')
        );
        continue;
    }

    echo sprintf(
        "Facility %d date %s status=%s module=%.2f core=%.2f delta=%.2f\n",
        (int) ($result['facility_id'] ?? 0),
        (string) ($result['run_date'] ?? $runDate),
        (string) ($result['status'] ?? ''),
        (float) ($result['module_total_amount'] ?? 0),
        (float) ($result['core_total_amount'] ?? 0),
        (float) ($result['delta_amount'] ?? 0)
    );
}

echo "New Clinic reconciliation complete.\n";
