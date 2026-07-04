<?php

/**
 * Enable §21 golden path pilot stack (full clinic desks + hubs + ACL prep).
 *
 * Chains pilot-rollout product flags with golden-path E2E prep (desk release, skip ACLs, bill ops).
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v21-golden-path.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/golden-path-rollout-lib.php';

goldenPathRunRollout();

$snapshot = goldenPathReadinessSnapshot();
echo "Set §21 golden path flags for facility {$snapshot['facility_id']}.\n";
echo '  golden_path_ready=' . (!empty($snapshot['golden_path_ready']) ? 'yes' : 'no') . "\n";
echo '  visit_type_id=' . (int) ($snapshot['visit_type_id'] ?? 0) . "\n";

if (!empty($snapshot['pilot_users_missing'])) {
    echo '  missing_users=' . implode(',', $snapshot['pilot_users_missing']) . "\n";
    echo "Run acl/seed_pilot_users.php\n";
}

echo "E2E: tests/e2e/new-clinic/specs/golden-path.spec.js\n";
echo "Map: Documentation/NewClinic/NEW_CLINIC_V1_SECTION21_E2E_MAP.md\n";
