<?php

/**
 * HTTP smoke: V1.1-ADMIN hub page + admin.config + health status APIs.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-admin.php
 *
 * Usage:
 *   php .../smoke-admin-hub-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-admin.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-admin-hub-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/admin.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'admin-hub');

echo 'admin_hub_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'admin_hub_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$facilityId = (int) ($props['clinicFacilityId'] ?? 0);
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$configUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('admin.config')
    . '&scope=facility'
    . ($facilityId > 0 ? '&facility_id=' . $facilityId : '');

$configResp = smokeHttpRequest($configUrl, $cookieFile);
$configJson = json_decode($configResp['body'], true);
$hubOn = ($configJson['success'] ?? false)
    && !empty($configJson['data']['settings']['enable_admin_hub']);
$hasRunbooks = ($configJson['success'] ?? false)
    && is_array($configJson['data']['runbooks']['cards'] ?? null)
    && count($configJson['data']['runbooks']['cards']) > 0;
$hasFormsCatalog = ($configJson['success'] ?? false)
    && is_array($configJson['data']['forms_catalog']['items'] ?? null)
    && count($configJson['data']['forms_catalog']['items']) > 0;

echo 'admin.config HTTP ' . $configResp['code'] . PHP_EOL;
echo 'enable_admin_hub=' . ($hubOn ? 'yes' : 'no') . PHP_EOL;
echo 'runbooks=' . ($hasRunbooks ? 'yes' : 'no') . PHP_EOL;
echo 'forms_catalog=' . ($hasFormsCatalog ? 'yes' : 'no') . PHP_EOL;

$healthUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('admin.health_status')
    . '&scope=facility'
    . ($facilityId > 0 ? '&facility_id=' . $facilityId : '');

$healthResp = smokeHttpRequest($healthUrl, $cookieFile);
$healthJson = json_decode($healthResp['body'], true);
$hasHealth = ($healthJson['success'] ?? false)
    && is_array($healthJson['data']['system_health']['chips'] ?? null)
    && count($healthJson['data']['system_health']['chips']) > 0;

echo 'admin.health_status HTTP ' . $healthResp['code'] . PHP_EOL;
echo 'system_health_chips=' . ($hasHealth ? 'yes' : 'no') . PHP_EOL;

$ok = $configResp['code'] === 200
    && $healthResp['code'] === 200
    && $hubOn
    && $hasRunbooks
    && $hasFormsCatalog
    && $hasHealth;

exit($ok ? 0 : 1);
