<?php

/**
 * One-shot ACL upgrade for New Clinic chart-depth permissions.
 *
 * Usage (from project root):
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/run_acl_upgrade.php
 */

$ignoreAuth = true;
$_GET['site'] = 'default';

require_once dirname(__DIR__) . '/public/bootstrap.php';

$aclSetupFlag = true;
include dirname(__DIR__) . '/acl/acl_setup.php';

use OpenEMR\Common\Database\QueryUtils;

QueryUtils::querySingleRow(
    "UPDATE modules SET acl_version = '0.2.0' WHERE mod_directory = 'oe-module-new-clinic'"
);

echo "New Clinic ACL upgrade complete (acl_version 0.2.0).\n";
