<?php

/**
 * Clean-URL front controller for New Clinic module desks.
 *
 * Maps /clinic/{slug} to the corresponding module public PHP file.
 * The .htaccess in this directory rewrites /clinic/{slug} to
 * /clinic/index.php?_desk={slug} before this file is invoked.
 *
 * Adding a new desk: add an entry to DESK_MAP and ensure the
 * corresponding PHP file exists in the module public directory.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

const DESK_MAP = [
    'front-desk'       => 'front-desk.php',
    'triage'           => 'triage.php',
    'doctor'           => 'doctor.php',
    'lab'              => 'lab.php',
    'pharmacy'         => 'pharmacy.php',
    'cashier'          => 'cashier.php',
    'visit-board'      => 'visit-board.php',
    'admin'            => 'admin.php',
    'reports'          => 'reports.php',
    'communications'   => 'communications.php',
    'patient-registry' => 'patient-registry.php',
    'office-notes'     => 'office-notes.php',
];

$slug = strtolower(preg_replace('/[^a-z0-9-]/', '', (string) ($_GET['_desk'] ?? 'front-desk')));
$targetFile = DESK_MAP[$slug] ?? null;

if ($targetFile === null) {
    http_response_code(404);
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        . '<title>Not found</title></head>'
        . '<body><p>Desk not found.</p></body></html>';
    exit;
}

require_once dirname(__DIR__)
    . '/interface/modules/custom_modules/oe-module-new-clinic/public/'
    . $targetFile;
