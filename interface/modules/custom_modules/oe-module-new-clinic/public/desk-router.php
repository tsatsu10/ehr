<?php

/**
 * Legacy desk-router URLs redirect to live desk pages.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

require_once __DIR__ . '/bootstrap.php';

$redirects = [
    'triage' => 'triage.php',
    'doctor' => 'doctor.php',
    'lab' => 'lab.php',
    'pharmacy' => 'pharmacy.php',
    'cashier' => 'cashier.php',
    'admin' => 'admin.php',
    'reports' => 'reports.php',
];

$script = basename($_SERVER['SCRIPT_NAME'], '.php');
if (!isset($redirects[$script])) {
    http_response_code(404);
    exit;
}

$webroot = $GLOBALS['webroot'] ?? '';
header('Location: ' . $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/' . $redirects[$script], true, 302);
exit;
