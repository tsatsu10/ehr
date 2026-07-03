<?php

/**
 * HTTP smoke: V1.1-REP hub page + today summary + clinical catalog APIs.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-rep.php
 *
 * Usage:
 *   php .../smoke-report-hub-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-rep.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-report-hub-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/report-hub/index.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'report-hub');

echo 'report_hub_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'report_hub_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$facilityId = (int) ($props['facilityId'] ?? 0);
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$today = (new DateTimeImmutable('today'))->format('Y-m-d');
$summaryUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('reports.hub_summary')
    . '&date=' . rawurlencode($today)
    . ($facilityId > 0 ? '&facility_id=' . $facilityId : '');

$summaryResp = smokeHttpRequest($summaryUrl, $cookieFile);
$summaryJson = json_decode($summaryResp['body'], true);
$hasSummary = ($summaryJson['success'] ?? false)
    && isset($summaryJson['data']['visits_started']);

echo 'reports.hub_summary HTTP ' . $summaryResp['code'] . PHP_EOL;
echo 'today_summary=' . ($hasSummary ? 'yes' : 'no') . PHP_EOL;

$catalogUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('reports.catalog')
    . '&lens=clinical'
    . ($facilityId > 0 ? '&facility_id=' . $facilityId : '');

$catalogResp = smokeHttpRequest($catalogUrl, $cookieFile);
$catalogJson = json_decode($catalogResp['body'], true);
$hasClinical = ($catalogJson['success'] ?? false)
    && is_array($catalogJson['data']['cards'] ?? null)
    && count($catalogJson['data']['cards']) > 0;

echo 'reports.catalog HTTP ' . $catalogResp['code'] . PHP_EOL;
echo 'clinical_catalog=' . ($hasClinical ? 'yes' : 'no') . PHP_EOL;

$ok = $summaryResp['code'] === 200
    && $catalogResp['code'] === 200
    && $hasSummary
    && $hasClinical;

exit($ok ? 0 : 1);
