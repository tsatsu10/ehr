<?php

/**
 * Load-balancer health & readiness endpoint (SCALE-4.4).
 *
 * GET .../oe-module-new-clinic/public/health.php[?site=default]
 *   200 {"ok":true,"db_ms":1.2,"cache_ms":0.8,"worker_last_seen":"...",
 *        "db_conns":7,"db_conns_limit":151}   db_conns/limit = SCALE-6.2 headroom
 *   503 {"ok":false}                          when the DB is unreachable
 *   429 {"ok":false,"error":"rate_limited"}   past the per-IP budget
 *
 * Deliberately does NOT bootstrap OpenEMR: no globals.php, no session (lock-free),
 * no auth — so it answers in a few ms and stays honest when the app tier is sick.
 * It reads only the site's sqlconf.php and touches only module infrastructure
 * tables. Output contains timings, a boolean, and a worker timestamp — no PHI,
 * no config, no versions (health endpoints get scraped; give the devil nothing).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');

/** @return never */
function healthRespond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

// --- resolve the site dir (sanitized — this value becomes a filesystem path) ---
$site = (string) ($_GET['site'] ?? 'default');
if (!preg_match('/^[A-Za-z0-9_-]{1,32}$/', $site)) {
    healthRespond(400, ['ok' => false]);
}
$sqlconf = dirname(__DIR__, 5) . '/sites/' . $site . '/sqlconf.php';
if (!is_file($sqlconf)) {
    healthRespond(404, ['ok' => false]);
}

// sqlconf.php defines $host, $port, $login, $pass, $dbase (and a $config flag).
$config = 0;
require $sqlconf;
if (empty($config)) {
    healthRespond(503, ['ok' => false]); // site not installed
}

// --- DB probe: connect + SELECT 1, timed --------------------------------------
mysqli_report(MYSQLI_REPORT_OFF);
$t0 = microtime(true);
$db = mysqli_init();
if ($db === false) {
    healthRespond(503, ['ok' => false]);
}
$db->options(MYSQLI_OPT_CONNECT_TIMEOUT, 3);
if (!@$db->real_connect((string) $host, (string) $login, (string) $pass, (string) $dbase, (int) $port)) {
    healthRespond(503, ['ok' => false]);
}
$ping = $db->query('SELECT 1');
if ($ping === false) {
    healthRespond(503, ['ok' => false]);
}
$dbMs = round((microtime(true) - $t0) * 1000, 1);

// --- per-IP rate limit (devil-proofing) — fixed window on the rate table -------
$ip = preg_replace('/[^0-9a-fA-F:.]/', '', (string) ($_SERVER['REMOTE_ADDR'] ?? '')) ?: 'unknown';
$bucket = 'health:' . substr($ip, 0, 45) . ':' . date('YmdHi');
$stmt = $db->prepare(
    'INSERT INTO new_clinic_rate_limit (bucket_key, window_start, `count`) VALUES (?, NOW(), 1)
     ON DUPLICATE KEY UPDATE `count` = `count` + 1'
);
if ($stmt !== false) {
    $stmt->bind_param('s', $bucket);
    if ($stmt->execute()) {
        $read = $db->prepare('SELECT `count` FROM new_clinic_rate_limit WHERE bucket_key = ?');
        if ($read !== false) {
            $read->bind_param('s', $bucket);
            $read->execute();
            $row = $read->get_result()?->fetch_assoc();
            if ((int) ($row['count'] ?? 0) > 30) {
                healthRespond(429, ['ok' => false, 'error' => 'rate_limited']);
            }
        }
    }
}
// Rate-table failures (e.g. pre-upgrade schema) are non-fatal: health still reports.

// --- cache probe: write + read one row in the cache table, timed ---------------
$cacheMs = null;
$t1 = microtime(true);
$probe = $db->prepare(
    "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
     VALUES ('nc:health:probe', '{\"v\":1}', DATE_ADD(NOW(), INTERVAL 60 SECOND))
     ON DUPLICATE KEY UPDATE cache_value = VALUES(cache_value), expires_at = VALUES(expires_at)"
);
if ($probe !== false && $probe->execute()) {
    $back = $db->query("SELECT cache_value FROM new_clinic_cache WHERE cache_key = 'nc:health:probe'");
    if ($back !== false && $back->fetch_assoc() !== null) {
        $cacheMs = round((microtime(true) - $t1) * 1000, 1);
    }
}

// --- worker heartbeat (written by scripts/run-jobs.php every pass, 10-min TTL) --
$workerLastSeen = null;
$hb = $db->query(
    "SELECT cache_value FROM new_clinic_cache
     WHERE cache_key = 'nc:worker:heartbeat' AND expires_at > NOW()"
);
if ($hb !== false) {
    $row = $hb->fetch_assoc();
    if (is_array($row) && is_string($row['cache_value'] ?? null)) {
        $decoded = json_decode($row['cache_value'], true);
        if (is_array($decoded) && is_string($decoded['v'] ?? null)) {
            $workerLastSeen = $decoded['v'];
        }
    }
}

// --- DB connection headroom (SCALE-6.2) — the classic PHP+MySQL ceiling: each
// Apache worker/thread holds its own connection, so a fleet that outgrows
// max_connections starts refusing NEW requests (incl. logins) while old ones
// hang. Surfaced here (two cheap status reads, no PHI) so the alerting monitor
// and an operator can watch headroom BEFORE it saturates. Best-effort/nullable.
$dbConns = null;
$dbConnsLimit = null;
$cRes = $db->query("SHOW STATUS LIKE 'Threads_connected'");
if ($cRes !== false) {
    $r = $cRes->fetch_assoc();
    if (is_array($r) && isset($r['Value'])) {
        $dbConns = (int) $r['Value'];
    }
}
$lRes = $db->query("SHOW VARIABLES LIKE 'max_connections'");
if ($lRes !== false) {
    $r = $lRes->fetch_assoc();
    if (is_array($r) && isset($r['Value'])) {
        $dbConnsLimit = (int) $r['Value'];
    }
}

healthRespond(200, [
    'ok' => true,
    'db_ms' => $dbMs,
    'cache_ms' => $cacheMs,
    'worker_last_seen' => $workerLastSeen,
    'db_conns' => $dbConns,
    'db_conns_limit' => $dbConnsLimit,
]);
