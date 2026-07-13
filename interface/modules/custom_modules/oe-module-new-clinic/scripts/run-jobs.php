<?php

/**
 * New Clinic background job worker (SCALE-2.1).
 *
 * Claims and completes queued export jobs (report_hub_export_run) OUTSIDE the web
 * request, so a heavy CSV build no longer runs inside a status-poll HTTP request.
 * Claims are atomic (a unique token per claim), so several workers never double-run
 * the same job; a job is retried up to 3 times, then marked failed.
 *
 * RUN IT — pick one:
 *   - Cron (Linux):        * * * * * php .../scripts/run-jobs.php --max-seconds=55
 *   - Task Scheduler (Win): run every 1–2 min, action:
 *       C:\xampp\php\php.exe C:\xampp\htdocs\openemr\interface\modules\custom_modules\oe-module-new-clinic\scripts\run-jobs.php --max-seconds=55
 * The worker exits after --max-jobs jobs or --max-seconds seconds (whichever first),
 * so back-to-back cron runs are safe and it never runs unbounded.
 *
 * FLAGS:
 *   --max-jobs=N      max jobs to process this run (default 20)
 *   --max-seconds=N   soft time budget in seconds (default 55, for a 1-min cron)
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

$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Modules\NewClinic\Services\ReportHubExportService;
use OpenEMR\Modules\NewClinic\Services\ExportJobService;

$maxJobs = 20;
$maxSeconds = 55;
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--max-jobs=(\d+)$/', $arg, $m)) {
        $maxJobs = max(1, (int) $m[1]);
    } elseif (preg_match('/^--max-seconds=(\d+)$/', $arg, $m)) {
        $maxSeconds = max(1, (int) $m[1]);
    }
}

@set_time_limit(0);

try {
    // Report exports (SCALE-2.1) and generic export jobs (SCALE-2.2) share the budget.
    $reports = (new ReportHubExportService())->runWorker($maxJobs, $maxSeconds);
    $exports = (new ExportJobService())->runWorker($maxJobs, $maxSeconds);
    $out = ['report_exports' => $reports, 'export_jobs' => $exports];
    fwrite(STDOUT, json_encode($out) . "\n");
    $failed = (int) ($reports['failed'] ?? 0) + (int) ($exports['failed'] ?? 0);
    exit($failed > 0 ? 1 : 0);
} catch (\Throwable $e) {
    fwrite(STDERR, 'run-jobs error: ' . $e->getMessage() . "\n");
    exit(1);
}
