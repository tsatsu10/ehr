<?php

/**
 * Enable enable_native_rx_history and ensure a patient has both a
 * non-discontinued and a discontinued prescription, for the HTTP smoke.
 * Emits JSON fixture. Runs as its own CLI process so its globals.php-backed
 * DB session never shares a process with the smoke script's curl-driven
 * login (mirrors the v11-print-rx pilot-enable/fixture split).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/rx-history-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$config = new ClinicConfigService();
foreach ([0, $facilityId] as $fid) {
    $config->set('enable_native_rx_history', '1', $fid);
}

$rxPatient = QueryUtils::querySingleRow(
    'SELECT patient_id, encounter FROM prescriptions WHERE active = 1 ORDER BY id DESC LIMIT 1'
) ?: QueryUtils::querySingleRow('SELECT patient_id, encounter FROM prescriptions ORDER BY id DESC LIMIT 1');

if (!is_array($rxPatient) || empty($rxPatient['patient_id'])) {
    fwrite(STDERR, "No prescriptions found in this DB to smoke against -- seed one first.\n");
    exit(1);
}

$pid = (int) $rxPatient['patient_id'];
$encounter = (int) $rxPatient['encounter'];

$discontinued = QueryUtils::querySingleRow(
    'SELECT id FROM prescriptions WHERE patient_id = ? AND active = 0 LIMIT 1',
    [$pid]
);
if (!is_array($discontinued) || empty($discontinued['id'])) {
    $uuid = UuidRegistry::getRegistryForTable('prescriptions')->createUuid();
    $now = date('Y-m-d H:i:s');
    QueryUtils::sqlInsert(
        'INSERT INTO prescriptions (
            uuid, patient_id, provider_id, encounter, date_added, date_modified,
            start_date, drug, drug_id, dosage, quantity, active, user, txDate,
            usage_category, usage_category_title, request_intent, request_intent_title,
            created_by, updated_by
         ) VALUES (?, ?, 0, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $uuid, $pid, $encounter, $now, $now, date('Y-m-d'), 'Smoke Discontinued Rx',
            '500mg', '1', 'smoke_user', date('Y-m-d'),
            'outpatient', 'Home/Community', 'order', 'Order', 1, 1,
        ]
    );
    UuidRegistry::createMissingUuidsForTables(['prescriptions']);
}

echo json_encode([
    'facility_id' => $facilityId,
    'pid' => $pid,
], JSON_THROW_ON_ERROR) . PHP_EOL;
