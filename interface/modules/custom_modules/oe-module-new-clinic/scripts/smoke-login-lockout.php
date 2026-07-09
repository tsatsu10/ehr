<?php

/**
 * Login lockout smoke — brute-force hardening end-to-end check.
 *
 * Creates a throwaway user, then verifies:
 *   1. 5 wrong passwords -> account locked (login_fail_counter >= 5)
 *   2. CORRECT password during lockout -> still rejected, same generic
 *      "Invalid username or password" page (no lockout leak)
 *   3. Admin unlock (resetLoginFailedCounter — same call the People & Access
 *      hub uses) -> correct password logs in
 *
 * NOTE: takes ~1 minute by design — the NC-FORK-PATCH progressive delay
 * (min(2^n, 30)s per failure) is part of what this proves.
 *
 * Usage: php .../scripts/smoke-login-lockout.php [baseUrl]
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/smoke-http.php';

use OpenEMR\Common\Acl\AclExtended;

use OpenEMR\Common\Auth\AuthUtils;

$baseUrl = rtrim($argv[1] ?? 'http://localhost/openemr', '/');
$cookieFile = tempnam(sys_get_temp_dir(), 'nc_lockout_smoke');
$username = 'lockout_smoke_' . substr(uniqid(), -6);
$password = 'Sm0ke-' . substr(uniqid(), -8) . '!';
$failures = 0;

function smokeCheck(string $label, bool $ok): void
{
    global $failures;
    echo ($ok ? '[PASS] ' : '[FAIL] ') . $label . "\n";
    if (!$ok) {
        $failures++;
    }
}

function attemptLogin(string $baseUrl, string $user, string $pass): string
{
    $cookie = tempnam(sys_get_temp_dir(), 'nc_lockout_try');
    smokeLoginSession($baseUrl, $cookie, $user, $pass);
    // After a failed login core redirects back to login.php with the failure flag set.
    $page = smokeHttpRequest($baseUrl . '/interface/login/login.php?site=default', $cookie);
    @unlink($cookie);
    return $page['body'];
}

$maxFails = (int) sqlQuery("SELECT gl_value FROM globals WHERE gl_name = 'password_max_failed_logins'")['gl_value'];
smokeCheck("password_max_failed_logins is 5 (run pilot-enable-login-hardening.php first)", $maxFails === 5);

// --- fixture user ---
sqlStatement(
    "INSERT INTO users (username, fname, lname, active, authorized) VALUES (?, 'Lockout', 'Smoke', 1, 0)",
    [$username]
);
$userId = (int) sqlQuery('SELECT id FROM users WHERE username = ?', [$username])['id'];
// password_hash() directly: core verifies via password_verify(), and AuthHash
// needs session-configured algo globals that are absent under CLI.
sqlStatement(
    'INSERT INTO users_secure (id, username, password, last_update_password) VALUES (?, ?, ?, NOW())',
    [$userId, $username, password_hash($password, PASSWORD_BCRYPT)]
);
// Group memberships so the login flow reaches the password check (the per-user
// counter only increments there): legacy groups table + a phpGACL ARO group.
sqlStatement("INSERT INTO `groups` (name, user) VALUES ('Default', ?)", [$username]);
// 'Clinicians' lets the login flow reach the password check; the New Clinic
// group grants a module ACL so the authenticated ajax health probe passes.
AclExtended::addUserAros($username, 'Clinicians');
AclExtended::addUserAros($username, 'New Clinic Reception');
// Start from a clean IP counter so this smoke's own failures don't trip the IP block.
sqlStatement('UPDATE ip_tracking SET ip_login_fail_counter = 0');

try {
    // --- 1: five wrong passwords lock the account ---
    $start = time();
    for ($i = 1; $i <= 5; $i++) {
        attemptLogin($baseUrl, $username, 'definitely-wrong-' . $i);
    }
    $elapsed = time() - $start;
    $counter = (int) sqlQuery(
        'SELECT login_fail_counter FROM users_secure WHERE BINARY username = ?',
        [$username]
    )['login_fail_counter'];
    smokeCheck("5 wrong passwords -> login_fail_counter >= 5 (got {$counter})", $counter >= 5);
    smokeCheck("progressive delay applied (elapsed {$elapsed}s >= 25s for 2+4+8+16 between attempts)", $elapsed >= 25);

    // --- 2: correct password during lockout still fails, generically ---
    $body = attemptLogin($baseUrl, $username, $password);
    $stillLocked = (int) sqlQuery(
        'SELECT login_fail_counter FROM users_secure WHERE BINARY username = ?',
        [$username]
    )['login_fail_counter'] > 0;
    smokeCheck('correct password during lockout is rejected', $stillLocked && str_contains($body, 'Invalid username or password'));
    smokeCheck('lockout message is the generic one (no "locked"/"blocked" leak)', stripos($body, 'locked') === false && stripos($body, 'blocked') === false);

    // --- 3: admin unlock, then correct password works ---
    AuthUtils::resetLoginFailedCounter($username);
    sqlStatement("UPDATE ip_tracking SET ip_login_fail_counter = 0"); // clear IP counter polluted by this smoke
    smokeLoginSession($baseUrl, $cookieFile, $username, $password);
    // Positive auth proof: the module ajax endpoint 401s without a session.
    $health = smokeHttpRequest(
        $baseUrl . '/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php?action=health',
        $cookieFile
    );
    $loggedIn = (int) $health['code'] === 200 && str_contains($health['body'], '"success":true');
    smokeCheck(
        'after admin unlock the correct password logs in (ajax health authenticated)'
        . ($loggedIn ? '' : ' [http ' . $health['code'] . ': ' . substr(preg_replace('/\s+/', ' ', $health['body']), 0, 120) . ']'),
        $loggedIn
    );
} finally {
    sqlStatement('DELETE FROM users_secure WHERE BINARY username = ?', [$username]);
    sqlStatement('DELETE FROM users WHERE username = ?', [$username]);
    sqlStatement('DELETE FROM `groups` WHERE user = ?', [$username]);
    @unlink($cookieFile);
}

echo $failures === 0 ? "RESULT: PASS\n" : "RESULT: FAIL ({$failures})\n";
exit($failures === 0 ? 0 : 1);
