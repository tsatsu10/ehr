<?php

/**
 * Seed pilot desk users for New Clinic E2E / UAT (one user per desk ACL).
 *
 * Creates users if missing, sets password, grants Clinicians + desk group.
 * Idempotent — safe to re-run.
 *
 * Usage (from project root, Apache/MySQL running):
 *   php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
 *   php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php --password=MySecret1
 *   php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php --dry-run
 *
 * Env: NEW_CLINIC_PILOT_PASS (default test_pass)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$dryRun = in_array('--dry-run', $argv, true);
$password = getenv('NEW_CLINIC_PILOT_PASS') ?: 'test_pass';
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--password=')) {
        $password = substr($arg, strlen('--password='));
    }
}

if (strlen($password) < 8) {
    fwrite(STDERR, "Password must be at least 8 characters.\n");
    exit(1);
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Database\QueryUtils;

/** @var array<string, array{fname: string, lname: string, groups: list<string>}> */
$pilotUsers = [
    'reception_user' => [
        'fname' => 'Pilot',
        'lname' => 'Reception',
        'groups' => ['Clinicians', 'New Clinic Reception'],
    ],
    'nurse_user' => [
        'fname' => 'Pilot',
        'lname' => 'Nurse',
        'groups' => ['Clinicians', 'New Clinic Nurse'],
    ],
    'doctor_user' => [
        'fname' => 'Pilot',
        'lname' => 'Doctor',
        'groups' => ['Clinicians', 'New Clinic Doctor'],
    ],
    'lab_user' => [
        'fname' => 'Pilot',
        'lname' => 'Lab',
        'groups' => ['Clinicians', 'New Clinic Lab'],
    ],
    'pharmacy_user' => [
        'fname' => 'Pilot',
        'lname' => 'Pharmacy',
        'groups' => ['Clinicians', 'New Clinic Pharmacy'],
    ],
    'pharmacy_lead_user' => [
        'fname' => 'Pilot',
        'lname' => 'PharmLead',
        'groups' => ['Clinicians', 'New Clinic Pharmacy Lead'],
    ],
    'cashier_user' => [
        'fname' => 'Pilot',
        'lname' => 'Cashier',
        'groups' => ['Clinicians', 'New Clinic Cashier', 'New Clinic Cashier Lead'],
    ],
];

$aclSection = QueryUtils::querySingleRow(
    "SELECT section_value FROM gacl_aco WHERE section_value = 'new_clinic' LIMIT 1"
);
if (empty($aclSection)) {
    $aclSetupFlag = true;
    include __DIR__ . '/acl_setup.php';
    echo "Installed new_clinic ACL section and groups.\n";
}

$facilityRow = QueryUtils::querySingleRow(
    "SELECT id FROM facility WHERE service_location = 1 ORDER BY id LIMIT 1"
);
$facilityId = is_array($facilityRow) ? (int) ($facilityRow['id'] ?? 0) : 0;
if ($facilityId <= 0) {
    $facilityId = 3;
}

foreach ($pilotUsers as $username => $profile) {
    $existing = QueryUtils::querySingleRow(
        "SELECT id, username FROM users WHERE username = ?",
        [$username]
    );

    if (empty($existing)) {
        if ($dryRun) {
            echo "[dry-run] Would create user: {$username}\n";
        } else {
            $userId = createPilotUser(
                $username,
                $profile['fname'],
                $profile['lname'],
                $facilityId,
                $password
            );
            echo "Created user {$username} (id {$userId}).\n";
        }
    } else {
        echo "User already exists: {$username}\n";
        if (!$dryRun) {
            updatePilotPassword((int) $existing['id'], $username, $password);
        }
    }

    if ($dryRun) {
        echo "[dry-run] Would grant groups for {$username}: " . implode(', ', $profile['groups']) . "\n";
        continue;
    }

    foreach ($profile['groups'] as $group) {
        AclExtended::addUserAros($username, $group);
    }
    echo "Granted groups for {$username}: " . implode(', ', $profile['groups']) . "\n";

    ensureUserInDefaultGroup($username);
}

/**
 * OpenEMR login requires a row in `groups` (auth group), separate from phpGACL.
 */
function ensureUserInDefaultGroup(string $username, string $groupName = 'Default'): void
{
    $existing = QueryUtils::querySingleRow(
        "SELECT id FROM `groups` WHERE BINARY `user` = ?",
        [$username]
    );
    if (!empty($existing)) {
        return;
    }

    sqlStatement(
        "INSERT INTO `groups` SET name = ?, user = ?",
        [$groupName, $username]
    );
    echo "Added {$username} to OpenEMR group \"{$groupName}\".\n";
}

echo $dryRun ? "\nDry run complete.\n" : "\nPilot users ready. Default password: (see NEW_CLINIC_PILOT_PASS or --password)\n";

function createPilotUser(
    string $username,
    string $fname,
    string $lname,
    int $facilityId,
    string $password
): int {
    sqlInsert(
        "INSERT INTO users (username, password, authorized, active, fname, lname, facility_id) "
        . "VALUES (?, 'NoLongerUsed', 1, 1, ?, ?, ?)",
        [$username, $fname, $lname, $facilityId]
    );
    $row = QueryUtils::querySingleRow(
        "SELECT id FROM users WHERE username = ?",
        [$username]
    );
    $userId = (int) ($row['id'] ?? 0);
    if ($userId <= 0) {
        throw new RuntimeException("Failed to create user: {$username}");
    }

    updatePilotPassword($userId, $username, $password);

    return $userId;
}

function updatePilotPassword(int $userId, string $username, string $password): void
{
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false || $hash === '') {
        throw new RuntimeException('Unable to hash password');
    }

    $secure = QueryUtils::querySingleRow(
        "SELECT id FROM users_secure WHERE id = ? OR username = ?",
        [$userId, $username]
    );
    if (empty($secure)) {
        sqlStatement(
            "INSERT INTO users_secure (id, username, password, last_update_password) VALUES (?, ?, ?, NOW())",
            [$userId, $username, $hash]
        );
    } else {
        sqlStatement(
            "UPDATE users_secure SET password = ?, last_update_password = NOW() WHERE id = ?",
            [$hash, $userId]
        );
    }
}
