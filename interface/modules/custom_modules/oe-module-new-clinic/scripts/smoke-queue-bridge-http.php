<?php

/**
 * HTTP smoke: V1.1-BRIDGE hub page + queue_bridge.list API.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-bridge.php
 *
 * Usage:
 *   php .../smoke-queue-bridge-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-bridge.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$fixtureScript = __DIR__ . DIRECTORY_SEPARATOR . 'v11-bridge-smoke-fixture.php';
$fixtureRaw = shell_exec('"' . $phpBin . '" "' . $fixtureScript . '"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Failed to read queue bridge fixture JSON.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-queue-bridge-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/queue-bridge/index.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'queue-bridge');

echo 'queue_bridge_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'queue_bridge_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;
echo 'enable_queue_bridge=' . (!empty($fixture['enable_queue_bridge']) ? 'yes' : 'no') . PHP_EOL;
echo 'ex01_fixture=' . (!empty($fixture['ex01_fixture_present']) ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$facilityId = (int) ($props['facilityId'] ?? 0);
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$listUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('queue_bridge.list')
    . '&lens=action'
    . ($facilityId > 0 ? '&facility_id=' . $facilityId : '');

$listResp = smokeHttpRequest($listUrl, $cookieFile);
$listJson = json_decode($listResp['body'], true);
$hasList = ($listJson['success'] ?? false)
    && is_array($listJson['data']['rows'] ?? null)
    && is_array($listJson['data']['counts'] ?? null);

echo 'queue_bridge.list HTTP ' . $listResp['code'] . PHP_EOL;
echo 'list_has_rows=' . ($hasList ? 'yes' : 'no') . PHP_EOL;

$ok = $listResp['code'] === 200
    && $hasList
    && !empty($fixture['enable_queue_bridge']);

exit($ok ? 0 : 1);
