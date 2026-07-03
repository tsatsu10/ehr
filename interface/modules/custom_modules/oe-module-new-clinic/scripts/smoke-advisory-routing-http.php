<?php

/**
 * HTTP smoke: V1.1-RT doctor desk island exposes roster + advisory routing flags.
 *
 * Prerequisite:
 *   php .../pilot-enable-v11-rt.php
 *
 * Usage:
 *   php .../smoke-advisory-routing-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';

$phpBin = smokeResolvePhpBinary();
$enableScript = __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v11-rt.php';
passthru('"' . $phpBin . '" "' . $enableScript . '"');

$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-rt-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

$moduleUrl = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public/doctor.php';
$resp = smokeHttpRequest($moduleUrl, $cookieFile);

$props = smokeExtractIslandProps($resp['body'], 'doctor-desk');
$rosterOn = is_array($props) && !empty($props['doctorRosterEnabled']);
$routingOn = is_array($props) && !empty($props['advisoryRoutingEnabled']);
$multiDoctor = is_array($props) && !empty($props['multiDoctorFilters']);
$hasRosterMount = str_contains($resp['body'], 'data-island="doctor-desk"');

echo 'doctor_desk HTTP ' . $resp['code'] . PHP_EOL;
echo 'doctor_roster=' . ($rosterOn ? 'yes' : 'no') . PHP_EOL;
echo 'advisory_routing=' . ($routingOn ? 'yes' : 'no') . PHP_EOL;
echo 'multi_doctor_filters=' . ($multiDoctor ? 'yes' : 'no') . PHP_EOL;
echo 'island_mount=' . ($hasRosterMount ? 'yes' : 'no') . PHP_EOL;

$ok = $resp['code'] === 200 && $rosterOn && $routingOn && $multiDoctor && $hasRosterMount;

exit($ok ? 0 : 1);
