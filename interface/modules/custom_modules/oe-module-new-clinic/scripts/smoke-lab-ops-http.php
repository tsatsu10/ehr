<?php

/**
 * HTTP smoke: V1.1-LAB hub island + worklist API.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-lab.php
 *
 * Usage:
 *   php .../smoke-lab-ops-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-lab.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-lab-ops-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/lab-ops/index.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'lab-ops');

echo 'lab_ops_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'lab_ops_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$csrfToken = (string) ($props['csrfToken'] ?? '');
$today = (new DateTimeImmutable('today'))->format('Y-m-d');

if ($ajaxUrl === '' || $csrfToken === '') {
    fwrite(STDERR, "Missing ajaxUrl or csrfToken in island props.\n");
    exit(1);
}

$worklistResp = smokeAjaxJsonPost($ajaxUrl, 'lab_ops.worklist', $cookieFile, [
    'tab' => 'pending',
    'date' => $today,
    'fulfillment' => 'all',
    'urgent_first' => true,
    'csrf_token_form' => $csrfToken,
]);
$worklistJson = json_decode($worklistResp['body'], true);
$hasRowsKey = isset($worklistJson['data']['rows']) && is_array($worklistJson['data']['rows']);
$hasCounts = isset($worklistJson['data']['counts']) && is_array($worklistJson['data']['counts']);

echo 'lab_ops.worklist HTTP ' . $worklistResp['code'] . PHP_EOL;
echo 'worklist_rows=' . ($hasRowsKey ? 'yes' : 'no') . PHP_EOL;
echo 'worklist_counts=' . ($hasCounts ? 'yes' : 'no') . PHP_EOL;

$ok = $worklistResp['code'] === 200
    && ($worklistJson['success'] ?? false)
    && $hasRowsKey
    && $hasCounts;

exit($ok ? 0 : 1);
