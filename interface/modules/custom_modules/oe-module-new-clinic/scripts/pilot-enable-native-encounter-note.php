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

$facilityIds = pilotFacilityIds();

// The native engine is permanent since 2026-07-18 (`encounter_note_engine` retired,
// PRD §5.6 amendment) — nothing to set; kept because e2e specs invoke this script.
echo 'Native encounter note is always on (engine setting retired 2026-07-18) for facilities: '
    . implode(', ', $facilityIds) . ".\n";
