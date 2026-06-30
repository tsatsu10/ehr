<?php

/**
 * V1.2-PHARM-RX — Doctor Desk formulary quick prescribe (M4-F37)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Common\Uuid\UuidRegistry;

class PharmFormularyRxService
{
    public const CATALOG_LIMIT = 50;

    /** @var array<int, string> OPD starter formulary drug names (samples/opd_formulary_starter.csv) */
    public const STARTER_DRUG_NAMES = [
        'Amoxicillin',
        'Paracetamol',
        'Artemether-Lumefantrine',
        'ORS',
        'Metronidazole',
        'Ibuprofen',
        'Omeprazole',
        'Salbutamol',
        'Chlorhexidine',
        'Metformin',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly PharmOpsAccessService $pharmOpsAccess = new PharmOpsAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly PharmacyService $pharmacyService = new PharmacyService(),
        private readonly PharmOpsFormularyImportService $formularyImport = new PharmOpsFormularyImportService(),
    ) {
    }

    public function isFeatureEnabled(?int $facilityId = null): bool
    {
        if (!$this->pharmOpsAccess->isInhousePharmacyEnabled()) {
            return false;
        }

        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        if ($this->config->getInt('enable_pharmacy_role', 0, $facilityId) !== 1) {
            return false;
        }
        if (!$this->pharmOpsAccess->isHubEnabled($facilityId)) {
            return false;
        }
        if ($this->config->getInt('enable_pharm_rx_favorites', 0, $facilityId) !== 1) {
            return false;
        }

        return $this->catalogHasActiveDrugs();
    }

    /**
     * @return array<string, mixed>
     */
    public function getCatalogPayload(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $enabled = $this->isFeatureEnabled($facilityId);
        $drugs = $enabled ? $this->fetchCatalogDrugs($facilityId) : [];
        $currencySymbol = (string) $this->config->get('currency_symbol', 'GH₵', $facilityId);

        $payload = [
            'enabled' => $enabled,
            'drugs' => $drugs,
            'has_catalog' => $drugs !== [],
            'currency_symbol' => $currencySymbol,
        ];

        if ($enabled) {
            $payload['starter_drug_names'] = self::STARTER_DRUG_NAMES;
            $payload['drug_count'] = $this->formularyImport->countActiveDispensableDrugs();
        }

        return $payload;
    }

    /**
     * @param array<int, int> $drugIds
     * @return array<string, mixed>
     */
    public function placePrescriptions(int $visitId, array $drugIds, int $actorUserId): array
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_doctor')) {
            throw new \RuntimeException('Forbidden', 403);
        }

        if (!$this->isFeatureEnabled()) {
            throw new \RuntimeException('Formulary quick prescribe is not enabled', 403);
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if (($visit['state'] ?? '') !== 'with_doctor') {
            throw new \InvalidArgumentException('Visit is not in active consult');
        }
        if ((int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($pid <= 0 || $encounter <= 0) {
            throw new \InvalidArgumentException('Visit has no encounter for prescribing');
        }

        $this->encounterSession->bindForVisit($visitId, $actorUserId);
        $this->encounterSession->assertBound($visitId);

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if ($facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $drugIds = array_values(array_unique(array_filter(array_map(
            static fn ($id): int => (int) $id,
            $drugIds
        ), static fn (int $id): bool => $id > 0)));

        if ($drugIds === []) {
            throw new \InvalidArgumentException('Select at least one medication');
        }
        if (count($drugIds) > self::CATALOG_LIMIT) {
            throw new \InvalidArgumentException(
                'Select at most ' . self::CATALOG_LIMIT . ' medications per quick prescribe'
            );
        }

        $lines = $this->loadCatalogDrugs($drugIds);
        if (count($lines) !== count($drugIds)) {
            throw new \InvalidArgumentException('One or more selected drugs are not in the clinic formulary');
        }

        $providerId = $this->resolveProviderId($pid, $encounter, $actorUserId);
        $prescriptionIds = [];
        foreach ($lines as $line) {
            $prescriptionIds[] = $this->insertPrescription($line, $pid, $encounter, $providerId, $actorUserId);
        }

        UuidRegistry::createMissingUuidsForTables(['prescriptions']);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'doctor.formulary_rx_prescribed',
            $actorUserId,
            1,
            'visit_id=' . $visitId
                . ' prescription_ids=' . implode(',', $prescriptionIds)
                . ' drug_ids=' . implode(',', $drugIds)
        );

        $prescriptions = $this->pharmacyService->getPrescriptionsWithStockForEncounter(
            $pid,
            $encounter,
            $facilityId
        );

        return [
            'visit_id' => $visitId,
            'prescription_ids' => $prescriptionIds,
            'prescription_count' => count($prescriptionIds),
            'prescriptions' => $prescriptions,
        ];
    }

    private function catalogHasActiveDrugs(): bool
    {
        return $this->formularyImport->countActiveDispensableDrugs() > 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchCatalogDrugs(int $facilityId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT d.drug_id, d.name, d.form, d.size, d.unit, d.route,
                    dt.dosage, dt.period, dt.quantity
             FROM drugs d
             LEFT JOIN drug_templates dt ON dt.drug_id = d.drug_id AND dt.selector = d.name
             WHERE d.active = 1 AND d.dispensable = 1
             ORDER BY d.name ASC
             LIMIT " . self::CATALOG_LIMIT
        ) ?: [];

        $priceLevel = (string) ($GLOBALS['default_price_level'] ?? 'standard');

        return array_map(function (array $row) use ($facilityId, $priceLevel): array {
            $drugId = (int) ($row['drug_id'] ?? 0);
            $name = (string) ($row['name'] ?? '');
            $stock = $drugId > 0 ? PharmOpsWorklistService::stockSummaryForDrug($drugId) : [];
            $fee = $this->resolveUnitFee($drugId, $priceLevel);

            return [
                'drug_id' => $drugId,
                'name' => $name,
                'display_name' => $this->formatDrugDisplayName($row),
                'dosage' => trim((string) ($row['dosage'] ?? '')),
                'quantity' => trim((string) ($row['quantity'] ?? '')),
                'route' => trim((string) ($row['route'] ?? '')),
                'period_days' => (int) ($row['period'] ?? 0),
                'fee_amount' => $fee > 0 ? $fee : null,
                'has_fee' => $fee > 0,
                'is_starter' => in_array($name, self::STARTER_DRUG_NAMES, true),
                'stock_status' => $stock['stock_status'] ?? null,
                'qoh_display' => $stock['qoh_display'] ?? null,
            ];
        }, $rows);
    }

    /**
     * @param array<int, int> $drugIds
     * @return array<int, array<string, mixed>>
     */
    private function loadCatalogDrugs(array $drugIds): array
    {
        $placeholders = implode(',', array_fill(0, count($drugIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT d.drug_id, d.name, d.form, d.size, d.unit, d.route,
                    dt.dosage, dt.period, dt.quantity
             FROM drugs d
             LEFT JOIN drug_templates dt ON dt.drug_id = d.drug_id AND dt.selector = d.name
             WHERE d.active = 1 AND d.dispensable = 1
               AND d.drug_id IN ({$placeholders})",
            $drugIds
        ) ?: [];

        $byId = [];
        foreach ($rows as $row) {
            $byId[(int) ($row['drug_id'] ?? 0)] = $row;
        }

        $ordered = [];
        foreach ($drugIds as $id) {
            if (isset($byId[$id])) {
                $ordered[] = $byId[$id];
            }
        }

        return $ordered;
    }

    /**
     * @param array<string, mixed> $line
     */
    private function insertPrescription(array $line, int $pid, int $encounter, int $providerId, int $actorUserId): int
    {
        $drugId = (int) ($line['drug_id'] ?? 0);
        $drugName = (string) ($line['name'] ?? 'Medication');
        $dosage = trim((string) ($line['dosage'] ?? ''));
        $quantity = trim((string) ($line['quantity'] ?? ''));
        if ($quantity === '') {
            $quantity = '1';
        }
        $route = trim((string) ($line['route'] ?? ''));
        $instructions = $dosage !== '' ? $dosage : $this->formatDrugDisplayName($line);
        $periodDays = (int) ($line['period'] ?? 0);

        $now = date('Y-m-d H:i:s');
        $today = date('Y-m-d');
        $endDate = $periodDays > 0 ? date('Y-m-d', strtotime('+' . $periodDays . ' days')) : null;
        $user = (string) ($_SESSION['authUser'] ?? '');
        $uuid = UuidRegistry::getRegistryForTable('prescriptions')->createUuid();

        return (int) QueryUtils::sqlInsert(
            'INSERT INTO prescriptions (
                uuid, patient_id, provider_id, encounter, date_added, date_modified,
                start_date, end_date, drug, drug_id, dosage, quantity, route,
                refills, active, user, txDate, drug_dosage_instructions,
                usage_category, usage_category_title, request_intent, request_intent_title,
                created_by, updated_by
             ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                0, 1, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?
             )',
            [
                $uuid,
                $pid,
                $providerId,
                $encounter,
                $now,
                $now,
                $today,
                $endDate,
                $drugName,
                $drugId,
                $dosage,
                $quantity,
                $route !== '' ? $route : null,
                $user,
                $today,
                $instructions,
                'outpatient',
                'Home/Community',
                'order',
                'Order',
                $actorUserId,
                $actorUserId,
            ]
        );
    }

    private function resolveProviderId(int $pid, int $encounter, int $actorUserId): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT provider_id FROM form_encounter WHERE pid = ? AND encounter = ?',
            [$pid, $encounter]
        );
        $providerId = is_array($row) ? (int) ($row['provider_id'] ?? 0) : 0;

        return $providerId > 0 ? $providerId : $actorUserId;
    }

    private function resolveUnitFee(int $drugId, string $priceLevel): float
    {
        if ($drugId <= 0) {
            return 0.0;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT pr_price FROM prices
             WHERE pr_id = ? AND pr_selector = '' AND pr_level = ?
             LIMIT 1",
            [$drugId, $priceLevel]
        );

        return is_array($row) ? (float) ($row['pr_price'] ?? 0) : 0.0;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function formatDrugDisplayName(array $row): string
    {
        $name = trim((string) ($row['name'] ?? 'Medication'));
        $strength = trim((string) ($row['size'] ?? ''));
        $form = trim((string) ($row['form'] ?? ''));
        $parts = array_filter([$name, $strength, $form]);

        return implode(' ', $parts);
    }
}
