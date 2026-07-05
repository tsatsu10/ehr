<?php

/**
 * HTTP smoke: History editor wrap injects T1 shell when flag ON.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/smoke-history-editor-wrap-http.php
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/smoke-http.php';

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'Adminstrator';
$pass = $argv[3] ?? 'passpass1';
$pid = (int) ($argv[4] ?? 4);

$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-hist-wrap-cookies.txt';
@unlink($cookieFile);

smokeLoginSession($baseUrl, $cookieFile, $user, $pass);

smokeHttpRequest($baseUrl . '/interface/patient_file/summary/demographics.php?set_pid=' . $pid, $cookieFile);

$respA = smokeHttpRequest(
    $baseUrl . '/interface/patient_file/history/history_full.php?return=clinical-background',
    $cookieFile
);

$cookieFileB = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-hist-wrap-cookies-b.txt';
@unlink($cookieFileB);
smokeHttpRequest($baseUrl . '/interface/login/login.php?site=default', $cookieFileB);
$post = http_build_query([
    'authUser' => $user,
    'clearPass' => $pass,
    'new_login_session_management' => '1',
    'languageChoice' => '1',
    'authProvider' => 'Default',
]);
smokeHttpRequest($baseUrl . '/interface/main/main_screen.php?auth=login&site=default', $cookieFileB, $post);

$respB = smokeHttpRequest(
    $baseUrl . '/interface/patient_file/history/history_full.php?set_pid=' . $pid . '&return=clinical-background',
    $cookieFileB
);

function checkWrap(array $resp, string $label): bool
{
    $hasWrap = str_contains($resp['body'], 'id="nc-history-editor-wrap"');
    $hasBack = str_contains($resp['body'], 'Back to chart') || str_contains($resp['body'], 'Back To Chart');

    echo $label . ' HTTP ' . $resp['code'] . PHP_EOL;
    echo $label . ' wrap=' . ($hasWrap ? 'yes' : 'no') . PHP_EOL;
    echo $label . ' back=' . ($hasBack ? 'yes' : 'no') . PHP_EOL;

    return $resp['code'] === 200 && $hasWrap && $hasBack;
}

$okA = checkWrap($respA, 'demographics');
$okB = checkWrap($respB, 'set_pid');

exit($okA && $okB ? 0 : 1);
