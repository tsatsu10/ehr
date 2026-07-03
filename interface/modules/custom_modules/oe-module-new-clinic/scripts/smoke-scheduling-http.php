<?php

/**
 * HTTP smoke: S1 Scheduling & Flow page + scheduling.calendar.range API.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-scheduling.php
 *
 * Usage:
 *   php .../smoke-scheduling-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-scheduling.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$fixtureScript = __DIR__ . DIRECTORY_SEPARATOR . 'v11-scheduling-smoke-fixture.php';
$fixtureRaw = shell_exec('"' . $phpBin . '" "' . $fixtureScript . '"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Failed to read scheduling smoke fixture JSON.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-scheduling-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/scheduling/index.php?lens=calendar', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'scheduling');

echo 'scheduling_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'scheduling_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;
echo 'enable_scheduling_redesign=' . (!empty($fixture['enable_scheduling_redesign']) ? 'yes' : 'no') . PHP_EOL;
echo 'smoke_fixture=' . (!empty($fixture['smoke_fixture_pc_eid']) ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$facilityId = (int) ($props['facilityId'] ?? $fixture['facility_id'] ?? 0);
$anchorDate = (string) ($props['initialDate'] ?? date('Y-m-d'));
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$rangeUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('scheduling.calendar.range')
    . '&view=day'
    . '&date=' . rawurlencode($anchorDate)
    . ($facilityId > 0 ? '&facility_id=' . $facilityId : '');

$rangeResp = smokeHttpRequest($rangeUrl, $cookieFile);
$rangeJson = json_decode($rangeResp['body'], true);
$hasRange = ($rangeJson['success'] ?? false)
    && is_array($rangeJson['data']['events'] ?? null);

echo 'scheduling.calendar.range HTTP ' . $rangeResp['code'] . PHP_EOL;
echo 'calendar_has_events=' . ($hasRange ? 'yes' : 'no') . PHP_EOL;

$ok = $rangeResp['code'] === 200
    && $hasRange
    && !empty($fixture['enable_scheduling_redesign'])
    && (int) ($fixture['smoke_fixture_pc_eid'] ?? 0) > 0;

exit($ok ? 0 : 1);
