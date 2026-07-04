<?php

/**
 * HTTP smoke: §21 golden path desk chain (role logins + island shells).
 *
 * Prerequisite:
 *   php .../pilot-enable-v21-golden-path.php
 *   php .../acl/seed_pilot_users.php
 *
 * Usage:
 *   php .../smoke-golden-path-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';
require_once __DIR__ . '/lib/golden-path-rollout-lib.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$pass = $argv[2] ?? 'test_pass';

$phpBin = smokeResolvePhpBinary();
passthru('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'pilot-enable-v21-golden-path.php"');
passthru('"' . $phpBin . '" "' . dirname(__DIR__) . DIRECTORY_SEPARATOR . 'acl/seed_pilot_users.php"');

$fixtureRaw = shell_exec('"' . $phpBin . '" "' . __DIR__ . DIRECTORY_SEPARATOR . 'v21-golden-path-smoke-fixture.php"');
$fixture = json_decode(trim((string) $fixtureRaw), true);
if (!is_array($fixture)) {
    fwrite(STDERR, "Invalid golden path fixture JSON.\n");
    exit(1);
}

$moduleBase = $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public';
$deskPages = [
    'reception_user' => $moduleBase . '/front-desk.php',
    'nurse_user' => $moduleBase . '/triage.php',
    'doctor_user' => $moduleBase . '/doctor.php',
    'lab_user' => $moduleBase . '/lab.php',
    'pharmacy_user' => $moduleBase . '/pharmacy.php',
    'cashier_user' => $moduleBase . '/cashier.php',
];

echo 'golden_path_ready=' . (!empty($fixture['golden_path_ready']) ? 'yes' : 'no') . PHP_EOL;

if (empty($fixture['golden_path_ready'])) {
    fwrite(STDERR, "Golden path not ready — check flags and pilot users.\n");
    exit(1);
}

$allOk = true;
foreach ($deskPages as $user => $url) {
    $cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-gp-' . $user . '.txt';
    @unlink($cookieFile);
    smokeLoginSession($baseUrl, $cookieFile, $user, $pass);
    $resp = smokeHttpRequest($url, $cookieFile);
    $hasShell = str_contains($resp['body'], 'oe-nc-t1') || str_contains($resp['body'], 'id="oe-nc-t1"');
    $ok = $resp['code'] === 200 && $hasShell;
    echo "{$user} HTTP {$resp['code']} shell=" . ($hasShell ? 'yes' : 'no') . PHP_EOL;
    if (!$ok) {
        $allOk = false;
    }
}

exit($allOk ? 0 : 1);
