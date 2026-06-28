<?php

/**
 * CLI: apply New Clinic install.sql upgrades (idempotent).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$ignoreAuth = true;
require_once dirname(__DIR__, 5) . '/interface/globals.php';

use OpenEMR\Services\Utils\SQLUpgradeService;

$dir = dirname(__DIR__) . '/sql';
$sqlUpgradeService = new SQLUpgradeService();
$sqlUpgradeService->upgradeFromSqlFile('install.sql', $dir);

echo "New Clinic SQL upgrade complete.\n";
