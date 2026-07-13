<?php

/**
 * New Clinic ajax load-test harness (SCALE-0.2).
 *
 * Fires a burst of requests at ONE module ajax action and reports latency
 * percentiles (p50/p95/p99) + error count, so every SCALE-* task has a
 * before/after number. Read-only by design: it drives GET poll/read actions
 * (queue.counts, visit.board, patients.search). It does NOT seed data and does
 * NOT run mutations.
 *
 * SAFETY: defaults to --dry-run (prints the plan, sends nothing). Pass --run to
 * actually fire requests. Point it ONLY at a test/dev box, never production.
 *
 * USAGE (PowerShell / bash):
 *   php scripts/load-test.php \
 *     --url="http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php" \
 *     --action=queue.counts \
 *     --cookie="OpenEMR=<session-id>; ..." \
 *     --requests=50 --concurrency=10 --run
 *
 * Get the cookie: log into OpenEMR in a browser, open DevTools → Application →
 * Cookies, copy the whole Cookie header value. (Read actions need a valid
 * session but no CSRF token; CSRF only applies to POST mutations, out of scope.)
 *
 * OUTPUT: a one-line summary plus a table row you can paste into
 * Documentation/NewClinic/worksheets/SCALABILITY_BASELINE.md.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "load-test.php is a CLI tool.\n");
    exit(1);
}

/**
 * @param list<string> $argv
 * @return array<string, string>
 */
function nc_lt_parse_args(array $argv): array
{
    $args = [];
    foreach (array_slice($argv, 1) as $arg) {
        if (!str_starts_with($arg, '--')) {
            continue;
        }
        $eq = strpos($arg, '=');
        if ($eq === false) {
            $args[substr($arg, 2)] = '1'; // bare flag, e.g. --run / --dry-run
        } else {
            $args[substr($arg, 2, $eq - 2)] = substr($arg, $eq + 1);
        }
    }

    return $args;
}

/**
 * @param list<float> $sorted ascending
 */
function nc_lt_percentile(array $sorted, float $p): float
{
    $n = count($sorted);
    if ($n === 0) {
        return 0.0;
    }
    if ($n === 1) {
        return $sorted[0];
    }
    $rank = ($p / 100) * ($n - 1);
    $low = (int) floor($rank);
    $high = (int) ceil($rank);
    if ($low === $high) {
        return $sorted[$low];
    }
    $frac = $rank - $low;

    return $sorted[$low] + ($sorted[$high] - $sorted[$low]) * $frac;
}

$args = nc_lt_parse_args($argv);

$url = (string) ($args['url'] ?? '');
$action = (string) ($args['action'] ?? 'queue.counts');
$cookie = (string) ($args['cookie'] ?? '');
$requests = max(1, (int) ($args['requests'] ?? 50));
$concurrency = max(1, (int) ($args['concurrency'] ?? 10));
$method = strtoupper((string) ($args['method'] ?? 'GET'));
$csrf = (string) ($args['csrf'] ?? '');
// Raw JSON body for POST actions, e.g. --body='{"q":"mensah"}'. The action is
// always also on the query string, so read handlers that check $_REQUEST work too.
$body = (string) ($args['body'] ?? '');
// --run turns off dry-run; dry-run is the default (safe).
$dryRun = !isset($args['run']);

if ($url === '') {
    fwrite(STDERR, "Missing --url (the module ajax.php endpoint). See the header for usage.\n");
    exit(1);
}

// Build the target URL (action goes on the query string; read actions use GET).
$targetUrl = $url . (str_contains($url, '?') ? '&' : '?') . 'action=' . rawurlencode($action);

fwrite(STDOUT, "New Clinic load test\n");
fwrite(STDOUT, str_repeat('-', 40) . "\n");
fwrite(STDOUT, "action      : $action\n");
fwrite(STDOUT, "url         : $targetUrl\n");
fwrite(STDOUT, "method      : $method\n");
fwrite(STDOUT, "requests    : $requests\n");
fwrite(STDOUT, "concurrency : $concurrency\n");
fwrite(STDOUT, 'cookie      : ' . ($cookie !== '' ? '(provided)' : '(none — reads will 401)') . "\n");

if ($dryRun) {
    fwrite(STDOUT, "\nDRY RUN — nothing sent. Add --run to execute.\n");
    exit(0);
}

if (!function_exists('curl_multi_init')) {
    fwrite(STDERR, "curl extension is required to --run.\n");
    exit(1);
}

$latencies = [];   // ms, successful responses only
$errors = 0;
$statusCounts = [];
$sent = 0;
$bootstrapBounceSample = '';

while ($sent < $requests) {
    $batch = min($concurrency, $requests - $sent);
    $multi = curl_multi_init();
    $handles = [];

    for ($i = 0; $i < $batch; $i++) {
        $ch = curl_init();
        $headers = ['Accept: application/json'];
        if ($csrf !== '') {
            $headers[] = 'X-CSRF-Token: ' . $csrf;
        }
        $opts = [
            CURLOPT_URL => $targetUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_TIMEOUT => 30,
        ];
        if ($method === 'POST') {
            $opts[CURLOPT_POSTFIELDS] = $body;
            $headers[] = 'Content-Type: application/json';
        }
        $opts[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $opts);
        if ($cookie !== '') {
            curl_setopt($ch, CURLOPT_COOKIE, $cookie);
        }
        curl_multi_add_handle($multi, $ch);
        $handles[] = $ch;
    }

    $running = null;
    do {
        curl_multi_exec($multi, $running);
        curl_multi_select($multi, 1.0);
    } while ($running > 0);

    foreach ($handles as $ch) {
        $errno = curl_errno($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $totalMs = curl_getinfo($ch, CURLINFO_TOTAL_TIME) * 1000;
        $body = (string) curl_multi_getcontent($ch);
        $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
        // OpenEMR returns HTTP 200 with a PLAIN-TEXT bootstrap error ("Site ID is
        // missing from session data!") when the session is invalid/expired — the
        // action never runs. A real module response is always a JSON object, so
        // treat non-JSON 2xx bodies as errors, not fast successes.
        $looksJson = str_starts_with(ltrim($body), '{');
        if ($errno !== 0 || $status < 200 || $status >= 300 || !$looksJson) {
            $errors++;
            if (!$looksJson && $bootstrapBounceSample === '') {
                $bootstrapBounceSample = trim(substr($body, 0, 120));
            }
        } else {
            $latencies[] = $totalMs;
        }
        curl_multi_remove_handle($multi, $ch);
        curl_close($ch);
    }
    curl_multi_close($multi);
    $sent += $batch;
}

sort($latencies);
$p50 = nc_lt_percentile($latencies, 50);
$p95 = nc_lt_percentile($latencies, 95);
$p99 = nc_lt_percentile($latencies, 99);

fwrite(STDOUT, "\nResults\n");
fwrite(STDOUT, str_repeat('-', 40) . "\n");
fwrite(STDOUT, sprintf("ok/err      : %d / %d\n", count($latencies), $errors));
fwrite(STDOUT, 'status codes: ' . json_encode($statusCounts) . "\n");
fwrite(STDOUT, sprintf("p50 / p95 / p99 (ms): %.1f / %.1f / %.1f\n", $p50, $p95, $p99));

if ($bootstrapBounceSample !== '') {
    fwrite(STDOUT, "\n*** INVALID RUN — responses were not JSON. ***\n");
    fwrite(STDOUT, 'Server said: "' . $bootstrapBounceSample . "\"\n");
    fwrite(STDOUT, "Your session cookie is missing/expired, so the action never ran.\n");
    fwrite(STDOUT, "Re-copy a fresh Cookie header from a logged-in browser and try again.\n");
    fwrite(STDOUT, "These numbers do NOT count — do not record them.\n");
}

// Paste-ready worksheet row.
fwrite(STDOUT, "\nWorksheet row (SCALABILITY_BASELINE.md):\n");
fwrite(STDOUT, sprintf(
    "| %s | %s | %d | %.1f | %.1f | %.1f | %d |\n",
    date('Y-m-d'),
    $action,
    $requests,
    $p50,
    $p95,
    $p99,
    $errors
));

exit($errors > 0 ? 2 : 0);
