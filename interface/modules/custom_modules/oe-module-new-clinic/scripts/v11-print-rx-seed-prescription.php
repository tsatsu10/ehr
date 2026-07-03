<?php

/**
 * Seed an active Paracetamol prescription on a with_doctor visit (V1.1-PRINT-RX HTTP / E2E helper).
 *
 * Usage:
 *   php .../v11-print-rx-seed-prescription.php <visit_id>
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$visitId = (int) ($argv[1] ?? 0);
if ($visitId <= 0) {
    fwrite(STDERR, "Usage: php v11-print-rx-seed-prescription.php <visit_id>\n");
    exit(1);
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Uuid\UuidRegistry;

$visit = QueryUtils::querySingleRow(
    "SELECT id, pid, encounter, state, assigned_provider_id FROM new_visit WHERE id = ?",
    [$visitId]
);
if (!is_array($visit) || empty($visit['id'])) {
    fwrite(STDERR, "Visit {$visitId} not found\n");
    exit(1);
}

$pid = (int) ($visit['pid'] ?? 0);
$encounter = (int) ($visit['encounter'] ?? 0);
if ($pid <= 0 || $encounter <= 0) {
    fwrite(STDERR, "Visit {$visitId} has no encounter for prescribing\n");
    exit(1);
}

$existing = QueryUtils::querySingleRow(
    "SELECT id FROM prescriptions WHERE patient_id = ? AND encounter = ? AND active = 1 ORDER BY id DESC LIMIT 1",
    [$pid, $encounter]
);
if (is_array($existing) && !empty($existing['id'])) {
    echo json_encode([
        'prescription_id' => (int) $existing['id'],
        'seeded' => false,
    ], JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(0);
}

$drug = QueryUtils::querySingleRow(
    "SELECT d.drug_id, d.name, d.form, d.size, d.unit, d.route,
            dt.dosage, dt.period, dt.quantity
     FROM drugs d
     LEFT JOIN drug_templates dt ON dt.drug_id = d.drug_id AND dt.selector = d.name
     WHERE d.name = 'Paracetamol' AND d.active = 1 AND d.dispensable = 1
     LIMIT 1"
);
if (!is_array($drug) || empty($drug['drug_id'])) {
    fwrite(STDERR, "Paracetamol drug row not found\n");
    exit(1);
}

$doctor = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['doctor_user']);
$actorUserId = (int) ($doctor['id'] ?? 1);

$encounterRow = QueryUtils::querySingleRow(
    'SELECT provider_id FROM form_encounter WHERE pid = ? AND encounter = ?',
    [$pid, $encounter]
);
$providerId = is_array($encounterRow) ? (int) ($encounterRow['provider_id'] ?? 0) : 0;
if ($providerId <= 0) {
    $providerId = $actorUserId;
}

$drugId = (int) ($drug['drug_id'] ?? 0);
$drugName = (string) ($drug['name'] ?? 'Paracetamol');
$dosage = trim((string) ($drug['dosage'] ?? '500 mg'));
$quantity = trim((string) ($drug['quantity'] ?? '1'));
if ($quantity === '') {
    $quantity = '1';
}
$route = trim((string) ($drug['route'] ?? ''));
$instructions = $dosage !== '' ? $dosage : $drugName;
$periodDays = (int) ($drug['period'] ?? 0);

$now = date('Y-m-d H:i:s');
$today = date('Y-m-d');
$endDate = $periodDays > 0 ? date('Y-m-d', strtotime('+' . $periodDays . ' days')) : null;
$uuid = UuidRegistry::getRegistryForTable('prescriptions')->createUuid();

$prescriptionId = (int) QueryUtils::sqlInsert(
    'INSERT INTO prescriptions (
        uuid, patient_id, provider_id, encounter, date_added, date_modified,
        start_date, end_date, drug, drug_id, dosage, quantity, route,
        refills, active, user, txDate, drug_dosage_instructions,
        usage_category, usage_category_title, request_intent, request_intent_title,
        created_by, updated_by
     ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        0, 1, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
     )',
    [
        $uuid,
        $pid,
        $providerId,
        $encounter,
        $now,
        $now,
        $today,
        $endDate,
        $drugName,
        $drugId,
        $dosage,
        $quantity,
        $route !== '' ? $route : null,
        'doctor_user',
        $today,
        $instructions,
        'outpatient',
        'Home/Community',
        'order',
        'Order',
        $actorUserId,
        $actorUserId,
    ]
);

UuidRegistry::createMissingUuidsForTables(['prescriptions']);

echo json_encode([
    'prescription_id' => $prescriptionId,
    'seeded' => true,
], JSON_THROW_ON_ERROR) . PHP_EOL;
