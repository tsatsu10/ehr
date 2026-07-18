<?php

/**
 * Set encounter-note config knobs for E2E specs (per-test, deterministic).
 *
 * Usage:
 *   php .../scripts/e2e-set-encounter-note-config.php supervisor=0 lbf=0 map=none
 *   php .../scripts/e2e-set-encounter-note-config.php supervisor=1 map=all
 *
 * map=all routes every active visit type (facility-scoped + global facility-0
 * types, since the walk-in list unions both) to the referral_consult variant;
 * map=none clears the variant map. Only the knobs passed are changed.
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

$args = [];
foreach (array_slice($argv, 1) as $arg) {
    [$key, $value] = array_pad(explode('=', $arg, 2), 2, '');
    $args[trim($key)] = trim($value);
}

$config = new ClinicConfigService();

if (($args['release_doctor'] ?? '') === '1') {
    // E2E janitor: earlier tests leave their visits in with_doctor, which makes the
    // doctor desk block taking the next patient (hasActiveConsult). Cancel them.
    sqlStatement("UPDATE new_visit SET state = 'cancelled' WHERE state = 'with_doctor'");
    echo "Released with_doctor visits.\n";
}

foreach (pilotFacilityIds() as $facilityId) {
    if (isset($args['supervisor'])) {
        $config->set('encounter_note_supervisor_required', $args['supervisor'] === '1' ? '1' : '0', $facilityId);
    }
    if (isset($args['lbf'])) {
        $config->set('encounter_note_lbf_export_on_save', $args['lbf'] === '1' ? '1' : '0', $facilityId);
    }
    if (isset($args['map'])) {
        $variantMap = [];
        if ($args['map'] === 'all') {
            $visitTypes = QueryUtils::fetchRecords(
                'SELECT DISTINCT label FROM new_visit_type WHERE is_active = 1 AND facility_id IN (0, ?)',
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
        }
        $config->set('encounter_note_variant_map', json_encode($variantMap, JSON_THROW_ON_ERROR), $facilityId);
    }
    echo "Encounter note E2E config applied for facility {$facilityId}.\n";
}
