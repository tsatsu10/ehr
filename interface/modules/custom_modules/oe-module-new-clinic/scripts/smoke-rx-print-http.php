<?php

/**
 * HTTP smoke: V1.1-PRINT-RX prepare print API + rx-print.php page.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-print-rx.php
 *
 * Usage:
 *   php .../smoke-rx-print-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-print-rx.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$fixtureScript = __DIR__ . DIRECTORY_SEPARATOR . 'v11-print-rx-smoke-fixture.php';
$fixtureRaw = shell_exec('"' . $phpBin . '" "' . $fixtureScript . '"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Failed to read print Rx fixture JSON.\n");
    exit(1);
}

$prescriptionId = (int) ($fixture['latest_prescription_id'] ?? 0);
if ($prescriptionId <= 0) {
    $visitId = (int) ($fixture['visit_id'] ?? 0);
    if ($visitId > 0) {
        $seedScript = __DIR__ . DIRECTORY_SEPARATOR . 'v11-print-rx-seed-prescription.php';
        $seedRaw = shell_exec('"' . $phpBin . '" "' . $seedScript . '" ' . $visitId);
        $seed = json_decode(trim((string) $seedRaw), true);
        $prescriptionId = is_array($seed) ? (int) ($seed['prescription_id'] ?? 0) : 0;
    }
}

if ($prescriptionId <= 0) {
    fwrite(STDERR, "No active prescription found for rx-print HTTP smoke.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-rx-print-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$pageResp = smokeHttpRequest($moduleBase . '/doctor.php', $cookieFile);
$props = smokeExtractIslandProps($pageResp['body'], 'doctor-desk');

echo 'doctor_desk HTTP ' . $pageResp['code'] . PHP_EOL;
echo 'doctor_island=' . ($props !== null ? 'yes' : 'no') . PHP_EOL;
echo 'enable_rx_print=' . (!empty($fixture['enable_rx_print']) ? 'yes' : 'no') . PHP_EOL;
echo 'enable_pharm_ops=' . (!empty($fixture['enable_pharm_ops']) ? 'yes' : 'no') . PHP_EOL;

if ($pageResp['code'] !== 200 || $props === null) {
    exit(1);
}

$ajaxUrl = smokeResolveAbsoluteUrl($baseUrl, (string) ($props['ajaxUrl'] ?? ''));
$csrfToken = (string) ($props['csrfToken'] ?? '');
if ($ajaxUrl === '' || $csrfToken === '') {
    fwrite(STDERR, "Missing ajaxUrl or csrfToken in island props.\n");
    exit(1);
}

$printResp = smokeAjaxJsonPost($ajaxUrl, 'pharm_ops.rx_print_pdf', $cookieFile, [
    'prescription_id' => $prescriptionId,
    'csrf_token_form' => $csrfToken,
]);
$printJson = json_decode($printResp['body'], true);
$hasPrintUrl = ($printJson['success'] ?? false)
    && is_string($printJson['data']['print_url'] ?? null)
    && $printJson['data']['print_url'] !== '';

echo 'pharm_ops.rx_print_pdf HTTP ' . $printResp['code'] . PHP_EOL;
echo 'print_url=' . ($hasPrintUrl ? 'yes' : 'no') . PHP_EOL;

if ($printResp['code'] !== 200 || !$hasPrintUrl) {
    exit(1);
}

$printPageUrl = smokeResolveAbsoluteUrl($baseUrl, (string) $printJson['data']['print_url']);
$printPageResp = smokeHttpRequest($printPageUrl, $cookieFile);

echo 'rx_print_page HTTP ' . $printPageResp['code'] . PHP_EOL;
echo 'rx_print_html=' . (str_contains($printPageResp['body'], 'Paracetamol') ? 'yes' : 'partial') . PHP_EOL;

exit($printPageResp['code'] === 200 ? 0 : 1);
