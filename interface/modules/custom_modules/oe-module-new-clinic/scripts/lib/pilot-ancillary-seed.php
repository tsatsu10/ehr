<?php

/**
 * Shared pilot seed for V1.1-ANC (lab-direct + pharmacy walk-in visit types and flags).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

require_once __DIR__ . '/pharm-ops-pilot-seed.php';

/**
 * @param list<int>|null $facilityIds
 */
function pilotAncillaryFacilityIds(?array $facilityIds = null): array
{
    if ($facilityIds !== null) {
        return $facilityIds;
    }

    return pharmOpsPilotFacilityIds();
}

/**
 * @param list<int>|null $facilityIds
 */
function pilotAncillaryEnableConfig(ClinicConfigService $config, ?array $facilityIds = null): void
{
    $facilityIds = pilotAncillaryFacilityIds($facilityIds);

    $flags = [
        'enable_lab_role' => '1',
        'enable_pharmacy_role' => '1',
        'enable_ancillary_services' => '1',
        'ancillary_refer_window_hours' => '4',
        'lab_intake_formdir' => 'lab_intake',
        'pharmacy_service_formdir' => 'pharmacy_service',
        'pharmacy_refer_to_opd_terminal_state' => 'cancelled',
        'pharmacy_declined_terminal_state' => 'cancelled',
    ];

    foreach ($facilityIds as $facilityId) {
        foreach ($flags as $key => $value) {
            $config->set($key, $value, $facilityId);
        }
    }
}

function pilotAncillaryEnsureVisitType(int $facilityId, string $label, string $serviceProfile): void
{
    $row = QueryUtils::querySingleRow(
        'SELECT id, service_profile, is_active FROM new_visit_type WHERE facility_id = ? AND label = ? LIMIT 1',
        [$facilityId, $label]
    );

    if (!empty($row)) {
        sqlStatement(
            'UPDATE new_visit_type SET service_profile = ?, is_active = 1 WHERE id = ?',
            [$serviceProfile, (int) $row['id']]
        );

        return;
    }

    $pcCatid = 5;
    $defaultType = QueryUtils::querySingleRow(
        'SELECT pc_catid FROM new_visit_type WHERE facility_id = ? AND service_profile = ? AND is_active = 1 LIMIT 1',
        [$facilityId, 'full_opd']
    );
    if (empty($defaultType)) {
        $defaultType = QueryUtils::querySingleRow(
            'SELECT pc_catid FROM new_visit_type WHERE facility_id = 0 AND service_profile = ? AND is_active = 1 LIMIT 1',
            ['full_opd']
        );
    }
    if (!empty($defaultType['pc_catid'])) {
        $pcCatid = (int) $defaultType['pc_catid'];
    }

    sqlInsert(
        'INSERT INTO new_visit_type (facility_id, label, pc_catid, service_profile, is_active, referral_required)
         VALUES (?, ?, ?, ?, 1, 0)',
        [$facilityId, $label, $pcCatid, $serviceProfile]
    );
}

/**
 * @param list<int>|null $facilityIds
 * @return array{lab_direct: int, pharmacy_walkin: int}
 */
function pilotAncillaryEnsureVisitTypes(?array $facilityIds = null): array
{
    $facilityIds = pilotAncillaryFacilityIds($facilityIds);
    $counts = ['lab_direct' => 0, 'pharmacy_walkin' => 0];

    foreach ($facilityIds as $facilityId) {
        pilotAncillaryEnsureVisitType($facilityId, 'Lab-only (direct)', 'lab_direct');
        pilotAncillaryEnsureVisitType($facilityId, 'Pharmacy walk-in', 'pharmacy_walkin');
        $counts['lab_direct']++;
        $counts['pharmacy_walkin']++;
    }

    return $counts;
}

/**
 * @param list<int>|null $facilityIds
 */
function pilotAncillaryEnsureAll(ClinicConfigService $config, ?array $facilityIds = null): array
{
    $facilityIds = pilotAncillaryFacilityIds($facilityIds);
    pharmOpsPilotEnablePharmacyRole($config, $facilityIds);
    pilotAncillaryEnableConfig($config, $facilityIds);
    $visitTypes = pilotAncillaryEnsureVisitTypes($facilityIds);

    return [
        'facility_ids' => $facilityIds,
        'visit_types' => $visitTypes,
    ];
}
