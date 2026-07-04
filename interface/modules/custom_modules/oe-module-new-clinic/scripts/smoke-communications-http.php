<?php

/**
 * HTTP smoke: V1.1-COM hub page + hub counts + messages list APIs.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-comms.php
 *   php .../v11-comms-fixture-seed.php
 *
 * Usage:
 *   php .../smoke-communications-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? (getenv('TEST_USERNAME_ADMIN') ?: 'Adminstrator');
$pass = $argv[3] ?? (getenv('TEST_PASSWORD_ADMIN') ?: 'passpass1');

$phpBin = smokeResolvePhpBinary();
passthru('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-comms.php"');
passthru('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'v11-comms-fixture-seed.php"');

$fixtureRaw = shell_exec('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'v11-comms-smoke-fixture.php"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Invalid communications smoke fixture JSON.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-comms-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/communications.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'communications-hub');

echo 'communications_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'communications_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;
echo 'communications_hub_enable=' . (!empty($fixture['communications_hub_enable']) ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$countsUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('communications.hub_counts');

$countsResp = smokeHttpRequest($countsUrl, $cookieFile);
$countsJson = json_decode($countsResp['body'], true);
$hasCounts = ($countsJson['success'] ?? false)
    && isset($countsJson['data']['messages_active']);

echo 'communications.hub_counts HTTP ' . $countsResp['code'] . PHP_EOL;
echo 'hub_counts=' . ($hasCounts ? 'yes' : 'no') . PHP_EOL;

$listUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('communications.messages_list')
    . '&begin=0&limit=25';

$listResp = smokeHttpRequest($listUrl, $cookieFile);
$listJson = json_decode($listResp['body'], true);
$messageId = (int) ($fixture['message_id'] ?? 0);
$rows = is_array($listJson['data']['rows'] ?? null) ? $listJson['data']['rows'] : [];
$hasFixtureMessage = false;
if ($messageId > 0) {
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        if ((int) ($row['id'] ?? 0) === $messageId) {
            $hasFixtureMessage = true;
            break;
        }
    }
}

echo 'communications.messages_list HTTP ' . $listResp['code'] . PHP_EOL;
echo 'fixture_message=' . ($hasFixtureMessage ? 'yes' : 'no') . PHP_EOL;

$ok = $countsResp['code'] === 200
    && $listResp['code'] === 200
    && $hasCounts
    && $hasFixtureMessage;

exit($ok ? 0 : 1);
