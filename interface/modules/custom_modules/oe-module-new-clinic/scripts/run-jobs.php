<?php

/**
 * New Clinic background job worker (SCALE-2.1).
 *
 * Claims and completes queued export jobs (report_hub_export_run) OUTSIDE the web
 * request, so a heavy CSV build no longer runs inside a status-poll HTTP request.
 * Claims are atomic (a unique token per claim), so several workers never double-run
 * the same job; a job is retried up to 3 times, then marked failed.
 *
 * BACKUP-H1(a): this is now ALSO the primary way scheduled backups actually run.
 * The tab-shell heartbeat (background_services → scripts/backup-service.php) only
 * fires while someone has a legacy OpenEMR tab open — New Clinic desks escape that
 * shell via top-redirect.php, so a desk-only clinic may rarely or never trigger it.
 * Scheduling THIS worker (below) is the robust, checklisted path; it calls the
 * exact same AdminBackupService::runScheduledBackup()/runScheduledFilesBackup()
 * that backup-service.php and scripts/backup-scheduled.php call — one due-check/
 * run implementation, three entry points, never copy-pasted. On the (rare — daily
 * cadence at most) run where a backup is actually due, this invocation will run
 * long; that's fine, a concurrent overlapping run-jobs.php invocation just skips
 * the backup (M3 lock busy) and still processes export jobs normally.
 *
 * RUN IT — pick one:
 *   - Cron (Linux):        * * * * * php .../scripts/run-jobs.php --max-seconds=55
 *   - Task Scheduler (Win): run every 1–2 min, action:
 *       C:\xampp\php\php.exe C:\xampp\htdocs\openemr\interface\modules\custom_modules\oe-module-new-clinic\scripts\run-jobs.php --max-seconds=55
 * The worker exits after --max-jobs jobs or --max-seconds seconds (whichever first)
 * for the EXPORT-JOB loop; the backup due-check below is a fixed extra step each
 * run (no-ops instantly unless a backup is actually due), so back-to-back cron
 * runs stay safe.
 *
 * FLAGS:
 *   --max-jobs=N      max jobs to process this run (default 20)
 *   --max-seconds=N   soft time budget in seconds (default 55, for a 1-min cron)
 *   --site=NAME       OpenEMR site id (default "default"); one worker per site
 *
 * Until a worker is scheduled, the status poll still finishes stale jobs inline
 * (config `enable_inline_export_fallback`, default on). Turn that off once this
 * worker runs on a schedule (see the scale-out runbook).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

// Site resolution must happen BEFORE the globals bootstrap (which dies without it
// under CLI — there is no HTTP host to infer the site from).
$maxJobs = 20;
$maxSeconds = 55;
$site = 'default';
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--max-jobs=(\d+)$/', $arg, $m)) {
        $maxJobs = max(1, (int) $m[1]);
    } elseif (preg_match('/^--max-seconds=(\d+)$/', $arg, $m)) {
        $maxSeconds = max(1, (int) $m[1]);
    } elseif (preg_match('/^--site=([A-Za-z0-9_-]+)$/', $arg, $m)) {
        $site = $m[1];
    }
}
$_GET['site'] = $site;

$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\ReportHubExportService;
use OpenEMR\Modules\NewClinic\Services\ExportJobService;
use OpenEMR\Modules\NewClinic\Services\ExportStorageService;
use OpenEMR\Modules\NewClinic\Services\RateLimitService;
use OpenEMR\Modules\NewClinic\Services\CacheService;
use OpenEMR\Modules\NewClinic\Services\PerfCounterService;
use OpenEMR\Modules\NewClinic\Services\HistoryRetentionService;
use OpenEMR\Modules\NewClinic\Services\AdminBackupService;

@set_time_limit(0);

try {
    // Report exports (SCALE-2.1) and generic export jobs (SCALE-2.2) share the budget.
    $reports = (new ReportHubExportService())->runWorker($maxJobs, $maxSeconds);
    $exports = (new ExportJobService())->runWorker($maxJobs, $maxSeconds);

    // BACKUP-H1(a) — run due scheduled backups from THIS worker, not only the
    // logged-in-user tab-shell heartbeat (background_services → backup-service.php).
    // New Clinic desks escape that heartbeat entirely (top-redirect.php leaves the
    // core tab shell), so on a desk-only clinic the heartbeat may fire rarely or
    // never — a worker cron/Task Scheduler entry is the reliable path. Calls the
    // SAME due-check + performBackup() that backup-service.php's heartbeat and
    // scripts/backup-scheduled.php call (AdminBackupService::runScheduledBackup() /
    // runScheduledFilesBackup()) — no duplicated scheduling logic between the three
    // entry points. No session here (CLI worker — repo gotcha): the service resolves
    // facility scope from the database, never $_SESSION (see AdminBackupService M4).
    // Separate try/catch per kind — a DB backup failure (e.g. too large for
    // in-app encryption) must not mask the files backup's own true status (or
    // vice versa); each is an independent schedule (design §3).
    $backupSvc = new AdminBackupService();
    try {
        $scheduledBackup = $backupSvc->runScheduledBackup(0);
    } catch (\Throwable $e) {
        $scheduledBackup = ['status' => 'error', 'error' => $e->getMessage()];
    }
    try {
        $scheduledFilesBackup = $backupSvc->runScheduledFilesBackup(0);
    } catch (\Throwable $e) {
        $scheduledFilesBackup = ['status' => 'error', 'error' => $e->getMessage()];
    }

    // SCALE-2.3: purge expired PHI-bearing export files every pass, so retention
    // holds even when no new exports are being written.
    $purged = [];
    foreach ([ReportHubExportService::STORAGE_NAMESPACE, ExportJobService::STORAGE_NAMESPACE] as $namespace) {
        try {
            $purged[$namespace] = (new ExportStorageService($namespace))->purgeOlderThan();
        } catch (\Throwable $e) {
            $purged[$namespace] = 'error: ' . $e->getMessage();
        }
    }

    // SCALE-4.4: heartbeat for public/health.php — written directly to the DB
    // cache table (NOT via CacheService: a CLI apcu driver would make the
    // heartbeat invisible to the web tier). 10-min TTL, so a dead worker shows
    // up as worker_last_seen=null on the health endpoint within minutes.
    try {
        sqlStatement(
            "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
             VALUES ('nc:worker:heartbeat', ?, DATE_ADD(NOW(), INTERVAL 600 SECOND))
             ON DUPLICATE KEY UPDATE cache_value = VALUES(cache_value), expires_at = VALUES(expires_at)",
            [json_encode(['v' => date('c')])]
        );
    } catch (\Throwable $e) {
        // heartbeat is best-effort
    }

    // SCALE-3.1: drop rate-limit counter rows whose minute window is long gone.
    try {
        $ratePurged = (new RateLimitService())->purgeOldWindows();
    } catch (\Throwable $e) {
        $ratePurged = 'error: ' . $e->getMessage();
    }

    // SCALE-4.5: freeze p95 into completed days' perf counters, drop old rows.
    try {
        $perfRollup = (new PerfCounterService())->rollupAndPurge();
    } catch (\Throwable $e) {
        $perfRollup = 'error: ' . $e->getMessage();
    }

    // SCALE-6.3: prune append-only history tables per configured retention
    // (state_log defaults to OFF — a compliance decision, not a default).
    try {
        $historyPurged = (new HistoryRetentionService())->purgeAll();
    } catch (\Throwable $e) {
        $historyPurged = 'error: ' . $e->getMessage();
    }

    $out = [
        'report_exports' => $reports,
        'export_jobs' => $exports,
        'purged_files' => $purged,
        'purged_rate_windows' => $ratePurged,
        'perf_rollup' => $perfRollup,
        'history_purged' => $historyPurged,
        // SCALE-3.3: expired DB cache rows are dead weight; drop them each pass.
        'purged_cache_rows' => (new CacheService())->purgeExpired(),
        // BACKUP-H1(a) — status shape is one of: skipped (native backup off, or
        // not due yet), ok (a backup actually ran this pass), failed, or error
        // (an exception escaped the service — still doesn't kill the rest of the
        // worker's jobs above).
        'scheduled_backup' => $scheduledBackup,
        'scheduled_files_backup' => $scheduledFilesBackup,
    ];
    fwrite(STDOUT, json_encode($out) . "\n");
    $failed = (int) ($reports['failed'] ?? 0) + (int) ($exports['failed'] ?? 0)
        + (in_array($scheduledBackup['status'] ?? '', ['failed', 'error'], true) ? 1 : 0)
        + (in_array($scheduledFilesBackup['status'] ?? '', ['failed', 'error'], true) ? 1 : 0);
    exit($failed > 0 ? 1 : 0);
} catch (\Throwable $e) {
    fwrite(STDERR, 'run-jobs error: ' . $e->getMessage() . "\n");
    exit(1);
}
