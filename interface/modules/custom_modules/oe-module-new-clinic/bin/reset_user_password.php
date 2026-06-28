<?php

/**
 * CLI: reset an OpenEMR user password in users_secure (local dev recovery).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/bin/reset_user_password.php <username> <new_password>
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$username = $argv[1] ?? '';
$newPassword = $argv[2] ?? '';

if ($username === '' || $newPassword === '') {
    fwrite(STDERR, "Usage: php reset_user_password.php <username> <new_password>\n");
    exit(1);
}

$_GET['site'] = 'default';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$ignoreAuth = true;
require_once dirname(__DIR__, 5) . '/interface/globals.php';

use OpenEMR\Common\Auth\AuthHash;
use OpenEMR\Common\Database\QueryUtils;

$minLen = (int) ($GLOBALS['gbl_minimum_password_length'] ?? 0);
if ($minLen > 0 && strlen($newPassword) < $minLen) {
    fwrite(STDERR, "Password must be at least {$minLen} characters.\n");
    exit(1);
}

$row = QueryUtils::querySingleRow('SELECT id FROM users_secure WHERE username = ?', [$username]);
if (!is_array($row) || empty($row['id'])) {
    fwrite(STDERR, "User not found in users_secure: {$username}\n");
    exit(1);
}

$hash = (new AuthHash())->passwordHash($newPassword);
QueryUtils::sqlStatementThrowException(
    'UPDATE users_secure SET password = ?, login_fail_counter = 0, total_login_fail_counter = 0, last_login_fail = NULL, auto_block_emailed = 0, last_update_password = NOW() WHERE id = ?',
    [$hash, (int) $row['id']]
);
QueryUtils::sqlStatementThrowException('UPDATE ip_tracking SET ip_login_fail_counter = 0, total_ip_login_fail_counter = 0');

$stored = QueryUtils::querySingleRow('SELECT password FROM users_secure WHERE id = ?', [(int) $row['id']]);
$verified = AuthHash::passwordVerify($newPassword, (string) ($stored['password'] ?? ''));

echo $verified ? "Password updated for {$username}\n" : "Update failed verification\n";
exit($verified ? 0 : 1);
