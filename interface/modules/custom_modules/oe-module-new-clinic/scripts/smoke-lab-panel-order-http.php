<?php

/**
 * HTTP smoke: V1.1-LAB-ORD doctor desk flag + lab panel catalog API.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-lab-ord.php
 *
 * Usage:
 *   php .../smoke-lab-panel-order-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-lab-ord.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-lab-ord-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/doctor.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'doctor-desk');
$labOrdOn = is_array($props) && !empty($props['labPanelOrderEnabled']);

echo 'doctor_desk HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'lab_panel_order_enabled=' . ($labOrdOn ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null || !$labOrdOn) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$catalogUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('doctor.lab_panel_catalog');

$catalogResp = smokeHttpRequest($catalogUrl, $cookieFile);
$catalogJson = json_decode($catalogResp['body'], true);
$hasCatalog = ($catalogJson['success'] ?? false)
    && !empty($catalogJson['data']['has_catalog'])
    && is_array($catalogJson['data']['tests'])
    && count($catalogJson['data']['tests']) > 0;

echo 'doctor.lab_panel_catalog HTTP ' . $catalogResp['code'] . PHP_EOL;
echo 'catalog_has_tests=' . ($hasCatalog ? 'yes' : 'no') . PHP_EOL;

exit($catalogResp['code'] === 200 && $hasCatalog ? 0 : 1);
