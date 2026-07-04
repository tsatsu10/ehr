<?php

/**
 * Emit JSON fixture for V1.2-BILL depth E2E (charge correction + payment reverse).
 *
 * Prerequisite:
 *   php .../v12-bill-depth-fixture-seed.php
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-bill-depth-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/bill-depth-fixture-lib.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$correct = billDepthFindPaidVisit(NC_BILL_DEPTH_CORRECT_LNAME);
$reverse = billDepthFindPaidVisit(NC_BILL_DEPTH_REVERSE_LNAME);

if ($correct === null || $reverse === null) {
    fwrite(STDERR, "Missing bill depth visits — run v12-bill-depth-fixture-seed.php\n");
    exit(1);
}

$addFeeId = 0;
$fees = (new FeeScheduleAdminService())->listForDesk($facilityId);
$visitId = (int) ($correct['visit_id'] ?? 0);
$pid = (int) ($correct['pid'] ?? 0);
$encounterRow = QueryUtils::querySingleRow('SELECT encounter FROM new_visit WHERE id = ?', [$visitId]);
$encounter = is_array($encounterRow) ? (int) ($encounterRow['encounter'] ?? 0) : 0;
$existingCodes = [];
if ($pid > 0 && $encounter > 0) {
    $billingRows = QueryUtils::fetchRecords(
        'SELECT code FROM billing WHERE pid = ? AND encounter = ? AND activity = 1',
        [$pid, $encounter]
    ) ?: [];
    foreach ($billingRows as $billingRow) {
        $existingCodes[(string) ($billingRow['code'] ?? '')] = true;
    }
}
foreach ($fees as $fee) {
    $code = (string) ($fee['billing_code'] ?? '');
    if ($code !== '' && !isset($existingCodes[$code])) {
        $addFeeId = (int) ($fee['id'] ?? 0);
        break;
    }
}
if ($addFeeId <= 0 && isset($fees[1])) {
    $addFeeId = (int) ($fees[1]['id'] ?? 0);
}
if ($addFeeId <= 0 && isset($fees[0])) {
    $addFeeId = (int) ($fees[0]['id'] ?? 0);
}

$receiptDate = substr((string) ($reverse['created_at'] ?? ''), 0, 10);

echo json_encode([
    'facility_id' => $facilityId,
    'enable_bill_ops' => (new BillOpsAccessService())->isHubEnabled($facilityId),
    'correction_visit_id' => $visitId,
    'correction_receipt_id' => (int) ($correct['receipt_id'] ?? 0),
    'correction_receipt_number' => (string) ($correct['receipt_number'] ?? ''),
    'add_fee_schedule_id' => $addFeeId,
    'reverse_visit_id' => (int) ($reverse['visit_id'] ?? 0),
    'reverse_receipt_id' => (int) ($reverse['receipt_id'] ?? 0),
    'reverse_receipt_number' => (string) ($reverse['receipt_number'] ?? ''),
    'reverse_receipt_date' => $receiptDate,
], JSON_THROW_ON_ERROR) . PHP_EOL;
