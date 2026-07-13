<?php

/**
 * Scheduled encrypted backup runner (GAP-C C6 follow-up).
 *
 * Runs a native encrypted backup IF it is due per `backup_frequency_days` and
 * `enable_native_backup` is on. Idempotent: safe to run more often than the
 * frequency — it no-ops until a backup is actually due.
 *
 * Wire into an OS scheduler:
 *   Linux cron (daily 02:00):
 *     0 2 * * * php /path/to/oe-module-new-clinic/scripts/backup-scheduled.php default
 *   Windows Task Scheduler (daily):
 *     Program:  C:\xampp\php\php.exe
 *     Args:     C:\xampp\htdocs\openemr\interface\modules\custom_modules\oe-module-new-clinic\scripts\backup-scheduled.php default
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = $argv[1] ?? 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\AdminBackupService;

try {
    // Facility 0 → the service resolves the clinic's service-location facility.
    $svc = new AdminBackupService();
    $result = $svc->runScheduledBackup(0);
    // Separate site-files backup (design §3b) — its own due-check + run row.
    $filesResult = $svc->runScheduledFilesBackup(0);
    fwrite(STDOUT, json_encode(['db' => $result, 'files' => $filesResult]) . "\n");
    exit((($result['status'] ?? '') === 'failed' || ($filesResult['status'] ?? '') === 'failed') ? 1 : 0);
} catch (\Throwable $e) {
    fwrite(STDERR, 'scheduled backup error: ' . $e->getMessage() . "\n");
    exit(1);
}
