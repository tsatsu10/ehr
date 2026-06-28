<?php

/**
 * CLI: install or upgrade New Clinic GACL (local dev).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/bin/install_acl.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$ignoreAuth = true;
require_once dirname(__DIR__, 5) . '/interface/globals.php';

use OpenEMR\Common\Database\QueryUtils;

$aclSetupFlag = true;
include dirname(__DIR__) . '/acl/acl_setup.php';

QueryUtils::sqlStatementThrowException(
    "UPDATE modules SET acl_version = ? WHERE mod_directory = 'oe-module-new-clinic'",
    ['0.2.3']
);

echo "New Clinic ACL installed (0.2.3)\n";
