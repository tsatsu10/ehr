<?php

/**
 * Backfill the specimen on the OPD starter-panel procedure_type rows, so the
 * native "New lab / procedure order" form auto-fills each test's specimen and
 * the ordering doctor never has to pick it (specimen is a property of the test,
 * not a clinical decision).
 *
 * Idempotent + non-destructive: only fills rows whose specimen is empty, so a
 * clinic's own specimen choices are never overwritten. Values are Specimen_Type
 * list option ids (SNOMED) so they match the order form's specimen dropdown.
 *
 * Usage: php interface/modules/custom_modules/oe-module-new-clinic/scripts/backfill-proc-order-specimen.php
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

use OpenEMR\Common\Database\QueryUtils;

// Specimen_Type option ids (SNOMED) — must match a real list_options row.
$SPECIMEN_BLOOD = '119297000'; // Blood specimen
$SPECIMEN_URINE = '122575003'; // Urine specimen

// Standard OPD test code → specimen. Codes track LabOrderChargeService::
// STARTER_PANEL_CODES plus the common CBC analytes.
$map = [
    'MAL_RDT' => $SPECIMEN_BLOOD,
    'HB'      => $SPECIMEN_BLOOD,
    'HGB'     => $SPECIMEN_BLOOD,
    'CBC'     => $SPECIMEN_BLOOD,
    'FBC'     => $SPECIMEN_BLOOD,
    'GLU_F'   => $SPECIMEN_BLOOD,
    'WBC'     => $SPECIMEN_BLOOD,
    'HCT'     => $SPECIMEN_BLOOD,
    'PLT'     => $SPECIMEN_BLOOD,
    'HCG'     => $SPECIMEN_URINE,
    'UA_DIP'  => $SPECIMEN_URINE,
];

$updated = 0;
foreach ($map as $code => $specimen) {
    $rows = QueryUtils::fetchRecords(
        "SELECT procedure_type_id, name FROM procedure_type
         WHERE procedure_type = 'ord' AND UPPER(procedure_code) = ?
           AND (specimen IS NULL OR specimen = '')",
        [strtoupper($code)]
    ) ?: [];
    foreach ($rows as $row) {
        sqlStatement(
            'UPDATE procedure_type SET specimen = ? WHERE procedure_type_id = ?',
            [$specimen, (int) $row['procedure_type_id']]
        );
        $updated++;
        echo "  {$code} → {$specimen}  ({$row['name']})\n";
    }
}

echo "Backfilled specimen on {$updated} test(s).\n";
