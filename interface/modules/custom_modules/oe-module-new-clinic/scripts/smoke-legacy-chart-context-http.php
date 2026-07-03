<?php

/**
 * HTTP smoke: legacy chart context overlay (CTX-1 / CTX-2).
 *
 * Prerequisite:
 *   php .../pilot-enable-legacy-chart-context.php
 *
 * Usage:
 *   php .../smoke-legacy-chart-context-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';
$pid = (int) ($argv[4] ?? 4);

$phpBin = smokeResolvePhpBinary();
$scriptsDir = __DIR__;

function runOverlayToggle(string $phpBin, string $scriptsDir, string $overlayFlag): void
{
    $script = $scriptsDir . DIRECTORY_SEPARATOR . 'pilot-set-legacy-chart-overlay.php';
    passthru('"' . $phpBin . '" "' . $script . '" ' . $overlayFlag);
}

$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-ctx-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

runOverlayToggle($phpBin, $scriptsDir, '1');

$respOn = smokeHttpRequest(
    $baseUrl . '/interface/patient_file/summary/demographics.php?set_pid=' . $pid,
    $cookieFile
);

$hasStripOn = str_contains($respOn['body'], 'id="legacy-patient-context-strip"');
$hasMrnOn = str_contains($respOn['body'], 'MRN');

echo 'overlay_on HTTP ' . $respOn['code'] . PHP_EOL;
echo 'overlay_on strip=' . ($hasStripOn ? 'yes' : 'no') . PHP_EOL;
echo 'overlay_on mrn=' . ($hasMrnOn ? 'yes' : 'no') . PHP_EOL;

runOverlayToggle($phpBin, $scriptsDir, '0');

$respOff = smokeHttpRequest(
    $baseUrl . '/interface/patient_file/summary/demographics.php?set_pid=' . $pid,
    $cookieFile
);

$hasStripOff = str_contains($respOff['body'], 'id="legacy-patient-context-strip"');

echo 'overlay_off HTTP ' . $respOff['code'] . PHP_EOL;
echo 'overlay_off strip=' . ($hasStripOff ? 'yes' : 'no') . PHP_EOL;

runOverlayToggle($phpBin, $scriptsDir, '1');

$okOn = $respOn['code'] === 200 && $hasStripOn && $hasMrnOn;
$okOff = $respOff['code'] === 200 && !$hasStripOff;

exit($okOn && $okOff ? 0 : 1);
