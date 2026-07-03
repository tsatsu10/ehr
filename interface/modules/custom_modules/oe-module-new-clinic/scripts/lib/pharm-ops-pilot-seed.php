<?php

/**
 * Shared pharm ops pilot seed helpers (E2E prep + pilot-enable CLI).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Acl\AclExtended;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Gacl\GaclApi;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsFormularyImportService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

/**
 * @return list<int> facility ids to configure (0 + default service location)
 */
function pharmOpsPilotFacilityIds(): array
{
    require_once __DIR__ . '/pilot-common-seed.php';

    return pilotFacilityIds();
}

/**
 * Enable pharmacy desk role for pilot facilities.
 */
function pharmOpsPilotEnablePharmacyRole(ClinicConfigService $config, ?array $facilityIds = null): void
{
    foreach ($facilityIds ?? pharmOpsPilotFacilityIds() as $facilityId) {
        $config->set('enable_pharmacy_role', '1', $facilityId);
        echo "Enabled enable_pharmacy_role for facility {$facilityId}.\n";
    }
}

function pharmOpsPilotEnsureInhousePharmacyGlobal(): void
{
    $current = pharmOpsPilotReadGlobal('inhouse_pharmacy');
    if ($current === '1' || $current === '2' || $current === '3') {
        echo "inhouse_pharmacy already enabled ({$current}).\n";
        return;
    }

    pharmOpsPilotWriteGlobal('inhouse_pharmacy', '1');
    echo "Set inhouse_pharmacy global to 1.\n";
}

/**
 * @param list<int> $facilityIds
 */
function pharmOpsPilotEnsureHubConfig(ClinicConfigService $config, ?array $facilityIds = null): void
{
    $keys = [
        'enable_pharm_ops' => '1',
        'enable_pharm_rx_favorites' => '1',
        'enable_dispense_label' => '1',
        'enable_rx_print' => '1',
    ];

    foreach ($facilityIds ?? pharmOpsPilotFacilityIds() as $facilityId) {
        foreach ($keys as $key => $value) {
            $config->set($key, $value, $facilityId);
            echo "Set {$key}={$value} for facility {$facilityId}.\n";
        }
    }
}

function pharmOpsPilotImportFormularyAndStock(ClinicConfigService $config, ?int $facilityId = null): void
{
    $facilityId = $facilityId ?? (new VisitScopeService())->resolveDefaultFacilityId();
    $actorUserId = pharmOpsPilotResolveActorUserId();
    $import = new PharmOpsFormularyImportService();
    $path = PharmOpsFormularyImportService::starterCsvPath();

    if (!is_readable($path)) {
        echo "Starter formulary CSV missing at {$path} — skip formulary seed.\n";
        return;
    }

    $result = $import->importCsvContent((string) file_get_contents($path), $actorUserId);
    echo sprintf(
        "Formulary import: imported=%d updated=%d skipped=%d drug_count=%d.\n",
        (int) ($result['imported'] ?? 0),
        (int) ($result['updated'] ?? 0),
        (int) ($result['skipped'] ?? 0),
        (int) ($result['drug_count'] ?? 0)
    );

    $warehouseId = pharmOpsPilotEnsureWarehouse($config, $facilityId);
    if ($warehouseId === '') {
        echo "No warehouse available — skip stock seed.\n";
        return;
    }

    $drugRow = QueryUtils::querySingleRow(
        "SELECT drug_id FROM drugs WHERE name = 'Paracetamol' AND active = 1 AND dispensable = 1 LIMIT 1"
    );
    $drugId = is_array($drugRow) ? (int) ($drugRow['drug_id'] ?? 0) : 0;
    if ($drugId <= 0) {
        echo "Paracetamol not found after formulary import — skip stock seed.\n";
        return;
    }

    pharmOpsPilotSeedDrugStock($drugId, $warehouseId, 500.0, 'PILOT-GP-LOT1', $actorUserId);
    echo "Seeded Paracetamol stock (drug_id={$drugId}, warehouse={$warehouseId}).\n";

    pharmOpsPilotSeedWriteOffLot($config, $facilityId);
}

/**
 * Seed an expiring Paracetamol lot for Pharm Ops write-off E2E / UAT.
 */
function pharmOpsPilotSeedWriteOffLot(ClinicConfigService $config, ?int $facilityId = null): void
{
    $facilityId = $facilityId ?? (new VisitScopeService())->resolveDefaultFacilityId();
    $warehouseId = pharmOpsPilotEnsureWarehouse($config, $facilityId);
    if ($warehouseId === '') {
        echo "No warehouse — skip write-off lot seed.\n";
        return;
    }

    $drugRow = QueryUtils::querySingleRow(
        "SELECT drug_id FROM drugs WHERE name = 'Paracetamol' AND active = 1 AND dispensable = 1 LIMIT 1"
    );
    $drugId = is_array($drugRow) ? (int) ($drugRow['drug_id'] ?? 0) : 0;
    if ($drugId <= 0) {
        echo "Paracetamol not found — skip write-off lot seed.\n";
        return;
    }

    $lotNumber = 'E2E-WRITEOFF-LOT';
    $expiration = date('Y-m-d', strtotime('+14 days'));
    $actorUserId = pharmOpsPilotResolveActorUserId();

    $destroyed = QueryUtils::querySingleRow(
        'SELECT inventory_id FROM drug_inventory
         WHERE drug_id = ? AND warehouse_id = ? AND lot_number = ? AND destroy_date IS NOT NULL
         LIMIT 1',
        [$drugId, $warehouseId, $lotNumber]
    );
    if (is_array($destroyed)) {
        QueryUtils::sqlInsert(
            'INSERT INTO drug_inventory (drug_id, lot_number, manufacturer, expiration, vendor_id, warehouse_id, on_hand)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$drugId, $lotNumber, 'Pilot Seed', $expiration, '', $warehouseId, 10.0]
        );
        echo "Re-seeded write-off lot {$lotNumber} (prior lot destroyed).\n";
        return;
    }

    $active = QueryUtils::querySingleRow(
        'SELECT inventory_id, expiration FROM drug_inventory
         WHERE drug_id = ? AND warehouse_id = ? AND lot_number = ? AND destroy_date IS NULL
         LIMIT 1',
        [$drugId, $warehouseId, $lotNumber]
    );
    if (is_array($active)) {
        sqlStatement(
            'UPDATE drug_inventory SET expiration = ?, on_hand = ? WHERE inventory_id = ?',
            [$expiration, 10.0, (int) ($active['inventory_id'] ?? 0)]
        );
        echo "Refreshed write-off lot {$lotNumber} expiry to {$expiration}.\n";
        return;
    }

    pharmOpsPilotSeedDrugStock($drugId, $warehouseId, 10.0, $lotNumber, $actorUserId, $expiration);
    echo "Seeded write-off lot {$lotNumber} (expires {$expiration}).\n";
}

function pharmOpsPilotResolveActorUserId(): int
{
    foreach (['pharmacy_lead_user', 'pharmacy_user', 'admin', 'doctor_user'] as $username) {
        $row = QueryUtils::querySingleRow('SELECT id FROM users WHERE username = ? LIMIT 1', [$username]);
        $id = is_array($row) ? (int) ($row['id'] ?? 0) : 0;
        if ($id > 0) {
            return $id;
        }
    }

    return 1;
}

function pharmOpsPilotEnsureWarehouse(ClinicConfigService $config, int $facilityId): string
{
    $row = QueryUtils::querySingleRow(
        "SELECT option_id, title FROM list_options
         WHERE list_id = 'warehouse' AND activity = 1
         ORDER BY seq, title, option_id
         LIMIT 1"
    );
    if (is_array($row)) {
        $warehouseId = trim((string) ($row['option_id'] ?? ''));
        if ($warehouseId !== '' && $facilityId > 0) {
            $configured = trim((string) $config->get('pharm_default_warehouse_id', '', $facilityId));
            if ($configured === '') {
                $config->set('pharm_default_warehouse_id', $warehouseId, $facilityId);
            }
        }

        return $warehouseId;
    }

    $title = 'Pilot Dispensary';
    $optionId = $facilityId > 0 ? 'nc_pilot_wh_' . $facilityId : 'nc_pilot_wh';
    $optionId = mb_substr($optionId, 0, 31);

    QueryUtils::sqlInsert(
        "INSERT INTO list_options (list_id, option_id, title, seq, activity) VALUES ('warehouse', ?, ?, 5, 1)",
        [$optionId, $title]
    );

    if ($facilityId > 0) {
        $config->set('pharm_default_warehouse_id', $optionId, $facilityId);
    }

    echo "Created pilot warehouse {$optionId}.\n";

    return $optionId;
}

function pharmOpsPilotSeedDrugStock(
    int $drugId,
    string $warehouseId,
    float $quantity,
    string $lotNumber,
    int $actorUserId,
    ?string $expiration = null
): void {
    $expiration = $expiration ?? date('Y-m-d', strtotime('+2 years'));

    $existing = QueryUtils::querySingleRow(
        'SELECT inventory_id, on_hand
         FROM drug_inventory
         WHERE drug_id = ?
           AND warehouse_id = ?
           AND lot_number = ?
           AND destroy_date IS NULL
         ORDER BY inventory_id DESC
         LIMIT 1',
        [$drugId, $warehouseId, $lotNumber]
    );

    if (is_array($existing)) {
        $lotId = (int) ($existing['inventory_id'] ?? 0);
        $onHand = (float) ($existing['on_hand'] ?? 0);
        if ($onHand >= $quantity) {
            return;
        }

        sqlStatement(
            'UPDATE drug_inventory SET on_hand = ? WHERE inventory_id = ?',
            [$quantity, $lotId]
        );

        return;
    }

    $lotId = (int) QueryUtils::sqlInsert(
        'INSERT INTO drug_inventory (drug_id, lot_number, manufacturer, expiration, vendor_id, warehouse_id, on_hand)
         VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            $drugId,
            $lotNumber,
            'Pilot Seed',
            $expiration,
            '',
            $warehouseId,
            $quantity,
        ]
    );

    QueryUtils::sqlInsert(
        'INSERT INTO drug_sales (
            drug_id, inventory_id, prescription_id, pid, encounter, user, sale_date,
            quantity, fee, xfer_inventory_id, distributor_id, notes, trans_type
         ) VALUES (?, ?, 0, 0, 0, ?, ?, ?, 0, 0, 0, ?, 2)',
        [
            $drugId,
            $lotId,
            'pilot_seed',
            date('Y-m-d'),
            (0 - $quantity),
            'Pilot pharm ops stock seed (actor=' . $actorUserId . ')',
        ]
    );
}

function pharmOpsPilotReadGlobal(string $key): string
{
    $row = QueryUtils::querySingleRow(
        'SELECT gl_value FROM globals WHERE gl_name = ? AND gl_index = 0',
        [$key]
    );

    if (!is_array($row) || !array_key_exists('gl_value', $row)) {
        return '';
    }

    return (string) $row['gl_value'];
}

function pharmOpsPilotWriteGlobal(string $key, string $value): void
{
    sqlStatement(
        'INSERT INTO globals (gl_name, gl_index, gl_value) VALUES (?, 0, ?)
         ON DUPLICATE KEY UPDATE gl_value = VALUES(gl_value)',
        [$key, $value]
    );

    global $GLOBALS;
    $GLOBALS[$key] = $value;
}

function pharmOpsPilotGrantPharmacyAcl(string $aco, string $acoTitle): void
{
    $gacl = new GaclApi();
    $aclIds = $gacl->search_acl(
        false,
        false,
        false,
        false,
        'New Clinic Pharmacy',
        false,
        false,
        false,
        'write'
    );
    if (empty($aclIds) || !is_array($aclIds)) {
        echo "New Clinic Pharmacy write ACL not found — run acl/seed_pilot_users.php\n";
        return;
    }

    AclExtended::updateAcl(
        $aclIds,
        'New Clinic Pharmacy',
        'new_clinic',
        'New Clinic',
        $aco,
        $acoTitle,
        'write'
    );

    echo "Granted {$aco} to New Clinic Pharmacy.\n";
}

/**
 * Ensure pharmacy lead can receive stock in Pharm Ops hub (idempotent GACL grant).
 */
function pharmOpsPilotEnsureAclObjects(): void
{
    require_once __DIR__ . '/pilot-common-seed.php';

    pilotEnsureNewClinicAclObjects();
}

/**
 * Ensure pharmacy lead can receive stock in Pharm Ops hub (idempotent GACL grant).
 */
function pharmOpsPilotEnsureLeadAcls(): void
{
    pharmOpsPilotEnsureAclObjects();

    $gacl = new GaclApi();
    $aclIds = $gacl->search_acl(
        false,
        false,
        false,
        false,
        'New Clinic Pharmacy Lead',
        false,
        false,
        false,
        'write'
    );
    if (empty($aclIds) || !is_array($aclIds)) {
        echo "New Clinic Pharmacy Lead write ACL not found — run acl/seed_pilot_users.php\n";
        return;
    }

    AclExtended::updateAcl(
        $aclIds,
        'New Clinic Pharmacy Lead',
        'new_clinic',
        'New Clinic',
        'new_pharm_ops_receive',
        'Pharmacy Operations Receive Stock',
        'write'
    );

    AclExtended::updateAcl(
        $aclIds,
        'New Clinic Pharmacy Lead',
        'new_clinic',
        'New Clinic',
        'new_pharm_ops_destroy',
        'Pharmacy Operations Destroy Lot',
        'write'
    );

    AclExtended::updateAcl(
        $aclIds,
        'New Clinic Pharmacy Lead',
        'new_clinic',
        'New Clinic',
        'new_pharmacy_lead',
        'New Clinic Pharmacy Lead',
        'write'
    );

    echo "Granted pharmacy lead ACLs (receive, destroy, lead tier).\n";
}
