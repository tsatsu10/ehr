<?php

/**
 * Shared pilot rollout product-flag helpers (facility 0 + default clinic).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;

require_once __DIR__ . '/pharm-ops-pilot-seed.php';
require_once __DIR__ . '/pilot-common-seed.php';
require_once __DIR__ . '/golden-path-e2e-prep.php';

/**
 * Enable V1 pilot product flags (desks, hubs, chart depth, comms, billing).
 *
 * @param list<int>|null $facilityIds
 */
function pilotRolloutEnsureProductFlags(ClinicConfigService $config, ?array $facilityIds = null): void
{
    $facilityIds = $facilityIds ?? pilotFacilityIds();

    $flags = [
        'enable_triage' => '1',
        'enable_scheduled_integration' => '1',
        'enable_scheduling_redesign' => '1',
        'enable_react_scheduling' => '1',
        'enable_lab_role' => '1',
        'enable_lab_ops' => '1',
        'communications_hub_enable' => '1',
        'enable_patient_registry' => '1',
        'enable_chart_depth' => '1',
        'enable_chart_depth_finance' => '1',
        'enable_chart_depth_referral' => '1',
        'enable_chart_depth_export' => '1',
        'enable_bill_ops' => '1',
        'enable_bill_ops_outstanding' => '1',
        'enable_report_hub' => '1',
        'enable_queue_bridge' => '1',
        'enable_legacy_patient_context_overlay' => '1',
        'enable_admin_hub' => '1',
        'enable_clinical_doc_hub' => '1',
        'enable_multi_doctor_filters' => '1',
        'enable_doctor_roster' => '1',
        'enable_advisory_routing' => '1',
    ];

    foreach ($facilityIds as $facilityId) {
        foreach ($flags as $key => $value) {
            $config->set($key, $value, $facilityId);
            echo "Set {$key}={$value} for facility {$facilityId}.\n";
        }
    }

    pharmOpsPilotEnablePharmacyRole($config, $facilityIds);
    pharmOpsPilotEnsureInhousePharmacyGlobal();
    pharmOpsPilotEnsureHubConfig($config, $facilityIds);
    goldenPathEnsureBillOpsConfig($config, $facilityIds);
}
