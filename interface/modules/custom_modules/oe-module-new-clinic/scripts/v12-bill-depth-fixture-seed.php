<?php

/**
 * Seed paid visits for V1.2-BILL depth E2E (charge correction + payment reverse).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v12-bill-depth-fixture-seed.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/bill-depth-fixture-lib.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
if ($facilityId <= 0) {
    fwrite(STDERR, "No default facility — abort.\n");
    exit(1);
}

$cashier = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', ['cashier_user']);
$actorUserId = (int) ($cashier['id'] ?? 0);
if ($actorUserId <= 0) {
    fwrite(STDERR, "cashier_user not found — run seed_pilot_users.php\n");
    exit(1);
}

$correct = billDepthEnsurePaidVisit(NC_BILL_DEPTH_CORRECT_LNAME, 'BillCorrect', $facilityId, $actorUserId);
echo "Correction visit_id={$correct['visit_id']} receipt={$correct['receipt_number']}\n";

$reverse = billDepthEnsurePaidVisit(NC_BILL_DEPTH_REVERSE_LNAME, 'BillReverse', $facilityId, $actorUserId);
echo "Reverse visit_id={$reverse['visit_id']} receipt={$reverse['receipt_number']}\n";

echo "Bill depth fixture ready.\n";
