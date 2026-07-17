<?php

/**
 * HTTP smoke: native Prescription History (enable_native_rx_history) ajax
 * action + rx-history.php page.
 *
 * Usage:
 *   php .../smoke-rx-history-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$fixtureScript = __DIR__ . DIRECTORY_SEPARATOR . 'rx-history-smoke-fixture.php';
$fixtureRaw = shell_exec('"' . $phpBin . '" "' . $fixtureScript . '"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture) || empty($fixture['pid'])) {
    fwrite(STDERR, "Failed to read rx-history smoke fixture JSON.\n");
    exit(1);
}

$pid = (int) $fixture['pid'];

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-rx-history-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/pharmacy.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'pharmacy-desk');

echo 'pharmacy_desk HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'pharmacy_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$historyUrl = $ajaxUrl . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('pharmacy.rx_history')
    . '&pid=' . $pid . '&page=1&page_size=25&status=all';
$historyResp = smokeHttpRequest($historyUrl, $cookieFile);
$historyJson = json_decode($historyResp['body'], true);
$rows = is_array($historyJson) ? ($historyJson['data']['rows'] ?? []) : [];
$statuses = array_unique(array_column(is_array($rows) ? $rows : [], 'status'));

echo 'pharmacy.rx_history HTTP ' . $historyResp['code'] . PHP_EOL;
echo 'row_count=' . (is_array($rows) ? count($rows) : 0) . PHP_EOL;
echo 'statuses=' . implode(',', $statuses) . PHP_EOL;
echo 'includes_discontinued=' . (in_array('discontinued', $statuses, true) ? 'yes' : 'no') . PHP_EOL;

if ($historyResp['code'] !== 200 || !in_array('discontinued', $statuses, true)) {
    exit(1);
}

$historyPageResp = smokeHttpRequest($moduleBase . '/rx-history.php?pid=' . $pid, $cookieFile);
$historyPageProps = smokeExtractIslandProps($historyPageResp['body'], 'rx-history');

echo 'rx_history_page HTTP ' . $historyPageResp['code'] . PHP_EOL;
echo 'rx_history_island=' . ($historyPageProps !== null ? 'yes' : 'no') . PHP_EOL;

exit($historyPageResp['code'] === 200 && $historyPageProps !== null ? 0 : 1);
