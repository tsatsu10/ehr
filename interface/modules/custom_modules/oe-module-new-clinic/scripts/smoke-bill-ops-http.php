<?php

/**
 * HTTP smoke: Billing Back Office hub + daysheet + outstanding (BILL-3–BILL-4).
 *
 * Prerequisite:
 *   php .../pilot-enable-v12-bill.php
 *
 * Usage:
 *   php .../smoke-bill-ops-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'cashier_user';
$pass = $argv[3] ?? 'test_pass';

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-bill-ops-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/bill-ops/index.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'bill-ops');

echo 'bill_ops_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'bill_ops_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$csrfToken = (string) ($props['csrfToken'] ?? '');
$facilityId = (int) ($props['facilityId'] ?? 0);
$today = (new DateTimeImmutable('today'))->format('Y-m-d');

if ($ajaxUrl === '' || $csrfToken === '') {
    fwrite(STDERR, "Missing ajaxUrl or csrfToken in island props.\n");
    exit(1);
}

$daysheetResp = smokeAjaxJsonPost($ajaxUrl, 'bill_ops.daysheet', $cookieFile, [
    'date' => $today,
    'facility_id' => $facilityId > 0 ? $facilityId : null,
    'csrf_token_form' => $csrfToken,
]);
$daysheetJson = json_decode($daysheetResp['body'], true);
$hasRecon = isset($daysheetJson['data']['reconciliation']);

echo 'bill_ops.daysheet HTTP ' . $daysheetResp['code'] . PHP_EOL;
echo 'bill_ops.daysheet reconciliation=' . ($hasRecon ? 'yes' : 'no') . PHP_EOL;

$outstandingResp = smokeAjaxJsonPost($ajaxUrl, 'bill_ops.outstanding_list', $cookieFile, [
    'offset' => 0,
    'limit' => 25,
    'csrf_token_form' => $csrfToken,
]);
$outstandingJson = json_decode($outstandingResp['body'], true);
$outstandingTotal = (int) ($outstandingJson['data']['total'] ?? -1);

echo 'bill_ops.outstanding_list HTTP ' . $outstandingResp['code'] . PHP_EOL;
echo 'bill_ops.outstanding_list total=' . $outstandingTotal . PHP_EOL;

$ok = $pageResp['code'] === 200
    && $props !== null
    && $daysheetResp['code'] === 200
    && $hasRecon
    && $outstandingResp['code'] === 200
    && $outstandingTotal >= 0;

exit($ok ? 0 : 1);
