<?php

/**
 * Count new_visit_notify_log rows for E2E assertions (§6.5.4 debounce).
 *
 * Usage:
 *   php .../v12-doctor-notify-log-count.php --visit_id=123 --recipient_user_id=7
 *   php .../v12-doctor-notify-log-count.php --visit_id=123 --recipient_username=doctor_user
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\DoctorReadyNotifyService;

$visitId = 0;
$recipientUserId = 0;
$recipientUsername = '';

foreach (array_slice($argv, 1) as $arg) {
    if (str_starts_with($arg, '--visit_id=')) {
        $visitId = (int) substr($arg, strlen('--visit_id='));
    } elseif (str_starts_with($arg, '--recipient_user_id=')) {
        $recipientUserId = (int) substr($arg, strlen('--recipient_user_id='));
    } elseif (str_starts_with($arg, '--recipient_username=')) {
        $recipientUsername = substr($arg, strlen('--recipient_username='));
    }
}

if ($recipientUserId <= 0 && $recipientUsername !== '') {
    $row = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ?', [$recipientUsername]);
    $recipientUserId = (int) ($row['id'] ?? 0);
}

if ($visitId <= 0 || $recipientUserId <= 0) {
    fwrite(STDERR, "Usage: --visit_id=N and (--recipient_user_id=N or --recipient_username=name)\n");
    exit(1);
}

$row = QueryUtils::querySingleRow(
    "SELECT COUNT(*) AS cnt
     FROM new_visit_notify_log
     WHERE visit_id = ?
       AND recipient_user_id = ?
       AND channel = ?",
    [$visitId, $recipientUserId, DoctorReadyNotifyService::CHANNEL_IN_APP]
);

echo json_encode([
    'visit_id' => $visitId,
    'recipient_user_id' => $recipientUserId,
    'count' => (int) ($row['cnt'] ?? 0),
], JSON_THROW_ON_ERROR) . PHP_EOL;
