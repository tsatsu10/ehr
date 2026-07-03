<?php

/**
 * Shared lab ops pilot seed helpers (E2E prep + pilot-enable CLI).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\LabOpsFeeMapService;
use OpenEMR\Modules\NewClinic\Services\LabOpsPanelImportService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

/**
 * @return list<int>
 */
function labOpsPilotFacilityIds(): array
{
    require_once __DIR__ . '/pilot-common-seed.php';

    return pilotFacilityIds();
}

function labOpsPilotEnableLabRole(ClinicConfigService $config, ?array $facilityIds = null): void
{
    foreach ($facilityIds ?? labOpsPilotFacilityIds() as $facilityId) {
        $config->set('enable_lab_role', '1', $facilityId);
        echo "Enabled enable_lab_role for facility {$facilityId}.\n";
    }
}

/**
 * @param list<int> $facilityIds
 */
function labOpsPilotEnsureHubConfig(ClinicConfigService $config, ?array $facilityIds = null): void
{
    $keys = [
        'enable_lab_ops' => '1',
        'enable_lab_panel_order' => '1',
        'enable_react_lab_ops' => '1',
        'lab_setup_model' => 'in_house',
    ];

    foreach ($facilityIds ?? labOpsPilotFacilityIds() as $facilityId) {
        foreach ($keys as $key => $value) {
            $config->set($key, $value, $facilityId);
            echo "Set {$key}={$value} for facility {$facilityId}.\n";
        }
    }
}

function labOpsPilotResolveActorUserId(): int
{
    foreach (['Adminstrator', 'admin', 'lab_user', 'doctor_user'] as $username) {
        $row = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ? LIMIT 1', [$username]);
        $id = is_array($row) ? (int) ($row['id'] ?? 0) : 0;
        if ($id > 0) {
            return $id;
        }
    }

    return 1;
}

function labOpsPilotFindOrCreateProvider(string $providerLabel, string $type): int
{
    $existing = QueryUtils::querySingleRow(
        'SELECT ppid FROM procedure_providers WHERE name = ? AND type = ? ORDER BY ppid DESC LIMIT 1',
        [$providerLabel, $type]
    );
    if (is_array($existing) && !empty($existing['ppid'])) {
        return (int) $existing['ppid'];
    }

    return (int) QueryUtils::sqlInsert(
        "INSERT INTO procedure_providers (name, npi, protocol, type, active)
         VALUES (?, '', 'DL', ?, 1)",
        [$providerLabel, $type]
    );
}

function labOpsPilotImportStarterPanel(ClinicConfigService $config, ?int $facilityId = null): void
{
    $facilityId = $facilityId ?? (new VisitScopeService())->resolveDefaultFacilityId();
    $clinicName = (string) ($GLOBALS['openemr_name'] ?? 'Pilot Clinic');
    $providerLabel = mb_substr(trim($clinicName) . ' Lab', 0, 255);
    $providerId = labOpsPilotFindOrCreateProvider($providerLabel, 'inhouse');

    $config->set('lab_inhouse_provider_id', (string) $providerId, 0);
    if ($facilityId > 0) {
        $config->set('lab_inhouse_provider_id', (string) $providerId, $facilityId);
    }

    $actorUserId = labOpsPilotResolveActorUserId();
    $countRow = QueryUtils::querySingleRow(
        "SELECT COUNT(*) AS cnt FROM procedure_type
         WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1",
        [$providerId]
    );
    $testCount = is_array($countRow) ? (int) ($countRow['cnt'] ?? 0) : 0;

    if ($testCount < 5) {
        $import = new LabOpsPanelImportService();
        $result = $import->importStarterPack($providerId, $actorUserId);
        echo sprintf(
            "Lab panel import: orders=%d results=%d skipped=%d provider_id=%d.\n",
            (int) ($result['imported_orders'] ?? 0),
            (int) ($result['imported_results'] ?? 0),
            (int) ($result['skipped'] ?? 0),
            $providerId
        );
    } else {
        echo "Starter lab panel already present ({$testCount} order types) for provider {$providerId}.\n";
    }

    $feeMap = new LabOpsFeeMapService();
    $feeResult = $feeMap->applyStarterDefaults($facilityId, $providerId, $actorUserId);
    echo sprintf(
        "Lab fee defaults: saved=%d errors=%d.\n",
        (int) ($feeResult['saved'] ?? 0),
        count($feeResult['errors'] ?? [])
    );
}
