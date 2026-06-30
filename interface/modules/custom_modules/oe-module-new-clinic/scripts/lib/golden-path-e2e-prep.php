<?php

/**
 * Shared golden-path E2E prep helpers (desk release, bill ops, ACL grants).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Gacl\GaclApi;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

/**
 * @param 'with_doctor'|'in_pharmacy'|'in_lab' $activeState
 * @param 'ready_for_doctor'|'ready_for_pharmacy'|'ready_for_lab' $releaseState
 */
function goldenPathReleaseStaleDeskWork(string $username, string $activeState, string $releaseState): void
{
    $user = sqlQuery("SELECT id FROM users WHERE username = ? LIMIT 1", [$username]);
    $userId = (int) ($user['id'] ?? 0);
    if ($userId <= 0) {
        echo "{$username} not found — skip {$activeState} release\n";
        return;
    }

    sqlStatement(
        "UPDATE new_visit SET state = ?, assigned_provider_id = NULL "
        . "WHERE assigned_provider_id = ? AND visit_date = CURDATE() AND state = ?",
        [$releaseState, $userId, $activeState]
    );

    echo "Released stale {$activeState} visits for {$username} (id {$userId}).\n";
}

/**
 * @param list<int> $facilityIds
 */
function goldenPathEnsureBillOpsConfig(ClinicConfigService $config, ?array $facilityIds = null): void
{
    foreach ($facilityIds ?? pharmOpsPilotFacilityIds() as $facilityId) {
        $config->set('enable_bill_ops', '1', $facilityId);
        echo "Set enable_bill_ops=1 for facility {$facilityId}.\n";
    }
}

function goldenPathGrantAclToGroup(string $groupTitle, string $aco, string $acoTitle): void
{
    $gacl = new GaclApi();
    $aclIds = $gacl->search_acl(
        false,
        false,
        false,
        false,
        $groupTitle,
        false,
        false,
        false,
        'write'
    );
    if (empty($aclIds) || !is_array($aclIds)) {
        echo "{$groupTitle} write ACL not found — run acl/seed_pilot_users.php\n";
        return;
    }

    AclExtended::updateAcl(
        $aclIds,
        $groupTitle,
        'new_clinic',
        'New Clinic',
        $aco,
        $acoTitle,
        'write'
    );

    echo "Granted {$aco} to {$groupTitle}.\n";
}

function goldenPathEnsureDeskSkipAcls(): void
{
    goldenPathGrantAclToGroup('New Clinic Pharmacy', 'new_visit_skip_queue', 'Skip Lab/Pharmacy Queue');
    goldenPathGrantAclToGroup('New Clinic Pharmacy', 'new_esign_skip_complete', 'Skip E-Sign Gate');
    goldenPathGrantAclToGroup('New Clinic Lab', 'new_visit_skip_queue', 'Skip Lab/Pharmacy Queue');
    goldenPathGrantAclToGroup('New Clinic Lab', 'new_esign_skip_complete', 'Skip E-Sign Gate');
}

function goldenPathEnsureBillOpsAcls(): void
{
    goldenPathGrantAclToGroup('New Clinic Cashier Lead', 'new_bill_ops', 'Billing Back Office Hub');
    goldenPathGrantAclToGroup('New Clinic Cashier Lead', 'new_bill_ops_close', 'Billing Close Day');
}
