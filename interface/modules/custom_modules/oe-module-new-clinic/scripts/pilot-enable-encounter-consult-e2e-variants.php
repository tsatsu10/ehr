<?php

/**
 * Enable encounter consult E2E variant matrix: supervisor gate, referral variant map, LBF export.
 *
 * Usage:
 *   php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-encounter-consult-e2e-variants.php
 */

if (php_sapi_name() !== 'cli') {
    die("CLI only\n");
}

$_GET['site'] = 'default';
$ignoreAuth = true;
require_once dirname(__DIR__, 4) . '/globals.php';
require_once __DIR__ . '/lib/pilot-common-seed.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

$config = new ClinicConfigService();
$facilityIds = pilotFacilityIds();

foreach ($facilityIds as $facilityId) {
    // Native engine is permanent since 2026-07-18 — no engine setting to flip.
    $config->set('encounter_note_supervisor_required', '1', $facilityId);
    $config->set('encounter_note_lbf_export_on_save', '1', $facilityId);

    $variantMap = [];
    $visitTypes = QueryUtils::fetchRecords(
        'SELECT label FROM new_visit_type WHERE facility_id = ? AND is_active = 1',
        [$facilityId]
    ) ?: [];
    foreach ($visitTypes as $visitType) {
        $label = trim((string) ($visitType['label'] ?? ''));
        if ($label !== '') {
            $variantMap[$label] = 'referral_consult';
        }
    }
    if ($variantMap === []) {
        $variantMap['General OPD'] = 'referral_consult';
    }
    $config->set('encounter_note_variant_map', json_encode($variantMap, JSON_THROW_ON_ERROR), $facilityId);

    echo "Encounter consult E2E variants enabled for facility {$facilityId}.\n";
}

echo 'Variant map keys: ' . implode(', ', array_keys($variantMap ?? [])) . "\n";
