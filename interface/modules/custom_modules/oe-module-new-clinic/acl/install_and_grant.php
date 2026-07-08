<?php

/**
 * One-shot CLI: install New Clinic ACL and grant desk groups to a user.
 *
 * Usage (from project root):
 *   php interface/modules/custom_modules/oe-module-new-clinic/acl/install_and_grant.php Adminstrator
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
if ($username === '') {
    fwrite(STDERR, "Usage: php install_and_grant.php <username>\n");
    exit(1);
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\AclVersion;

$aclSection = QueryUtils::querySingleRow(
    "SELECT section_value FROM gacl_aco WHERE section_value = 'new_clinic' LIMIT 1"
);

if (empty($aclSection)) {
    $aclSetupFlag = true;
    include __DIR__ . '/acl_setup.php';
    echo "Installed new_clinic ACL section and groups.\n";

    QueryUtils::querySingleRow(
        "UPDATE modules SET acl_version = ? WHERE mod_directory = 'oe-module-new-clinic'",
        [AclVersion::VERSION]
    );
} else {
    echo "new_clinic ACL section already present — skipping acl_setup.\n";
}

$user = QueryUtils::querySingleRow(
    "SELECT username FROM users WHERE username = ? AND active = 1",
    [$username]
);
if (empty($user)) {
    fwrite(STDERR, "Active user not found: {$username}\n");
    exit(1);
}

$groups = [
    'Clinicians',
    'New Clinic Nurse',
    'New Clinic Reception',
    'New Clinic Doctor',
    'New Clinic Lab',
    'New Clinic Pharmacy',
    'New Clinic Cashier',
    'New Clinic Admin',
];

for ($i = 2; $i < $argc; $i++) {
    if (str_starts_with($argv[$i], '--groups=')) {
        $groups = array_filter(array_map('trim', explode(',', substr($argv[$i], 9))));
        break;
    }
}

foreach ($groups as $group) {
    AclExtended::addUserAros($username, $group);
    echo "Granted group: {$group}\n";
}

$current = AclExtended::aclGetGroupTitles($username) ?: [];
echo "\n{$username} is now in groups:\n";
foreach ($current as $title) {
    echo "  - {$title}\n";
}

echo "\nDone.\n";
