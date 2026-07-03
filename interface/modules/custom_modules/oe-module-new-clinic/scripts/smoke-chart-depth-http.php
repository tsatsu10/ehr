<?php

/**
 * HTTP smoke: V1.1-CD chart depth payments island + payments_list API.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-cd.php
 *
 * Usage:
 *   php .../smoke-chart-depth-http.php [baseUrl] [user] [pass] [pid]
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';
$pid = (int) ($argv[4] ?? 0);

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-cd.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

if ($pid <= 0) {
    $fixtureScript = __DIR__ . DIRECTORY_SEPARATOR . 'v11-cd-smoke-fixture.php';
    $raw = shell_exec('"' . $phpBin . '" "' . $fixtureScript . '"');
    if (!is_string($raw) || trim($raw) === '') {
        fwrite(STDERR, "Could not read chart depth smoke fixture.\n");
        exit(1);
    }
    $fixture = json_decode(trim($raw), true);
    $pid = is_array($fixture) ? (int) ($fixture['pid'] ?? 0) : 0;
}

if ($pid <= 0) {
    fwrite(STDERR, "Patient id required for chart depth smoke.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-cd-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/chart-depth/payments.php?pid=' . $pid, $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'chart-depth');
$paymentsMode = is_array($props) && (($props['mode'] ?? '') === 'payments');

echo 'payments_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'chart_depth_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;
echo 'payments_mode=' . ($paymentsMode ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null || !$paymentsMode) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$csrfToken = (string) ($props['csrfToken'] ?? '');

if ($ajaxUrl === '' || $csrfToken === '') {
    fwrite(STDERR, "Missing ajaxUrl or csrfToken in island props.\n");
    exit(1);
}

$listUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('chart_depth.payments_list')
    . '&pid=' . rawurlencode((string) $pid)
    . '&offset=0'
    . '&filter=all_visits';

$listResp = smokeHttpRequest($listUrl, $cookieFile);
$listJson = json_decode($listResp['body'], true);
$hasRows = isset($listJson['data']['rows']) && is_array($listJson['data']['rows']);

echo 'chart_depth.payments_list HTTP ' . $listResp['code'] . PHP_EOL;
echo 'payments_rows=' . ($hasRows ? 'yes' : 'no') . PHP_EOL;

$ok = $listResp['code'] === 200 && ($listJson['success'] ?? false) && $hasRows;

exit($ok ? 0 : 1);
