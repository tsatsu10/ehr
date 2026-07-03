<?php

/**
 * M13 Pharmacy Operations Hub — dispense façade over DrugSalesService
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

class PharmOpsDispenseService
{
    public function __construct(
        private readonly PharmOpsAccessService $access = new PharmOpsAccessService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly PharmOpsInventoryPreviewService $inventoryPreview = new PharmOpsInventoryPreviewService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getDispenseForm(int $prescriptionId): array
    {
        $this->access->assertHubAccess();
        $rx = $this->loadPrescriptionRow($prescriptionId);
        $pid = (int) ($rx['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = $this->visitScope()->resolveDeskFacilityId();
        $qtyOrdered = PharmOpsWorklistService::parseQuantity((string) ($rx['quantity'] ?? ''));
        $qtyDispensed = $this->sumDispensedQuantity($prescriptionId);
        $qtyRemaining = $qtyOrdered > 0 ? max($qtyOrdered - $qtyDispensed, 0) : 0;
        if ($qtyRemaining <= 0 && $qtyOrdered > 0) {
            throw new \InvalidArgumentException('Prescription is already fully dispensed');
        }

        $drugId = (int) ($rx['drug_id'] ?? 0);
        $drugName = $this->formatDrugLabel($rx);
        $allergies = $this->loadAllergies($pid);
        $inventory = $this->inventoryPreview->previewForDrug(
            $drugId,
            $qtyRemaining > 0 ? $qtyRemaining : 1,
            'No in-house drug linked to this prescription'
        );
        $defaultQty = $qtyRemaining > 0 ? $qtyRemaining : max($qtyOrdered, 1);
        $unitFee = $this->resolveUnitFee($drugId, $facilityId);
        $defaultFee = round($unitFee * $defaultQty, 2);
        $allergyWarning = PharmOpsSafetyService::hasDrugAllergyWarning($drugName, $allergies);
        $canPrintLabel = $this->access->isDispenseLabelEnabled($facilityId)
            && $this->access->canPrintDispenseLabel();

        return [
            'prescription_id' => $prescriptionId,
            'pid' => $pid,
            'encounter_id' => (int) ($rx['encounter'] ?? 0),
            'patient' => [
                'display_name' => trim(($rx['fname'] ?? '') . ' ' . ($rx['lname'] ?? '')),
                'patient_label' => $this->formatPatientLabel(
                    (string) ($rx['fname'] ?? ''),
                    (string) ($rx['lname'] ?? '')
                ),
                'mrn' => (string) ($rx['pubpid'] ?? ''),
            ],
            'visit' => [
                'visit_id' => (int) ($rx['visit_id'] ?? 0) ?: null,
                'queue_number' => isset($rx['queue_number']) ? (int) $rx['queue_number'] : null,
                'visit_date' => (string) ($rx['visit_date'] ?? ''),
            ],
            'drug' => [
                'drug_id' => $drugId,
                'drug_name' => $drugName,
                'sig' => $this->formatSig($rx),
                'qty_ordered' => $qtyOrdered,
                'qty_dispensed' => $qtyDispensed,
                'qty_remaining' => $qtyRemaining,
                'default_quantity' => $defaultQty,
            ],
            'inventory' => $inventory,
            'fee' => [
                'amount' => $defaultFee,
                'unit_amount' => $unitFee,
                'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
            ],
            'safety' => [
                'allergies' => $allergies,
                'allergy_warning' => $allergyWarning,
            ],
            'can_print_label' => $canPrintLabel,
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function confirmDispense(int $prescriptionId, array $body, int $actorUserId): array
    {
        $this->access->assertDispenseAccess();
        $rx = $this->loadPrescriptionRow($prescriptionId);
        $pid = (int) ($rx['patient_id'] ?? 0);
        $encounterId = (int) ($rx['encounter'] ?? 0);
        $drugId = (int) ($rx['drug_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        if ($drugId <= 0) {
            throw new \InvalidArgumentException('Prescription is not linked to an in-house drug');
        }
        if ($encounterId <= 0) {
            throw new \InvalidArgumentException('Prescription has no encounter for dispensing');
        }

        $quantity = (float) ($body['quantity'] ?? 0);
        $fee = (float) ($body['fee'] ?? 0);
        if ($quantity <= 0) {
            throw new \InvalidArgumentException('Dispense quantity must be greater than zero');
        }
        if ($fee < 0) {
            throw new \InvalidArgumentException('Fee cannot be negative');
        }

        $qtyOrdered = PharmOpsWorklistService::parseQuantity((string) ($rx['quantity'] ?? ''));
        $qtyDispensed = $this->sumDispensedQuantity($prescriptionId);
        $qtyRemaining = $qtyOrdered > 0 ? max($qtyOrdered - $qtyDispensed, 0) : 0;
        if ($qtyOrdered > 0 && $quantity > $qtyRemaining) {
            throw new \InvalidArgumentException('Dispense quantity exceeds remaining prescription amount');
        }

        $allergies = $this->loadAllergies($pid);
        $drugName = $this->formatDrugLabel($rx);
        if (PharmOpsSafetyService::hasDrugAllergyWarning($drugName, $allergies) && empty($body['allergy_acknowledged'])) {
            throw new \InvalidArgumentException('Acknowledge allergy warning before dispensing');
        }

        $drugSales = new DrugSalesService();
        $expiredLots = false;
        $canFulfill = $drugSales->sellDrug(
            $drugId,
            $quantity,
            $fee,
            $pid,
            $encounterId,
            $prescriptionId,
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
            $encounterId,
            $prescriptionId
        );
        if (!$saleId) {
            throw new \RuntimeException('Dispense failed — inventory could not be allocated');
        }

        $newDispensed = $qtyDispensed + (int) round($quantity);
        if ($qtyOrdered > 0 && $newDispensed >= $qtyOrdered) {
            QueryUtils::sqlStatementThrowException(
                'UPDATE prescriptions SET filled_date = ? WHERE id = ?',
                [date('Y-m-d'), $prescriptionId]
            );
        }

        $dispenseStatus = ($qtyOrdered > 0 && $newDispensed >= $qtyOrdered) ? 'dispensed' : 'partial';

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            PharmOpsUndispensedGate::dispenseAuditEvent($dispenseStatus),
            $actorUserId,
            1,
            'prescription_id=' . $prescriptionId
                . ' sale_id=' . $saleId
                . ' pid=' . $pid
                . ' qty=' . $quantity
                . ' status=' . $dispenseStatus
        );

        $facilityId = $this->visitScope()->resolveDeskFacilityId();
        $canPrintLabel = $this->access->isDispenseLabelEnabled($facilityId)
            && $this->access->canPrintDispenseLabel();

        return [
            'prescription_id' => $prescriptionId,
            'sale_id' => (int) $saleId,
            'qty_dispensed' => $newDispensed,
            'dispense_status' => $dispenseStatus,
            'drug_name' => $drugName,
            'can_print_label' => $canPrintLabel,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPrescriptionRow(int $prescriptionId): array
    {
        if ($prescriptionId <= 0) {
            throw new \InvalidArgumentException('Invalid prescription');
        }

        $visitDate = date('Y-m-d');
        $row = QueryUtils::querySingleRow(
            "SELECT rx.id, rx.patient_id, rx.encounter, rx.drug, rx.dosage, rx.quantity,
                    rx.drug_id, rx.route, rx.`interval`, rx.refills, rx.note, rx.active,
                    pd.fname, pd.lname, pd.pubpid,
                    nv.id AS visit_id, nv.queue_number, nv.visit_date
             FROM prescriptions rx
             INNER JOIN patient_data pd ON pd.pid = rx.patient_id
             LEFT JOIN new_visit nv ON nv.id = " . PharmOpsVisitMatch::todayVisitSubquerySql() . "
             WHERE rx.id = ? AND rx.active = 1
             LIMIT 1",
            [$visitDate, $prescriptionId]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Prescription not found');
        }

        return $row;
    }

    private function sumDispensedQuantity(int $prescriptionId): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COALESCE(SUM(quantity), 0) AS qty FROM drug_sales WHERE prescription_id = ?',
            [$prescriptionId]
        );

        return is_array($row) ? (int) round((float) ($row['qty'] ?? 0)) : 0;
    }

    private function resolveUnitFee(int $drugId, int $facilityId): float
    {
        if ($drugId <= 0) {
            return 0.0;
        }

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

    /**
     * @param array<string, mixed> $rx
     */
    private function formatDrugLabel(array $rx): string
    {
        $label = trim((string) ($rx['drug'] ?? 'Medication'));
        $dosage = trim((string) ($rx['dosage'] ?? ''));
        if ($dosage !== '') {
            $label .= ' ' . $dosage;
        }

        return $label;
    }

    /**
     * @param array<string, mixed> $rx
     */
    private function formatSig(array $rx): string
    {
        $parts = array_filter([
            trim((string) ($rx['dosage'] ?? '')),
            trim((string) ($rx['route'] ?? '')),
            !empty($rx['interval']) ? 'q' . $rx['interval'] : '',
        ]);

        return implode(' ', $parts);
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

    private function visitScope(): VisitScopeService
    {
        return new VisitScopeService();
    }
}
