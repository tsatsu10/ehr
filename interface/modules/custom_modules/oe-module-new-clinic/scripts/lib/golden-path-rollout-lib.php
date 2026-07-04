<?php

/**
 * §21 golden path rollout readiness helpers.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

/**
 * @return list<string>
 */
function goldenPathPilotUsernames(): array
{
    return [
        'reception_user',
        'nurse_user',
        'doctor_user',
        'lab_user',
        'pharmacy_user',
        'cashier_user',
    ];
}

/**
 * @return array<string, mixed>
 */
function goldenPathReadinessSnapshot(?int $facilityId = null): array
{
    $facilityId = $facilityId ?? (new VisitScopeService())->resolveDefaultFacilityId();
    $config = new ClinicConfigService();

    $flags = [
        'enable_triage' => $config->isEnabled('enable_triage', 0, $facilityId),
        'enable_lab_role' => $config->isEnabled('enable_lab_role', 0, $facilityId),
        'enable_pharmacy_role' => $config->get('enable_pharmacy_role', '0', $facilityId) === '1',
        'enable_lab_ops' => $config->isEnabled('enable_lab_ops', 0, $facilityId),
        'enable_pharm_ops' => $config->isEnabled('enable_pharm_ops', 0, $facilityId),
        'enable_bill_ops' => $config->isEnabled('enable_bill_ops', 0, $facilityId),
        'enable_scheduled_integration' => $config->isEnabled('enable_scheduled_integration', 0, $facilityId),
    ];

    $missingUsers = [];
    foreach (goldenPathPilotUsernames() as $username) {
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM users WHERE username = ? AND active = 1 LIMIT 1',
            [$username]
        );
        if (!is_array($row) || empty($row['id'])) {
            $missingUsers[] = $username;
        }
    }

    $visitType = QueryUtils::querySingleRow(
        'SELECT id FROM new_visit_type WHERE facility_id = ? AND is_active = 1 ORDER BY id ASC LIMIT 1',
        [$facilityId]
    );
    $visitTypeId = is_array($visitType) ? (int) ($visitType['id'] ?? 0) : 0;

    $coreReady = $flags['enable_triage']
        && $flags['enable_lab_role']
        && $flags['enable_pharmacy_role']
        && $visitTypeId > 0
        && $missingUsers === [];

    return [
        'facility_id' => $facilityId,
        'visit_type_id' => $visitTypeId,
        'flags' => $flags,
        'pilot_users_missing' => $missingUsers,
        'golden_path_ready' => $coreReady,
        'e2e_specs' => [
            'skip_pharmacy' => 'tests/e2e/new-clinic/specs/golden-path.spec.js',
            'pharm_dispense' => 'tests/e2e/new-clinic/specs/golden-path-pharm-dispense.spec.js',
            'lab_close_day' => 'tests/e2e/new-clinic/specs/golden-path-lab-close-day.spec.js',
        ],
        'prd_sections' => [
            '21.1' => 'golden-path.spec.js + golden-path-pharm-dispense.spec.js + golden-path-lab-close-day.spec.js',
            '21.1b' => 'golden-path.spec.js (skip lab/pharm path)',
        ],
    ];
}

function goldenPathRunRollout(): void
{
    require_once __DIR__ . '/pilot-rollout-seed.php';
    require_once __DIR__ . '/golden-path-e2e-prep.php';

    $config = new ClinicConfigService();
    $facilityIds = pharmOpsPilotFacilityIds();
    $defaultFacilityId = (new VisitScopeService())->resolveDefaultFacilityId();

    pilotEnsureNewClinicAclObjects();
    pilotRolloutEnsureProductFlags($config, $facilityIds);
    pharmOpsPilotImportFormularyAndStock($config, $defaultFacilityId);

    goldenPathReleaseStaleDeskWork('doctor_user', 'with_doctor', 'ready_for_doctor');
    goldenPathReleaseStaleDeskWork('pharmacy_user', 'in_pharmacy', 'ready_for_pharmacy');
    goldenPathReleaseStaleDeskWork('lab_user', 'in_lab', 'ready_for_lab');

    goldenPathEnsureDeskSkipAcls();
    goldenPathEnsureBillOpsAcls();
    goldenPathEnsureBillOpsAdminUser();
    goldenPathEnsureClinicalDocConfig($config, $facilityIds);
}
