<?php

/**
 * Emit JSON fixture for BILL e2e / HTTP smoke (latest non-reversed receipt + visit).
 *
 * Usage:
 *   php .../bill-ops-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;

$defaultFacilityRow = QueryUtils::querySingleRow(
    "SELECT id FROM facility WHERE service_location = 1 ORDER BY id ASC LIMIT 1"
);
$defaultFacilityId = is_array($defaultFacilityRow) ? (int) ($defaultFacilityRow['id'] ?? 0) : 0;

$row = null;
if ($defaultFacilityId > 0) {
    $row = QueryUtils::querySingleRow(
        "SELECT r.id AS receipt_id, r.receipt_number, r.visit_id, r.facility_id, r.created_at,
                v.state AS visit_state, v.queue_number
         FROM new_receipt r
         INNER JOIN new_visit v ON v.id = r.visit_id
         WHERE r.reversed_at IS NULL AND r.facility_id = ?
         ORDER BY r.id DESC
         LIMIT 1",
        [$defaultFacilityId]
    );
}

if (!is_array($row)) {
    $row = QueryUtils::querySingleRow(
        "SELECT r.id AS receipt_id, r.receipt_number, r.visit_id, r.facility_id, r.created_at,
                v.state AS visit_state, v.queue_number
         FROM new_receipt r
         INNER JOIN new_visit v ON v.id = r.visit_id
         WHERE r.reversed_at IS NULL
         ORDER BY r.id DESC
         LIMIT 1"
    );
}

$createdAt = is_array($row) ? (string) ($row['created_at'] ?? '') : '';
$receiptDate = $createdAt !== '' ? substr($createdAt, 0, 10) : '';

$payload = [
    'receipt_id' => is_array($row) ? (int) ($row['receipt_id'] ?? 0) : 0,
    'receipt_number' => is_array($row) ? (string) ($row['receipt_number'] ?? '') : '',
    'receipt_date' => $receiptDate,
    'facility_id' => is_array($row) ? (int) ($row['facility_id'] ?? 0) : 0,
    'default_facility_id' => $defaultFacilityId,
    'visit_id' => is_array($row) ? (int) ($row['visit_id'] ?? 0) : 0,
    'visit_state' => is_array($row) ? (string) ($row['visit_state'] ?? '') : '',
    'queue_number' => is_array($row) ? (int) ($row['queue_number'] ?? 0) : 0,
];

echo json_encode($payload, JSON_THROW_ON_ERROR) . PHP_EOL;
