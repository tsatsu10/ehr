<?php

/**
 * HTTP smoke: V1.2-BILL charge correction + payment reverse APIs.
 *
 * Prerequisite:
 *   php .../pilot-enable-v12-bill.php
 *   php .../v12-bill-depth-fixture-seed.php
 *
 * Usage:
 *   php .../smoke-bill-ops-depth-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'cashier_user';
$pass = $argv[3] ?? 'test_pass';

$phpBin = smokeResolvePhpBinary();
passthru('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v12-bill.php"');
passthru('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'v12-bill-depth-fixture-seed.php"');

$fixtureRaw = shell_exec('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'v12-bill-depth-smoke-fixture.php"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Failed to read bill depth fixture JSON.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-bill-ops-depth-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/bill-ops/index.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'bill-ops');
if ($pageResp['code'] !== 200 || $props === null) {
    fwrite(STDERR, "Bill ops page failed.\n");
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$csrfToken = (string) ($props['csrfToken'] ?? '');
if ($ajaxUrl === '' || $csrfToken === '') {
    fwrite(STDERR, "Missing ajaxUrl or csrfToken.\n");
    exit(1);
}

$visitId = (int) ($fixture['correction_visit_id'] ?? 0);
$addFeeId = (int) ($fixture['add_fee_schedule_id'] ?? 0);
$correctResp = smokeAjaxJsonPost($ajaxUrl, 'bill_ops.charge_correct', $cookieFile, [
    'visit_id' => $visitId,
    'add' => $addFeeId > 0 ? [['fee_schedule_id' => $addFeeId, 'units' => 1]] : [],
    'remove' => [],
    'reason' => 'HTTP smoke charge correction',
    'csrf_token_form' => $csrfToken,
]);
$correctJson = json_decode($correctResp['body'], true);
$correctOk = $correctResp['code'] === 200
    && ($correctJson['success'] ?? false)
    && is_array($correctJson['data']['charges'] ?? null);

echo 'bill_ops.charge_correct HTTP ' . $correctResp['code'] . PHP_EOL;
echo 'charge_correct_ok=' . ($correctOk ? 'yes' : 'no') . PHP_EOL;

$reverseReceiptId = (int) ($fixture['reverse_receipt_id'] ?? 0);
$reverseResp = smokeAjaxJsonPost($ajaxUrl, 'bill_ops.payment_reverse', $cookieFile, [
    'receipt_id' => $reverseReceiptId,
    'reason' => 'HTTP smoke payment reverse',
    'csrf_token_form' => $csrfToken,
]);
$reverseJson = json_decode($reverseResp['body'], true);
$reverseOk = $reverseResp['code'] === 200 && ($reverseJson['success'] ?? false);

echo 'bill_ops.payment_reverse HTTP ' . $reverseResp['code'] . PHP_EOL;
echo 'payment_reverse_ok=' . ($reverseOk ? 'yes' : 'no') . PHP_EOL;

$dupResp = smokeAjaxJsonPost($ajaxUrl, 'bill_ops.payment_reverse', $cookieFile, [
    'receipt_id' => $reverseReceiptId,
    'reason' => 'HTTP smoke duplicate reverse',
    'csrf_token_form' => $csrfToken,
]);
$dupJson = json_decode($dupResp['body'], true);
$dupBlocked = ($dupJson['success'] ?? true) === false;

echo 'bill_ops.payment_reverse duplicate blocked=' . ($dupBlocked ? 'yes' : 'no') . PHP_EOL;

$ok = !empty($fixture['enable_bill_ops'])
    && $visitId > 0
    && $reverseReceiptId > 0
    && $correctOk
    && $reverseOk
    && $dupBlocked;

exit($ok ? 0 : 1);
