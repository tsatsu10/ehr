<?php

/**
 * Emit JSON fixture for V1.1-COM E2E / HTTP smoke.
 *
 * Prerequisite:
 *   php .../v11-comms-fixture-seed.php
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/v11-comms-smoke-fixture.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/comms-fixture-lib.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

$facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
$config = new ClinicConfigService();
// The Communications Hub is always on — the fixture key is kept for spec compatibility.
$hubEnabled = true;
$reactEnabled = $config->get('enable_react_communications_hub', '1', $facilityId) === '1';

$adminUsername = getenv('TEST_USERNAME_ADMIN') ?: 'Adminstrator';
$adminRow = sqlQuery('SELECT id FROM users WHERE username = ? LIMIT 1', [$adminUsername]);
$recipientUserId = (int) ($adminRow['id'] ?? 0);

$message = $recipientUserId > 0 ? commsFindActiveMessage($adminUsername) : null;
$reminder = $recipientUserId > 0 ? commsFindOpenReminder($recipientUserId) : null;

echo json_encode([
    'facility_id' => $facilityId,
    'communications_hub_enable' => $hubEnabled,
    'enable_react_communications_hub' => $reactEnabled,
    'assignee_username' => $adminUsername,
    'message_id' => is_array($message) ? (int) ($message['id'] ?? 0) : 0,
    'message_marker' => NC_COMMS_MSG_MARKER,
    'message_type' => NC_COMMS_MSG_TYPE,
    'reminder_id' => is_array($reminder) ? (int) ($reminder['dr_id'] ?? 0) : 0,
    'reminder_marker' => NC_COMMS_REM_MARKER,
], JSON_THROW_ON_ERROR) . PHP_EOL;
