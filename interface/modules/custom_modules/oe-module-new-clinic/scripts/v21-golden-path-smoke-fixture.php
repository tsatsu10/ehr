<?php

/**
 * Emit JSON readiness fixture for §21 golden path smoke / e2e.
 *
 * Prerequisite:
 *   php .../pilot-enable-v21-golden-path.php
 *   php .../acl/seed_pilot_users.php
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v21-golden-path-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/golden-path-rollout-lib.php';

$snapshot = goldenPathReadinessSnapshot();

echo json_encode($snapshot, JSON_THROW_ON_ERROR) . PHP_EOL;
