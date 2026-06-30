<?php

/**
 * M13 Pharmacy Operations Hub — OTC counter sale (no prescriptions row)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\DrugSalesService;

class PharmOpsOtcSaleService
{
    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly PharmOpsInventoryPreviewService $inventoryPreview = new PharmOpsInventoryPreviewService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function searchDrugs(string $query, int $limit = 20): array
    {
        $this->access->assertHubAccess();

        $query = trim($query);
        if (mb_strlen($query) < 2) {
            return ['rows' => [], 'query' => $query];
        }

        $limit = max(1, min($limit, 50));
        $like = '%' . $query . '%';
        $rows = QueryUtils::fetchRecords(
            "SELECT d.drug_id, d.name, d.size, d.unit, d.reorder_point,
                    COALESCE(inv.on_hand, 0) AS on_hand
             FROM drugs d
             LEFT JOIN (
                 SELECT drug_id, SUM(on_hand) AS on_hand
                 FROM drug_inventory
                 WHERE destroy_date IS NULL
                 GROUP BY drug_id
             ) inv ON inv.drug_id = d.drug_id
             WHERE d.active = 1
               AND d.dispensable = 1
               AND d.name LIKE ?
             ORDER BY d.name ASC, d.drug_id ASC
             LIMIT " . (int) $limit,
            [$like]
        ) ?: [];

        $mapped = [];
        foreach ($rows as $row) {
            $drugId = (int) ($row['drug_id'] ?? 0);
            if ($drugId <= 0) {
                continue;
            }
            $onHand = (float) ($row['on_hand'] ?? 0);
            $mapped[] = [
                'drug_id' => $drugId,
                'drug_name' => self::formatDrugLabel($row),
                'on_hand' => (int) round($onHand),
                'stock_status' => PharmOpsWorklistService::classifyReorderStatus(
                    $onHand,
                    (float) ($row['reorder_point'] ?? 0)
                ),
            ];
        }

        return [
            'query' => $query,
            'rows' => $mapped,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getSaleForm(int $pid, int $drugId, ?int $encounterId = null): array
    {
        $this->access->assertHubAccess();
        $this->facilityScope->assertPatientAccessible($pid);

        if ($drugId <= 0) {
            throw new \InvalidArgumentException('Select a product');
        }

        $patient = $this->loadPatientRow($pid);
        $drug = $this->loadDrugRow($drugId);
        $encounter = $this->resolveEncounterContext($pid, $encounterId);
        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $drugName = self::formatDrugLabel($drug);
        $allergies = $this->loadAllergies($pid);
        $inventory = $this->inventoryPreview->previewForDrug($drugId, 1);
        $unitFee = $this->resolveUnitFee($drugId, $facilityId);

        return [
            'pid' => $pid,
            'encounter_id' => $encounter['encounter_id'],
            'patient' => [
                'display_name' => trim(($patient['fname'] ?? '') . ' ' . ($patient['lname'] ?? '')),
                'patient_label' => $this->formatPatientLabel(
                    (string) ($patient['fname'] ?? ''),
                    (string) ($patient['lname'] ?? '')
                ),
                'mrn' => (string) ($patient['pubpid'] ?? ''),
            ],
            'visit' => [
                'visit_id' => $encounter['visit_id'],
                'queue_number' => $encounter['queue_number'],
                'visit_date' => $encounter['visit_date'],
            ],
            'drug' => [
                'drug_id' => $drugId,
                'drug_name' => $drugName,
                'default_quantity' => 1,
            ],
            'inventory' => $inventory,
            'fee' => [
                'amount' => round($unitFee, 2),
                'unit_amount' => $unitFee,
                'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
            ],
            'safety' => [
                'allergies' => $allergies,
                'allergy_warning' => PharmOpsSafetyService::hasDrugAllergyWarning($drugName, $allergies),
            ],
            'encounter_required' => $encounter['encounter_id'] <= 0,
            'encounter_warning' => $encounter['encounter_id'] <= 0
                ? 'Start a visit for this patient before selling OTC.'
                : null,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function confirmSale(array $body, int $actorUserId): array
    {
        $this->access->assertDispenseAccess();

        $pid = (int) ($body['pid'] ?? 0);
        $drugId = (int) ($body['drug_id'] ?? 0);
        $encounterId = (int) ($body['encounter_id'] ?? 0);
        $quantity = (float) ($body['quantity'] ?? 0);
        $fee = (float) ($body['fee'] ?? 0);

        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
        if ($drugId <= 0) {
            throw new \InvalidArgumentException('Product is required');
        }
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Sale quantity must be greater than zero');
        }
        if ($fee < 0) {
            throw new \InvalidArgumentException('Fee cannot be negative');
        }

        $this->facilityScope->assertPatientAccessible($pid);
        $drug = $this->loadDrugRow($drugId);
        $drugName = self::formatDrugLabel($drug);
        $encounter = $this->resolveEncounterContext($pid, $encounterId > 0 ? $encounterId : null);
        $resolvedEncounterId = (int) ($encounter['encounter_id'] ?? 0);
        if ($resolvedEncounterId <= 0) {
            throw new \InvalidArgumentException('Start a visit for this patient before selling OTC');
        }

        $allergies = $this->loadAllergies($pid);
        if (PharmOpsSafetyService::hasDrugAllergyWarning($drugName, $allergies) && empty($body['allergy_acknowledged'])) {
            throw new \InvalidArgumentException('Acknowledge allergy warning before selling OTC');
        }

        $drugSales = new DrugSalesService();
        $expiredLots = false;
        $canFulfill = $drugSales->sellDrug(
            $drugId,
            $quantity,
            $fee,
            $pid,
            $resolvedEncounterId,
            0,
            '',
            '',
            '',
            true,
            $expiredLots
        );
        if (!$canFulfill) {
            $message = $expiredLots
                ? 'Inventory is expired or insufficient for this quantity'
                : 'Insufficient stock for this quantity';
            throw new \InvalidArgumentException($message);
        }

        $saleId = $drugSales->sellDrug(
            $drugId,
            $quantity,
            $fee,
            $pid,
            $resolvedEncounterId,
            0
        );
        if (!$saleId) {
            throw new \RuntimeException('OTC sale failed — inventory could not be allocated');
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_ops.otc_sold',
            $actorUserId,
            1,
            'sale_id=' . $saleId
                . ' pid=' . $pid
                . ' drug_id=' . $drugId
                . ' qty=' . $quantity
        );

        return [
            'sale_id' => (int) $saleId,
            'pid' => $pid,
            'encounter_id' => $resolvedEncounterId,
            'drug_id' => $drugId,
            'drug_name' => $drugName,
            'quantity' => $quantity,
        ];
    }

    /**
     * @param array<string, mixed> $drug
     */
    public static function formatDrugLabel(array $drug): string
    {
        $label = trim((string) ($drug['name'] ?? 'Product'));
        $size = trim((string) ($drug['size'] ?? ''));
        $unit = trim((string) ($drug['unit'] ?? ''));
        if ($size !== '') {
            $label .= ' ' . $size;
        }
        if ($unit !== '') {
            $label .= ' ' . $unit;
        }

        return $label;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPatientRow(int $pid): array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid FROM patient_data WHERE pid = ? LIMIT 1',
            [$pid]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Patient not found');
        }

        return $row;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadDrugRow(int $drugId): array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT drug_id, name, size, unit, reorder_point FROM drugs WHERE drug_id = ? AND active = 1 AND dispensable = 1 LIMIT 1',
            [$drugId]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Product not found or not dispensable');
        }

        return $row;
    }

    /**
     * @return array{encounter_id: int, visit_id: int|null, queue_number: int|null, visit_date: string|null}
     */
    private function resolveEncounterContext(int $pid, ?int $encounterId): array
    {
        if ($encounterId !== null && $encounterId > 0) {
            $row = QueryUtils::querySingleRow(
                'SELECT encounter FROM form_encounter WHERE pid = ? AND encounter = ? LIMIT 1',
                [$pid, $encounterId]
            );
            if (!is_array($row)) {
                throw new \InvalidArgumentException('Encounter does not belong to this patient');
            }

            return $this->visitMetaForEncounter($pid, $encounterId);
        }

        $activeEncounter = $this->visitScope->resolveActiveEncounterId($pid);
        if ($activeEncounter > 0) {
            return $this->visitMetaForEncounter($pid, $activeEncounter);
        }

        $today = date('Y-m-d');
        $row = QueryUtils::querySingleRow(
            'SELECT id AS visit_id, encounter, queue_number, visit_date
             FROM new_visit
             WHERE pid = ? AND visit_date = ? AND encounter > 0
             ORDER BY id DESC
             LIMIT 1',
            [$pid, $today]
        );
        if (is_array($row)) {
            return [
                'encounter_id' => (int) ($row['encounter'] ?? 0),
                'visit_id' => isset($row['visit_id']) ? (int) $row['visit_id'] : null,
                'queue_number' => isset($row['queue_number']) ? (int) $row['queue_number'] : null,
                'visit_date' => (string) ($row['visit_date'] ?? ''),
            ];
        }

        return [
            'encounter_id' => 0,
            'visit_id' => null,
            'queue_number' => null,
            'visit_date' => null,
        ];
    }

    /**
     * @return array{encounter_id: int, visit_id: int|null, queue_number: int|null, visit_date: string|null}
     */
    private function visitMetaForEncounter(int $pid, int $encounterId): array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id AS visit_id, queue_number, visit_date
             FROM new_visit
             WHERE pid = ? AND encounter = ?
             ORDER BY id DESC
             LIMIT 1',
            [$pid, $encounterId]
        );

        return [
            'encounter_id' => $encounterId,
            'visit_id' => is_array($row) ? (int) ($row['visit_id'] ?? 0) : null,
            'queue_number' => is_array($row) ? (int) ($row['queue_number'] ?? 0) : null,
            'visit_date' => is_array($row) ? (string) ($row['visit_date'] ?? '') : null,
        ];
    }

    private function resolveUnitFee(int $drugId, int $facilityId): float
    {
        $priceLevel = (string) ($GLOBALS['default_price_level'] ?? 'standard');
        $row = QueryUtils::querySingleRow(
            "SELECT pr_price FROM prices
             WHERE pr_id = ? AND pr_selector = '' AND pr_level = ?
             LIMIT 1",
            [$drugId, $priceLevel]
        );

        return is_array($row) ? (float) ($row['pr_price'] ?? 0) : 0.0;
    }

    /**
     * @return array<int, string>
     */
    private function loadAllergies(int $pid): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT title FROM lists WHERE pid = ? AND type = 'allergy' AND activity = 1 ORDER BY id ASC",
            [$pid]
        ) ?: [];

        $titles = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['title'] ?? ''));
            if ($title !== '' && !in_array(strtolower($title), ['nkda', 'no known drug allergies'], true)) {
                $titles[] = $title;
            }
        }

        return $titles;
    }

    private function formatPatientLabel(string $fname, string $lname): string
    {
        $fname = trim($fname);
        $lname = trim($lname);
        if ($fname === '' && $lname === '') {
            return 'Patient';
        }
        if ($lname !== '') {
            $initial = mb_substr($lname, 0, 1);

            return $fname !== '' ? $fname . ' ' . $initial . '.' : $lname;
        }

        return $fname;
    }
}
