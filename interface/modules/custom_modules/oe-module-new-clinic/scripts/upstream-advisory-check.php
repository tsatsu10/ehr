<?php

/**
 * SEC-8 — upstream advisory check. Fetches OpenEMR GitHub security advisories +
 * recent releases, compares against the tracked baseline (VERSION_BASELINE.md),
 * and prints "new since last check". Run monthly + before every release train.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/upstream-advisory-check.php
 *
 * Needs outbound HTTPS to api.github.com (uses `gh` if available, else curl).
 * Writes a watermark to sites/<site>/documents/nc_security/advisory-watermark.txt
 * so each run only reports what's new.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';

$baseline = '8.0.0'; // keep in sync with VERSION_BASELINE.md
$repo = 'openemr/openemr';

function fetchJson(string $url): ?array
{
    $cmd = null;
    if (trim((string) shell_exec('gh --version 2>/dev/null')) !== '') {
        $path = preg_replace('#^https://api\.github\.com#', '', $url);
        $cmd = 'gh api ' . escapeshellarg($path) . ' 2>/dev/null';
    } elseif (trim((string) shell_exec('curl --version 2>/dev/null')) !== '') {
        $cmd = 'curl -s -H "Accept: application/vnd.github+json" ' . escapeshellarg($url) . ' 2>/dev/null';
    }
    if ($cmd === null) {
        return null;
    }
    $out = shell_exec($cmd);
    $decoded = json_decode((string) $out, true);

    return is_array($decoded) ? $decoded : null;
}

$watermarkDir = ($GLOBALS['OE_SITE_DIR'] ?? sys_get_temp_dir()) . '/documents/nc_security';
@mkdir($watermarkDir, 0700, true);
$watermarkFile = $watermarkDir . '/advisory-watermark.txt';
$lastCheck = is_file($watermarkFile) ? trim((string) file_get_contents($watermarkFile)) : '';

echo "OpenEMR upstream advisory check\n";
echo "Baseline tracked: {$baseline}\n";
echo "Last check watermark: " . ($lastCheck !== '' ? $lastCheck : '(none — first run)') . "\n\n";

$advisories = fetchJson("https://api.github.com/repos/{$repo}/security-advisories?per_page=30");
if ($advisories === null) {
    fwrite(STDERR, "Could not reach GitHub (no gh/curl or no network). Run from a box with outbound HTTPS.\n");
    exit(2);
}

$newCount = 0;
foreach ($advisories as $adv) {
    $published = (string) ($adv['published_at'] ?? $adv['updated_at'] ?? '');
    if ($lastCheck !== '' && $published <= $lastCheck) {
        continue;
    }
    $newCount++;
    echo "── " . ($adv['ghsa_id'] ?? '?') . "  [" . ($adv['severity'] ?? '?') . "]\n";
    echo "   " . ($adv['summary'] ?? '(no summary)') . "\n";
    echo "   published: {$published}\n";
    echo "   TRIAGE: check affected range vs {$baseline}, then NEW_CLINIC_SEC8_EXPOSURE_MAP.md\n\n";
}

echo $newCount === 0 ? "No new advisories since last check.\n" : "{$newCount} new advisor(y/ies) — triage each.\n";
file_put_contents($watermarkFile, date('c'));
@chmod($watermarkFile, 0600);
