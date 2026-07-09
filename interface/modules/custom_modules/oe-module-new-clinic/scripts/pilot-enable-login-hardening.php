<?php

/**
 * Login brute-force hardening — clinic-appropriate values for core's built-in
 * failed-login tracking (users_secure.login_fail_counter + ip_tracking).
 *
 * Run on every install/pilot enablement:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-login-hardening.php
 *
 * DESIGN (SEC-5): brutal to bots at the NETWORK layer, forgiving to humans at
 * the ACCOUNT layer. Clinic staff forget passwords often; a receptionist locked
 * out mid-queue is a clinic outage, so account lockout is loose and fast to
 * recover. Bots are stopped by tunnel-only access (default) + fail2ban/rate
 * limiting when publicly exposed — NOT by a punishing account lockout.
 *
 * Account-layer globals (Admin → Config → Security):
 *   password_max_failed_logins            10   (core default 20; forgiving but bounded)
 *   time_reset_password_max_failed_logins 300  (5-min auto-unlock — outage-avoidance)
 *   ip_max_failed_logins                  10
 *   ip_time_reset_password_max_failed_logins 60
 *
 * Password-policy globals — deliberate relaxations (NIST SP 800-63B):
 *   password_expiration_days   0   NO forced periodic expiration (rotation drives
 *                                  forgetting + sticky notes; hurts security)
 *   password_history           0   no reuse-history nag (length > complexity soup)
 *   password_compatibility     (left default) — length is the strength lever
 *
 * NOTE: core's IP counter is window-RESET, not a sliding rate limit — it clears
 * only when the newest failure is older than the window. ip_max_failed_logins=10
 * + a 60s window approximates "10 failures/min/IP".
 *
 * The related fork patch (flat 2s failure delay — NOT progressive, to avoid
 * self-DoS on a public VPS) lives in src/Common/Auth/AuthUtils.php — grep
 * NC-FORK-PATCH. LoginHardeningTest fails if an upstream rebase drops it.
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

$settings = [
    // Account layer — forgiving to humans (SEC-5).
    'password_max_failed_logins' => '10',
    'time_reset_password_max_failed_logins' => '300',
    'ip_max_failed_logins' => '10',
    'ip_time_reset_password_max_failed_logins' => '60',
    // Password policy — NIST 800-63B: no forced rotation, no reuse nag.
    'password_expiration_days' => '0',
    'password_history' => '0',
];

foreach ($settings as $name => $value) {
    $existing = sqlQuery('SELECT gl_value FROM `globals` WHERE gl_name = ? AND gl_index = 0', [$name]);
    if (empty($existing)) {
        sqlStatement(
            'INSERT INTO `globals` (gl_name, gl_index, gl_value) VALUES (?, 0, ?)',
            [$name, $value]
        );
        echo "Inserted {$name} = {$value}\n";
    } elseif ((string) $existing['gl_value'] !== $value) {
        sqlStatement(
            'UPDATE `globals` SET gl_value = ? WHERE gl_name = ? AND gl_index = 0',
            [$value, $name]
        );
        echo "Updated {$name}: {$existing['gl_value']} -> {$value}\n";
    } else {
        echo "OK {$name} = {$value}\n";
    }
}

echo "Login hardening globals applied. Verify: 10 wrong passwords locks the account for ~5 minutes;\n";
echo "an admin can unlock immediately from People & Access. No forced password expiration.\n";
