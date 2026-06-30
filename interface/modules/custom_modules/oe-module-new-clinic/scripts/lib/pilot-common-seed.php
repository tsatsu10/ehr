<?php

/**
 * Shared pilot CLI helpers (facility ids, ACL install) — used by rollout + hub/pharm scripts.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

/**
 * @return list<int> facility ids to configure (0 + default service location)
 */
function pilotFacilityIds(): array
{
    $facilityIds = [0];
    $defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();
    if ($defaultFacilityId > 0) {
        $facilityIds[] = $defaultFacilityId;
    }

    return array_values(array_unique($facilityIds));
}

/**
 * Install missing new_clinic ACL objects when pilot scripts run on an existing DB.
 */
function pilotEnsureNewClinicAclObjects(): void
{
    $required = [
        'new_pharm_ops_receive',
        'new_pharm_ops_destroy',
        'new_pharmacy_lead',
        'new_reports_hub',
        'new_reports_clinical',
    ];
    foreach ($required as $aco) {
        $row = QueryUtils::querySingleRow(
            "SELECT value FROM gacl_aco WHERE section_value = 'new_clinic' AND value = ? LIMIT 1",
            [$aco]
        );
        if (!empty($row)) {
            continue;
        }

        $aclSetupFlag = true;
        include dirname(__DIR__, 2) . '/acl/acl_setup.php';
        echo "Installed missing new_clinic ACL objects via acl_setup.php.\n";
        return;
    }
}
