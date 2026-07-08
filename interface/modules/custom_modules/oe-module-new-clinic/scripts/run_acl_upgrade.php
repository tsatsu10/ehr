<?php

/**
 * @deprecated Use bin/install_acl.php (idempotent; AUDIT-11).
 *
 * One-shot ACL upgrade for New Clinic chart-depth permissions.
 *
 * Usage (from project root):
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/run_acl_upgrade.php
 */

$ignoreAuth = true;
$_GET['site'] = 'default';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';

require_once dirname(__DIR__) . '/public/bootstrap.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\AclVersion;

$row = QueryUtils::querySingleRow(
    "SELECT acl_version FROM modules WHERE mod_directory = 'oe-module-new-clinic' LIMIT 1"
);
$installedVersion = (string) ($row['acl_version'] ?? '');
if (AclVersion::isSatisfiedBy($installedVersion)) {
    echo 'New Clinic ACL already at ' . AclVersion::VERSION . " (installed: {$installedVersion})\n";
    exit(0);
}

$aclSetupFlag = true;
include dirname(__DIR__) . '/acl/acl_setup.php';

QueryUtils::querySingleRow(
    "UPDATE modules SET acl_version = ? WHERE mod_directory = 'oe-module-new-clinic'",
    [AclVersion::VERSION]
);

echo 'New Clinic ACL upgrade complete (acl_version ' . AclVersion::VERSION . ").\n";
