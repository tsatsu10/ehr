<?php

/**
 * One-shot HTTP smoke: deep-link pages return 200 and include restoreSession.
 *
 * Usage: php scripts/smoke-deeplinks.php [base_url] [username] [password] [pid]
 */

declare(strict_types=1);

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$user = $argv[2] ?? 'admin';
$pass = $argv[3] ?? 'pass';
$pid = (int) ($argv[4] ?? 4);

$cookieFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'oemr-smoke-cookies.txt';
@unlink($cookieFile);

function httpRequest(string $url, string $cookieFile, ?string $postBody = null): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR => $cookieFile,
        CURLOPT_COOKIEFILE => $cookieFile,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $postBody !== null ? ['Content-Type: application/x-www-form-urlencoded'] : [],
    ]);
    if ($postBody !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postBody);
    }
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'code' => $code,
        'body' => is_string($body) ? $body : '',
        'error' => $error,
    ];
}

$loginPage = httpRequest($baseUrl . '/interface/login/login.php?site=default', $cookieFile);
if ($loginPage['code'] !== 200) {
    fwrite(STDERR, "Login page failed HTTP {$loginPage['code']}\n");
    exit(1);
}

$languageChoice = '1';
if (preg_match('/name="languageChoice"\s+value="([^"]+)"/', $loginPage['body'], $langMatch)) {
    $languageChoice = $langMatch[1];
}

$post = http_build_query([
    'authUser' => $user,
    'clearPass' => $pass,
    'new_login_session_management' => '1',
    'languageChoice' => $languageChoice,
    'authProvider' => 'Default',
]);

$loginResult = httpRequest(
    $baseUrl . '/interface/main/main_screen.php?auth=login&site=default',
    $cookieFile,
    $post
);
$mainCheck = httpRequest($baseUrl . '/interface/main/tabs/main.php', $cookieFile);
if ($mainCheck['code'] !== 200 || stripos($mainCheck['body'], 'login') !== false && str_contains($mainCheck['body'], 'authUser')) {
    fwrite(STDERR, "Login may have failed — main.php still shows login form. Try: php smoke-deeplinks.php [url] [user] [pass] [pid]\n");
}

// Bind patient context for chart pages.
httpRequest($baseUrl . '/interface/patient_file/summary/demographics.php?set_pid=' . $pid, $cookieFile);

$paths = [
    'encounter_top' => '/interface/patient_file/encounter/encounter_top.php',
    'labdata' => '/interface/patient_file/summary/labdata.php?set_pid=' . $pid,
    'prescription_edit' => '/controller.php?prescription&edit&id=0&pid=' . $pid,
    'patient_report' => '/interface/patient_file/report/patient_report.php',
    'history_full' => '/interface/patient_file/history/history_full.php',
    'add_transaction' => '/interface/patient_file/transaction/add_transaction.php',
    'clinical_form_bridge' => '/interface/modules/custom_modules/oe-module-new-clinic/public/clinical-form-bridge.php?pid='
        . $pid . '&encounter=1&formname=procedure_order&return=' . urlencode($baseUrl . '/lab.php'),
];

$passed = 0;
$failed = 0;

echo str_pad('URL', 22) . str_pad('HTTP', 6) . str_pad('restoreSession', 16) . "notes\n";
echo str_repeat('-', 70) . "\n";

foreach ($paths as $label => $path) {
    $resp = httpRequest($baseUrl . $path, $cookieFile);
    $hasRestore = str_contains($resp['body'], 'function restoreSession')
        || str_contains($resp['body'], 'oemr_session_name');
    $ok = $resp['code'] === 200 && $hasRestore;
    if ($ok) {
        $passed++;
    } else {
        $failed++;
    }
    $notes = [];
    if ($resp['code'] !== 200) {
        $notes[] = 'bad status';
    }
    if (!$hasRestore) {
        $notes[] = 'no restoreSession';
    }
    if ($resp['error'] !== '') {
        $notes[] = $resp['error'];
    }
    echo str_pad($label, 22)
        . str_pad((string) $resp['code'], 6)
        . str_pad($hasRestore ? 'yes' : 'NO', 16)
        . implode(', ', $notes) . "\n";
}

echo str_repeat('-', 70) . "\n";
echo "Passed: {$passed}/" . count($paths) . "\n";

exit($failed > 0 ? 1 : 0);
