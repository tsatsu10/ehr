<?php

/**
 * M13-F06 — pharmacy setup wizard (warehouse + starter formulary)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmOpsSetupService
{
    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly PharmOpsFormularyImportService $formularyImport = new PharmOpsFormularyImportService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getSetupStatus(): array
    {
        $this->access->assertHubAccess();

        if (!$this->access->isInhousePharmacyEnabled()) {
            throw new \RuntimeException('Pharmacy setup requires in-house pharmacy to be enabled', 403);
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $warehouses = $this->loadWarehouses();
        $drugCount = $this->formularyImport->countActiveDispensableDrugs();
        $inhouseLevel = (int) ($GLOBALS['inhouse_pharmacy'] ?? 0);
        $moduleUrl = ($GLOBALS['webroot'] ?? '')
            . '/interface/modules/custom_modules/oe-module-new-clinic/public';

        return [
            'facility_id' => $facilityId,
            'inhouse_pharmacy' => $inhouseLevel,
            'inhouse_pharmacy_label' => $this->inhousePharmacyLabel($inhouseLevel),
            'warehouse_count' => count($warehouses),
            'warehouses' => $warehouses,
            'default_warehouse_id' => $this->resolveDefaultWarehouseId($warehouses, $facilityId),
            'drug_count' => $drugCount,
            'has_starter_formulary' => $drugCount >= 10,
            'starter_csv_available' => is_readable(PharmOpsFormularyImportService::starterCsvPath()),
            'can_manage_catalog' => $this->access->canManageCatalog(),
            'admin_hub_url' => $moduleUrl . '/admin.php',
            'fee_schedule_hint' => 'Map drug fees in Clinic Setup → Fee schedule after import.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function createDefaultWarehouse(string $warehouseTitle, int $actorUserId): array
    {
        $this->access->assertCatalogAccess();

        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $title = trim($warehouseTitle);
        if ($title === '') {
            $title = $this->facilityName($facilityId) . ' Dispensary';
        }
        $title = mb_substr($title, 0, 255);

        $existing = $this->loadWarehouses();
        foreach ($existing as $warehouse) {
            if (strcasecmp((string) ($warehouse['title'] ?? ''), $title) === 0) {
                return [
                    'warehouse_id' => (string) ($warehouse['id'] ?? ''),
                    'warehouse_title' => (string) ($warehouse['title'] ?? ''),
                    'created' => false,
                    'setup_status' => $this->getSetupStatus(),
                ];
            }
        }

        $optionId = $this->buildWarehouseOptionId($title, $facilityId);
        $seqRow = QueryUtils::querySingleRow(
            "SELECT COALESCE(MAX(seq), 0) + 5 AS next_seq FROM list_options WHERE list_id = 'warehouse'"
        );
        $seq = is_array($seqRow) ? (int) ($seqRow['next_seq'] ?? 5) : 5;

        QueryUtils::sqlInsert(
            "INSERT INTO list_options (list_id, option_id, title, seq, activity) VALUES ('warehouse', ?, ?, ?, 1)",
            [$optionId, $title, $seq]
        );
        $this->config->set('pharm_default_warehouse_id', $optionId, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.warehouse_created',
            $actorUserId,
            1,
            'warehouse_id=' . $optionId . ' facility_id=' . $facilityId
        );

        return [
            'warehouse_id' => $optionId,
            'warehouse_title' => $title,
            'created' => true,
            'setup_status' => $this->getSetupStatus(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function importStarterFormulary(?string $csvContent, int $actorUserId): array
    {
        $this->access->assertCatalogAccess();

        if ($csvContent === null || trim($csvContent) === '') {
            $path = PharmOpsFormularyImportService::starterCsvPath();
            if (!is_readable($path)) {
                throw new \RuntimeException('Starter formulary CSV is not available');
            }
            $csvContent = (string) file_get_contents($path);
        }

        $result = $this->formularyImport->importCsvContent($csvContent, $actorUserId);

        return array_merge($result, [
            'setup_status' => $this->getSetupStatus(),
        ]);
    }

    private function inhousePharmacyLabel(int $level): string
    {
        return match ($level) {
            1 => 'Products only',
            2 => 'Dispensary drugs',
            3 => 'Commercial pharmacy',
            default => 'Off',
        };
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function loadWarehouses(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title
             FROM list_options
             WHERE list_id = 'warehouse' AND activity = 1
             ORDER BY seq, title, option_id"
        ) ?: [];

        $warehouses = [];
        foreach ($rows as $row) {
            $id = trim((string) ($row['option_id'] ?? ''));
            if ($id === '') {
                continue;
            }
            $warehouses[] = [
                'id' => $id,
                'title' => trim((string) ($row['title'] ?? $id)),
            ];
        }

        return $warehouses;
    }

    /**
     * @param array<int, array<string, string>> $warehouses
     */
    private function resolveDefaultWarehouseId(array $warehouses, int $facilityId): string
    {
        $configured = trim((string) $this->config->get('pharm_default_warehouse_id', '', $facilityId));
        if ($configured !== '') {
            foreach ($warehouses as $warehouse) {
                if ((string) ($warehouse['id'] ?? '') === $configured) {
                    return $configured;
                }
            }
        }

        $globalWarehouse = trim((string) ($GLOBALS['gbl_warehouse_id'] ?? ''));
        if ($globalWarehouse !== '') {
            foreach ($warehouses as $warehouse) {
                if ((string) ($warehouse['id'] ?? '') === $globalWarehouse) {
                    return $globalWarehouse;
                }
            }
        }

        return (string) ($warehouses[0]['id'] ?? '');
    }

    private function facilityName(int $facilityId): string
    {
        if ($facilityId <= 0) {
            return (string) ($GLOBALS['openemr_name'] ?? 'Clinic');
        }

        $row = QueryUtils::querySingleRow('SELECT name FROM facility WHERE id = ? LIMIT 1', [$facilityId]);

        return is_array($row) && trim((string) ($row['name'] ?? '')) !== ''
            ? trim((string) $row['name'])
            : (string) ($GLOBALS['openemr_name'] ?? 'Clinic');
    }

    private function buildWarehouseOptionId(string $title, int $facilityId): string
    {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $title) ?? '');
        $slug = trim($slug, '_');
        if ($slug === '') {
            $slug = 'warehouse';
        }
        $base = 'nc_' . mb_substr($slug, 0, 20);
        if ($facilityId > 0) {
            $base .= '_' . $facilityId;
        }

        $candidate = mb_substr($base, 0, 31);
        $exists = QueryUtils::querySingleRow(
            "SELECT option_id FROM list_options WHERE list_id = 'warehouse' AND option_id = ? LIMIT 1",
            [$candidate]
        );
        if (!is_array($exists)) {
            return $candidate;
        }

        return mb_substr($base . '_' . substr(sha1($title), 0, 6), 0, 31);
    }
}
