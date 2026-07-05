<?php

/**
 * Break out of OpenEMR tab iframes into the standalone New Clinic shell.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

if (empty($_SESSION['authUserID'])) {
    $login = ($GLOBALS['webroot'] ?? '') . '/interface/login/login.php';
    header('Location: ' . $login);
    exit;
}

// Desk pages that have clean /clinic/{slug} URLs.
$phpToSlug = [
    'front-desk.php'       => 'front-desk',
    'triage.php'           => 'triage',
    'doctor.php'           => 'doctor',
    'lab.php'              => 'lab',
    'pharmacy.php'         => 'pharmacy',
    'cashier.php'          => 'cashier',
    'visit-board.php'      => 'visit-board',
    'admin.php'            => 'admin',
    'reports.php'          => 'reports',
    'communications.php'   => 'communications',
    'patient-registry.php' => 'patient-registry',
];

// Pages that are NOT desks (deep links) — keep their direct module path.
$directAllowed = ['patient-chart.php'];

$dest = basename((string) ($_GET['dest'] ?? 'front-desk.php'));

$query = [];
parse_str((string) ($_SERVER['QUERY_STRING'] ?? ''), $query);
unset($query['dest']);
$extra = http_build_query($query);
$webroot = $GLOBALS['webroot'] ?? '';

if (in_array($dest, $directAllowed, true)) {
    $target = $webroot
        . '/interface/modules/custom_modules/oe-module-new-clinic/public/'
        . $dest
        . ($extra !== '' ? '?' . $extra : '');
} else {
    $slug = $phpToSlug[$dest] ?? 'front-desk';
    $target = $webroot . '/clinic/' . $slug . ($extra !== '' ? '?' . $extra : '');
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title><?php echo xlt('Opening clinic'); ?></title>
    <script>
        (function () {
            var url = <?php echo json_encode($target, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
            if (window.top && window.top !== window.self) {
                window.top.location.href = url;
            } else {
                window.location.replace(url);
            }
        }());
    </script>
</head>
<body>
    <p><a href="<?php echo attr($target); ?>"><?php echo xlt('Continue to clinic'); ?></a></p>
</body>
</html>
