<?php

/**
 * HTTP smoke: Patient Registry page + cohort.presets / cohort.search (REG-1–REG-3).
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-reg.php
 *
 * Usage:
 *   php .../smoke-patient-registry-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';
$searchName = $argv[4] ?? 'Mavis';

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-reg-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/patient-registry.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'patient-registry');

echo 'registry_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'registry_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$csrfToken = (string) ($props['csrfToken'] ?? '');
if ($ajaxUrl === '' || $csrfToken === '') {
    fwrite(STDERR, "Missing ajaxUrl or csrfToken in island props.\n");
    exit(1);
}

$presetsUrl = $ajaxUrl . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=cohort.presets&csrf_token_form=' . rawurlencode($csrfToken);
$presetsResp = smokeHttpRequest($presetsUrl, $cookieFile);
$presetsJson = json_decode($presetsResp['body'], true);
$builtinCount = is_array($presetsJson['data']['builtins'] ?? null)
    ? count($presetsJson['data']['builtins'])
    : 0;

echo 'cohort.presets HTTP ' . $presetsResp['code'] . PHP_EOL;
echo 'cohort.presets builtins=' . $builtinCount . PHP_EOL;

$searchResp = smokeAjaxJsonPost($ajaxUrl, 'cohort.search', $cookieFile, [
    'page' => 1,
    'page_size' => 25,
    'filters' => ['name_contains' => $searchName],
    'csrf_token_form' => $csrfToken,
]);
$searchJson = json_decode($searchResp['body'], true);
$total = (int) ($searchJson['data']['total'] ?? 0);

echo 'cohort.search HTTP ' . $searchResp['code'] . PHP_EOL;
echo 'cohort.search total=' . $total . PHP_EOL;

$ok = $pageResp['code'] === 200
    && $props !== null
    && $presetsResp['code'] === 200
    && $builtinCount > 0
    && $searchResp['code'] === 200
    && $total > 0;

exit($ok ? 0 : 1);
