<?php

/**
 * HTTP smoke: People & access hub + staff list API.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-admin-people-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-people-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/admin.php?tab=people&sub=staff', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'admin-hub');

echo 'admin_people_page HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'admin_hub_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$resetPageResp = smokeHttpRequest($moduleBase . '/admin.php?tab=people&sub=staff&view=reset-password', $cookieFile);
echo 'reset_password_view HTTP ' . $resetPageResp['code'] . PHP_EOL;
$resetViewOk = $resetPageResp['code'] === 200
    && str_contains($resetPageResp['body'], 'data-island="admin-hub"');

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$csrfToken = (string) ($props['csrfToken'] ?? '');
$listUrl = $ajaxUrl . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=admin.staff.list&page=1&page_size=5&status=active'
    . '&csrf_token_form=' . rawurlencode($csrfToken);
$listResp = smokeHttpRequest($listUrl, $cookieFile);
$listJson = json_decode($listResp['body'], true);
$total = (int) ($listJson['data']['total'] ?? -1);

echo 'admin.staff.list HTTP ' . $listResp['code'] . PHP_EOL;
echo 'admin.staff.list total=' . $total . PHP_EOL;

$templatesResp = smokeHttpRequest(
    $ajaxUrl . (str_contains($ajaxUrl, '?') ? '&' : '?')
    . 'action=admin.roles.templates&csrf_token_form=' . rawurlencode($csrfToken),
    $cookieFile
);
$templatesJson = json_decode($templatesResp['body'], true);
$templateCount = is_array($templatesJson['data']['templates'] ?? null)
    ? count($templatesJson['data']['templates'])
    : 0;
echo 'admin.roles.templates HTTP ' . $templatesResp['code'] . PHP_EOL;
echo 'admin.roles.templates count=' . $templateCount . PHP_EOL;

$ok = $resetViewOk
    && $listResp['code'] === 200
    && $total >= 0
    && $templatesResp['code'] === 200
    && $templateCount >= 7;

exit($ok ? 0 : 1);
