<?php

/**
 * HTTP smoke: V1.2-PHARM-RX doctor desk flag + formulary Rx catalog API.
 *
 * Prerequisite:
 *   php .../pilot-enable-v12-pharm-rx.php
 *
 * Usage:
 *   php .../smoke-formulary-rx-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v12-pharm-rx.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-pharm-rx-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/doctor.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'doctor-desk');
$rxOn = is_array($props) && !empty($props['formularyRxEnabled']);

echo 'doctor_desk HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'formulary_rx_enabled=' . ($rxOn ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null || !$rxOn) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$catalogUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('doctor.formulary_rx_catalog');

$catalogResp = smokeHttpRequest($catalogUrl, $cookieFile);
$catalogJson = json_decode($catalogResp['body'], true);
$hasCatalog = ($catalogJson['success'] ?? false)
    && !empty($catalogJson['data']['has_catalog'])
    && is_array($catalogJson['data']['drugs'])
    && count($catalogJson['data']['drugs']) > 0;

echo 'doctor.formulary_rx_catalog HTTP ' . $catalogResp['code'] . PHP_EOL;
echo 'catalog_has_drugs=' . ($hasCatalog ? 'yes' : 'no') . PHP_EOL;

exit($catalogResp['code'] === 200 && $hasCatalog ? 0 : 1);
