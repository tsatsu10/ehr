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
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();

foreach ($facilityIds as $facilityId) {
    $config->set('encounter_note_engine', EncounterNoteService::ENGINE_NATIVE, $facilityId);
    echo "Set encounter_note_engine=native for facility {$facilityId}.\n";
}

echo 'Native encounter note enabled for facilities: ' . implode(', ', $facilityIds) . ".\n";
