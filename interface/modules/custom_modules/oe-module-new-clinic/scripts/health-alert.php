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
 * Like public/health.php it deliberately DOES NOT bootstrap OpenEMR: it reads the
 * site's sqlconf and speaks raw mysqli. That matters for a monitor — a DB-down
 * OpenEMR bootstrap dies via die()/HelpfulDie(), and exit-with-a-message returns
 * status 0, which would make this tool wrongly report "healthy" (exit 0) exactly
 * when the DB is down. Raw mysqli makes DB-unreachable a deterministic exit 1.
 *
 * RUN IT — pick one:
 *   - Cron (Linux):        [*]/5 * * * * php .../scripts/health-alert.php --site=default
 *     (i.e. every 5 minutes: the minute field is "*&#47;5")
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

/** @return never */
function healthAlertExit(bool $ok, string $site, array $problems): void
{
    if ($ok) {
        fwrite(STDOUT, "OK: New Clinic background health nominal (site={$site})\n");
        exit(0);
    }
    fwrite(STDERR, "ALERT: New Clinic background health degraded (site={$site}):\n - " . implode("\n - ", $problems) . "\n");
    exit(1);
}

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

// --- resolve the site's sqlconf (sanitized — becomes a filesystem path) --------
if (!preg_match('/^[A-Za-z0-9_-]{1,32}$/', $site)) {
    healthAlertExit(false, $site, ['invalid --site (expected [A-Za-z0-9_-])']);
}
$sqlconf = dirname(__DIR__, 5) . '/sites/' . $site . '/sqlconf.php';
if (!is_file($sqlconf)) {
    healthAlertExit(false, $site, ["site config not found: sites/{$site}/sqlconf.php"]);
}

// sqlconf.php defines $host, $port, $login, $pass, $dbase (and a $config flag).
$config = 0;
require $sqlconf;
if (empty($config)) {
    healthAlertExit(false, $site, ['site is not installed ($config = 0 in sqlconf)']);
}

$problems = [];

// --- DB reachable? (the whole reason this file avoids the OpenEMR bootstrap) ----
mysqli_report(MYSQLI_REPORT_OFF);
$db = mysqli_init();
if ($db === false || !@$db->real_connect((string) $host, (string) $login, (string) $pass, (string) $dbase, (int) $port)) {
    // DB down IS the alert — deterministic exit 1 (never a bootstrap die-exit-0).
    healthAlertExit(false, $site, ['database unreachable — the app tier is down or MySQL is not running']);
}
$db->options(MYSQLI_OPT_CONNECT_TIMEOUT, 3);

// --- job worker heartbeat fresh? (written by run-jobs.php each pass) ------------
// Read WITHOUT the TTL filter so --worker-max-minutes is the single authority on
// "stale" (the row lingers past its TTL because only the — now dead — worker
// purges expired cache rows). Missing row entirely = never ran / heartbeat lost.
$lastSeen = null;
$hb = $db->query("SELECT cache_value FROM new_clinic_cache WHERE cache_key = 'nc:worker:heartbeat'");
if ($hb !== false) {
    $row = $hb->fetch_assoc();
    if (is_array($row) && is_string($row['cache_value'] ?? null)) {
        $decoded = json_decode($row['cache_value'], true);
        $lastSeen = is_array($decoded) && is_string($decoded['v'] ?? null) ? $decoded['v'] : null;
    }
}
if ($lastSeen === null) {
    $problems[] = 'job worker heartbeat missing — the worker has never run (or its heartbeat was lost); '
        . 'exports, retention purges and cache/rate cleanup are NOT happening';
} else {
    $ts = strtotime($lastSeen);
    $ageMinutes = $ts === false ? PHP_INT_MAX : (time() - $ts) / 60;
    if ($ageMinutes > $workerMaxMinutes) {
        $problems[] = sprintf('job worker last ran %.0f min ago (threshold %d min)', $ageMinutes, $workerMaxMinutes);
    }
}

// --- DB connection headroom (SCALE-6.2) — climbing toward max_connections is the
//     slow-motion outage where new requests (incl. logins) start getting refused.
$cRes = $db->query("SHOW STATUS LIKE 'Threads_connected'");
$lRes = $db->query("SHOW VARIABLES LIKE 'max_connections'");
if ($cRes !== false && $lRes !== false) {
    $cr = $cRes->fetch_assoc();
    $lr = $lRes->fetch_assoc();
    $used = is_array($cr) && isset($cr['Value']) ? (int) $cr['Value'] : 0;
    $limit = is_array($lr) && isset($lr['Value']) ? (int) $lr['Value'] : 0;
    if ($limit > 0) {
        $pct = (int) round($used / $limit * 100);
        if ($pct >= $connsWarnPct) {
            $problems[] = "DB connections at {$pct}% of max_connections (threshold {$connsWarnPct}%) — "
                . 'widen max_connections and check worker sizing before it refuses connections';
        }
    }
}

healthAlertExit($problems === [], $site, $problems);
