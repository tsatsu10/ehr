<?php

/**
 * Seed message + reminder fixtures for Communications Hub E2E smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-comms-fixture-seed.php
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-comms-fixture-seed.php --cleanup
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/comms-fixture-lib.php';

use OpenEMR\Common\Database\QueryUtils;

$cleanup = in_array('--cleanup', $argv ?? [], true);
if ($cleanup) {
    commsCleanupFixtures();
    echo "Communications fixtures removed.\n";
    exit(0);
}

$adminUsername = getenv('TEST_USERNAME_ADMIN') ?: 'Adminstrator';
$doctor = QueryUtils::querySingleRow('SELECT id, username FROM users WHERE username = ?', ['doctor_user']);
$admin = QueryUtils::querySingleRow('SELECT id, username FROM users WHERE username = ?', [$adminUsername]);

$senderUserId = (int) ($doctor['id'] ?? 0);
$senderUsername = trim((string) ($doctor['username'] ?? ''));
$recipientUserId = (int) ($admin['id'] ?? 0);
$recipientUsername = trim((string) ($admin['username'] ?? ''));

if ($senderUserId <= 0 || $senderUsername === '') {
    fwrite(STDERR, "doctor_user not found — run seed_pilot_users.php\n");
    exit(1);
}
if ($recipientUserId <= 0 || $recipientUsername === '') {
    fwrite(STDERR, "Admin user {$adminUsername} not found — abort.\n");
    exit(1);
}

$seeded = commsSeedFixtures($senderUsername, $senderUserId, $recipientUsername, $recipientUserId);
echo "Message fixture id={$seeded['message_id']} assignee={$recipientUsername}\n";
echo "Reminder fixture id={$seeded['reminder_id']} recipient={$recipientUsername}\n";
echo "Communications fixture ready.\n";
