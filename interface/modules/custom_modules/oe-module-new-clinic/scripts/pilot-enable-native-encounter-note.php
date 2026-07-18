<?php

/**
 * Enable native encounter consult form (V1.2-DOC-HLF-2) for E2E / pilot smoke.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-native-encounter-note.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$facilityIds = pilotFacilityIds();

// The native engine is permanent since 2026-07-18 (`encounter_note_engine` retired,
// PRD §5.6 amendment). Reset the variant-matrix knobs so the plain consult spec is
// deterministic even when the variants prep ran in an earlier invocation — these
// config rows persist between runs.
$config = new ClinicConfigService();
foreach ($facilityIds as $facilityId) {
    $config->set('encounter_note_supervisor_required', '0', $facilityId);
    $config->set('encounter_note_lbf_export_on_save', '0', $facilityId);
    $config->set('encounter_note_variant_map', '{}', $facilityId);
}

echo 'Native encounter note is always on (engine setting retired 2026-07-18); variant knobs reset for facilities: '
    . implode(', ', $facilityIds) . ".\n";
