<?php

/**
 * New Clinic local health alerter (SCALE-6.4).
 *
 * Exits NON-ZERO with a human diagnostic on STDERR when the module's background
 * health is bad, so a cron / Windows Task Scheduler wrapper turns that into an
 * alert through whatever channel the deployment already has (cron-mail, "send an
 * email when the task fails", a monitoring agent). It sends nothing itself — that
 * keeps it channel-agnostic and dependency-free.
 *
 * This is the SECONDARY safety net: it catches "the job worker died / the DB is
 * strained while the box is still up" — the silent failure the perf plan calls
 * out (worker_last_seen goes null and nobody notices). The PRIMARY net is an
 * EXTERNAL uptime monitor pointed at public/health.php, because that also fires
 * when the whole box is down (a local cron can't). See the scale-out runbook §5.
 *
 * RUN IT — pick one:
 *   - Cron (Linux):        *5 * * * * php .../scripts/health-alert.php --site=default
 *   - Task Scheduler (Win): every 5 min; configure "send notification on failure".
 *
 * FLAGS:
 *   --site=NAME                OpenEMR site id (default "default")
 *   --worker-max-minutes=N     alert if the worker heartbeat is older than N (default 15)
 *   --conns-warn-pct=N         alert if DB connections ≥ N% of max_connections (default 80)
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

// Site resolution before the globals bootstrap (same as run-jobs.php).
$site = 'default';
$workerMaxMinutes = 15;
$connsWarnPct = 80;
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--site=([A-Za-z0-9_-]+)$/', $arg, $m)) {
        $site = $m[1];
    } elseif (preg_match('/^--worker-max-minutes=(\d+)$/', $arg, $m)) {
        $workerMaxMinutes = max(1, (int) $m[1]);
    } elseif (preg_match('/^--conns-warn-pct=(\d+)$/', $arg, $m)) {
        $connsWarnPct = max(1, min(100, (int) $m[1]));
    }
}
$_GET['site'] = $site;

$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

use OpenEMR\Common\Database\QueryUtils;

$problems = [];

// 1) Job worker heartbeat fresh? (written by run-jobs.php every pass, 10-min TTL)
try {
    $row = QueryUtils::querySingleRow(
        "SELECT cache_value FROM new_clinic_cache
         WHERE cache_key = 'nc:worker:heartbeat' AND expires_at > NOW()"
    );
    $lastSeen = null;
    if (is_array($row) && is_string($row['cache_value'] ?? null)) {
        $decoded = json_decode($row['cache_value'], true);
        $lastSeen = is_array($decoded) && is_string($decoded['v'] ?? null) ? $decoded['v'] : null;
    }
    if ($lastSeen === null) {
        $problems[] = 'job worker heartbeat missing/expired — the worker is not running; exports, '
            . 'retention purges and cache/rate cleanup are NOT happening';
    } else {
        $ageMinutes = (time() - strtotime($lastSeen)) / 60;
        if ($ageMinutes > $workerMaxMinutes) {
            $problems[] = sprintf('job worker last ran %.0f min ago (threshold %d min)', $ageMinutes, $workerMaxMinutes);
        }
    }
} catch (\Throwable $e) {
    $problems[] = 'heartbeat check failed: ' . $e->getMessage();
}

// 2) DB connection headroom (SCALE-6.2) — climbing toward max_connections is the
//    slow-motion outage where new requests (incl. logins) start getting refused.
try {
    $c = QueryUtils::querySingleRow("SHOW STATUS LIKE 'Threads_connected'");
    $l = QueryUtils::querySingleRow("SHOW VARIABLES LIKE 'max_connections'");
    $used = (int) ($c['Value'] ?? 0);
    $limit = (int) ($l['Value'] ?? 0);
    if ($limit > 0) {
        $pct = (int) round($used / $limit * 100);
        if ($pct >= $connsWarnPct) {
            $problems[] = "DB connections at {$pct}% of max_connections (threshold {$connsWarnPct}%) — "
                . 'widen max_connections and check worker sizing before it refuses connections';
        }
    }
} catch (\Throwable $e) {
    // non-fatal — a stats query failing is not itself an alert condition
}

if ($problems === []) {
    fwrite(STDOUT, "OK: New Clinic background health nominal (site={$site})\n");
    exit(0);
}

fwrite(STDERR, "ALERT: New Clinic background health degraded (site={$site}):\n - " . implode("\n - ", $problems) . "\n");
exit(1);
