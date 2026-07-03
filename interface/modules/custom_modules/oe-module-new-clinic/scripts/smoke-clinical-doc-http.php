<?php

/**
 * HTTP smoke: V1.1-DOC hub page + clinical_doc.catalog API.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-doc.php
 *
 * Usage:
 *   php .../smoke-clinical-doc-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-doc.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$fixtureScript = __DIR__ . DIRECTORY_SEPARATOR . 'v11-doc-smoke-fixture.php';
$fixtureRaw = shell_exec('"' . $phpBin . '" "' . $fixtureScript . '"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Failed to read clinical doc fixture JSON.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-clinical-doc-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/clinical-doc/index.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'clinical-doc');

echo 'clinical_doc_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'clinical_doc_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;
echo 'enable_clinical_doc_hub=' . (!empty($fixture['enable_clinical_doc_hub']) ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$facilityId = (int) ($props['facilityId'] ?? 0);
if ($ajaxUrl === '') {
    fwrite(STDERR, "Missing ajaxUrl in island props.\n");
    exit(1);
}

$catalogUrl = $ajaxUrl
    . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=' . rawurlencode('clinical_doc.catalog')
    . '&lens=consult'
    . ($facilityId > 0 ? '&facility_id=' . $facilityId : '');

$catalogResp = smokeHttpRequest($catalogUrl, $cookieFile);
$catalogJson = json_decode($catalogResp['body'], true);
$hasCatalog = ($catalogJson['success'] ?? false)
    && is_array($catalogJson['data']['cards'] ?? null)
    && count($catalogJson['data']['cards']) > 0;

echo 'clinical_doc.catalog HTTP ' . $catalogResp['code'] . PHP_EOL;
echo 'consult_catalog=' . ($hasCatalog ? 'yes' : 'no') . PHP_EOL;

$ok = $catalogResp['code'] === 200
    && $hasCatalog
    && !empty($fixture['enable_clinical_doc_hub']);

exit($ok ? 0 : 1);
