<?php

/**
 * Drug catalog (formulary) CRUD for the pharm-ops SetupPanel (GAP-C C4, closes W8).
 *
 * The starter-formulary CSV import (PharmOpsFormularyImportService) and the
 * controlled-substance flag editor (PharmDrugMetaService) already exist; the gap
 * was interactive per-drug editing — rename a product, fix its reorder point,
 * add a single item, deactivate one. This provides that over the stock `drugs`
 * table, with form/route/unit sourced from the drug_* list_options (which is why
 * those lists are curated here, not in the Admin Hub lists editor). Stock
 * drug_inventory.php stays as the advanced gateway.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PharmCatalogAdminService
{
    private const LIST_LIMIT = 300;

    /**
     * Catalog payload: drug rows + the option lists that drive the drawer selects.
     *
     * @return array<string, mixed>
     */
    public function getCatalog(string $query = ''): array
    {
        return [
            'drugs' => $this->listDrugs($query),
            'form_options' => $this->listOptions('drug_form'),
            'route_options' => $this->listOptions('drug_route'),
            'unit_options' => $this->listOptions('drug_units'),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function listDrugs(string $query): array
    {
        $query = trim($query);
        $forms = $this->optionTitleMap('drug_form');
        $routes = $this->optionTitleMap('drug_route');
        $units = $this->optionTitleMap('drug_units');

        if ($query !== '') {
            // Escape LIKE metacharacters so '%'/'_' in a term match literally.
            $like = '%' . addcslashes($query, '\\%_') . '%';
            $rows = QueryUtils::fetchRecords(
                "SELECT drug_id, name, form, size, unit, route, reorder_point, ndc_number, active, dispensable
                 FROM drugs
                 WHERE name LIKE ? OR ndc_number LIKE ?
                 ORDER BY active DESC, name ASC
                 LIMIT " . self::LIST_LIMIT,
                [$like, $like]
            ) ?: [];
        } else {
            $rows = QueryUtils::fetchRecords(
                "SELECT drug_id, name, form, size, unit, route, reorder_point, ndc_number, active, dispensable
                 FROM drugs
                 ORDER BY active DESC, name ASC
                 LIMIT " . self::LIST_LIMIT
            ) ?: [];
        }

        return array_map(static function (array $row) use ($forms, $routes, $units): array {
            $form = (string) ($row['form'] ?? '');
            $route = (string) ($row['route'] ?? '');
            $unit = (string) ($row['unit'] ?? '');

            return [
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'form' => $form,
                'form_label' => $forms[$form] ?? $form,
                'size' => (string) ($row['size'] ?? ''),
                'unit' => $unit,
                'unit_label' => $units[$unit] ?? $unit,
                'route' => $route,
                'route_label' => $routes[$route] ?? $route,
                'reorder_point' => round((float) ($row['reorder_point'] ?? 0), 2),
                'ndc_number' => (string) ($row['ndc_number'] ?? ''),
                'active' => (int) ($row['active'] ?? 0) === 1,
                'dispensable' => (int) ($row['dispensable'] ?? 0) === 1,
            ];
        }, $rows);
    }

    /**
     * Add or update a single drug.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function saveDrug(array $input, int $actorUserId): array
    {
        $drugId = (int) ($input['drug_id'] ?? 0);
        $name = mb_substr(trim((string) ($input['name'] ?? '')), 0, 255);
        if ($name === '') {
            throw new \InvalidArgumentException('Drug name is required');
        }
        $form = mb_substr(trim((string) ($input['form'] ?? '')), 0, 31);
        $size = mb_substr(trim((string) ($input['size'] ?? '')), 0, 25);
        $unit = mb_substr(trim((string) ($input['unit'] ?? '')), 0, 31);
        $route = mb_substr(trim((string) ($input['route'] ?? '')), 0, 31);
        $ndc = mb_substr(trim((string) ($input['ndc_number'] ?? '')), 0, 20);
        $reorder = round((float) ($input['reorder_point'] ?? 0), 2);
        if ($reorder < 0) {
            throw new \InvalidArgumentException('Reorder point cannot be negative');
        }
        $active = !empty($input['active']) ? 1 : 0;

        if ($drugId > 0) {
            if (empty($this->getDrugRow($drugId))) {
                throw new \InvalidArgumentException('Drug not found');
            }
            sqlStatement(
                "UPDATE drugs
                 SET name = ?, form = ?, size = ?, unit = ?, route = ?, ndc_number = ?, reorder_point = ?, active = ?
                 WHERE drug_id = ?",
                [$name, $form, $size, $unit, $route, $ndc, $reorder, $active, $drugId]
            );
            $action = 'updated';
        } else {
            $drugId = (int) QueryUtils::sqlInsert(
                "INSERT INTO drugs
                 (name, form, size, unit, route, ndc_number, reorder_point, active, dispensable, allow_multiple)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)",
                [$name, $form, $size, $unit, $route, $ndc, $reorder, $active]
            );
            $action = 'created';
        }

        EventAuditLogger::getInstance()->newEvent(
            'pharmacy_ops.catalog_edit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            $action . ' drug_id=' . $drugId . ' name=' . $name . ' uid=' . $actorUserId
        );

        return $this->getCatalog('');
    }

    /**
     * @return array<string, mixed>|null
     */
    private function getDrugRow(int $drugId): ?array
    {
        $row = QueryUtils::querySingleRow("SELECT drug_id, active FROM drugs WHERE drug_id = ?", [$drugId]);

        return empty($row) ? null : $row;
    }

    /**
     * Active options of a list as [{value,label}] for a select.
     *
     * @return array<int, array<string, string>>
     */
    private function listOptions(string $listId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title FROM list_options WHERE list_id = ? AND activity = 1 ORDER BY seq, title",
            [$listId]
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'value' => (string) ($row['option_id'] ?? ''),
                'label' => (string) ($row['title'] ?? $row['option_id'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * @return array<string, string> option_id => title (incl. inactive, for display)
     */
    private function optionTitleMap(string $listId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title FROM list_options WHERE list_id = ?",
            [$listId]
        ) ?: [];
        $map = [];
        foreach ($rows as $row) {
            $map[(string) ($row['option_id'] ?? '')] = (string) ($row['title'] ?? '');
        }

        return $map;
    }
}
