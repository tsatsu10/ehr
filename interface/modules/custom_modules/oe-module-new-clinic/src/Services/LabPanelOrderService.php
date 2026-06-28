<?php

/**
 * V1.1-LAB-ORD — Doctor Desk panel quick lab order (M4-F36)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Common\Uuid\UuidRegistry;
use OpenEMR\Services\FormService;

class LabPanelOrderService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly LabOpsOrderMetaService $orderMeta = new LabOpsOrderMetaService(),
        private readonly LabResultsReadinessService $labReadiness = new LabResultsReadinessService(),
        private readonly LabOpsSetupService $setup = new LabOpsSetupService(),
        private readonly LabOrderChargeService $orderCharges = new LabOrderChargeService(),
    ) {
    }

    public function isFeatureEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        if ($this->config->getInt('enable_lab_role', 0, $facilityId) !== 1) {
            return false;
        }
        if ($this->config->getInt('enable_lab_ops', 0, $facilityId) !== 1) {
            return false;
        }
        if ($this->config->getInt('enable_lab_panel_order', 0, $facilityId) !== 1) {
            return false;
        }

        return $this->resolveCatalogProviderId($facilityId) > 0
            && $this->catalogHasActiveTests($facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function getCatalogPayload(?int $facilityId = null): array
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $providerId = $this->resolveCatalogProviderId($facilityId);
        $setup = $this->setup->getSetupStatus();
        $tests = $providerId > 0 ? $this->fetchCatalogTests($providerId, $facilityId) : [];
        $currencySymbol = (string) $this->config->get('currency_symbol', 'GH₵', $facilityId);

        return [
            'enabled' => $this->isFeatureEnabled($facilityId),
            'provider_id' => $providerId > 0 ? $providerId : null,
            'provider_name' => $setup['provider_name'] ?? null,
            'tests' => $tests,
            'has_catalog' => $tests !== [],
            'currency_symbol' => $currencySymbol,
            'starter_panel_codes' => LabOrderChargeService::STARTER_PANEL_CODES,
            'auto_bill_on_order' => $this->orderCharges->isAutoBillEnabled($facilityId),
        ];
    }

    /**
     * @param array<int, int> $procedureTypeIds
     * @return array<string, mixed>
     */
    public function placeOrder(int $visitId, array $procedureTypeIds, int $actorUserId): array
    {
        if (!$this->isFeatureEnabled()) {
            throw new \RuntimeException('Lab panel quick order is not enabled', 403);
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
            throw new \InvalidArgumentException('Visit has no encounter for lab ordering');
        }

        $this->encounterSession->bindForVisit($visitId, $actorUserId);
        $this->encounterSession->assertBound($visitId);

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if ($facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $providerId = $this->resolveCatalogProviderId($facilityId);
        if ($providerId <= 0) {
            throw new \RuntimeException('In-house lab catalog is not configured', 400);
        }

        $procedureTypeIds = array_values(array_unique(array_filter(array_map(
            static fn ($id): int => (int) $id,
            $procedureTypeIds
        ), static fn (int $id): bool => $id > 0)));

        if ($procedureTypeIds === []) {
            throw new \InvalidArgumentException('Select at least one lab test');
        }

        $lines = $this->loadProcedureTypes($providerId, $procedureTypeIds);
        if (count($lines) !== count($procedureTypeIds)) {
            throw new \InvalidArgumentException('One or more selected tests are not in the clinic catalog');
        }

        $orderProviderId = $this->resolveOrderProviderId($pid, $encounter, $actorUserId);
        $now = date('Y-m-d H:i:s');
        $orderTitle = implode(', ', array_map(
            static fn (array $line): string => (string) ($line['name'] ?? ''),
            $lines
        ));
        $orderTitle = mb_substr($orderTitle, 0, 250);

        $orderId = QueryUtils::sqlInsert(
            'INSERT INTO procedure_order SET
                date_ordered = ?,
                provider_id = ?,
                lab_id = ?,
                order_priority = ?,
                order_status = ?,
                billing_type = ?,
                patient_id = ?,
                encounter_id = ?,
                procedure_order_type = ?,
                order_intent = ?,
                activity = 1',
            [
                $now,
                $orderProviderId,
                $providerId,
                'normal',
                '',
                '',
                $pid,
                $encounter,
                $orderTitle,
                'order',
            ]
        );

        UuidRegistry::createMissingUuidsForTables(['procedure_order']);

        $seq = 1;
        foreach ($lines as $line) {
            QueryUtils::sqlInsert(
                'INSERT INTO procedure_order_code SET
                    procedure_order_id = ?,
                    procedure_order_seq = ?,
                    procedure_order_title = ?,
                    procedure_code = ?,
                    procedure_name = ?,
                    procedure_type = ?',
                [
                    $orderId,
                    $seq,
                    (string) ($line['name'] ?? ''),
                    (string) ($line['procedure_code'] ?? ''),
                    (string) ($line['name'] ?? ''),
                    'ord',
                ]
            );
            $seq++;
        }

        $labName = $this->loadLabDisplayName($providerId);
        $formTitle = mb_substr($labName . '-' . ($orderTitle ?: (string) $orderId) . '-' . date('Y-m-d'), 0, 255);
        (new FormService())->addForm($encounter, $formTitle, $orderId, 'procedure_order', $pid, '1');

        $this->orderMeta->ensureFulfillmentMeta($orderId);

        $procedureCodes = array_map(
            static fn (array $line): string => (string) ($line['procedure_code'] ?? ''),
            $lines
        );
        $billing = $this->orderCharges->postChargesForProcedureCodes(
            $pid,
            $encounter,
            $orderProviderId,
            $facilityId,
            $procedureCodes,
            $actorUserId
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'doctor.lab_panel_ordered',
            $actorUserId,
            1,
            'visit_id=' . $visitId
            . ' procedure_order_id=' . $orderId
            . ' tests=' . implode(',', $procedureTypeIds)
        );

        $routing = $this->labReadiness->getEncounterRouting($pid, $encounter, $facilityId);

        return [
            'procedure_order_id' => $orderId,
            'visit_id' => $visitId,
            'test_count' => count($lines),
            'routing_chips' => $routing,
            'billing' => $billing,
        ];
    }

    private function catalogHasActiveTests(int $facilityId): bool
    {
        $providerId = $this->resolveCatalogProviderId($facilityId);
        if ($providerId <= 0) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM procedure_type
             WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1",
            [$providerId]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    private function resolveCatalogProviderId(int $facilityId): int
    {
        $providerId = (int) $this->config->get('lab_inhouse_provider_id', '0', $facilityId);
        if ($providerId <= 0) {
            return 0;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT ppid FROM procedure_providers WHERE ppid = ? AND active = 1',
            [$providerId]
        );

        return is_array($row) && !empty($row['ppid']) ? (int) $row['ppid'] : 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchCatalogTests(int $providerId, int $facilityId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT procedure_type_id, name, procedure_code
             FROM procedure_type
             WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1
             ORDER BY name ASC, procedure_code ASC",
            [$providerId]
        ) ?: [];

        $codes = array_map(static fn (array $row): string => (string) ($row['procedure_code'] ?? ''), $rows);
        $feeByCode = [];
        foreach ($this->orderCharges->resolveFeeLinesForCodes($facilityId, $codes) as $fee) {
            $feeByCode[$fee['procedure_code']] = $fee;
        }

        return array_map(static function (array $row) use ($feeByCode): array {
            $code = (string) ($row['procedure_code'] ?? '');
            $fee = $feeByCode[$code] ?? null;

            return [
                'procedure_type_id' => (int) ($row['procedure_type_id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'code' => $code,
                'fee_amount' => $fee ? (float) $fee['price_amount'] : null,
                'has_fee' => $fee !== null,
                'is_starter' => in_array($code, LabOrderChargeService::STARTER_PANEL_CODES, true),
            ];
        }, $rows);
    }

    /**
     * @param array<int, int> $procedureTypeIds
     * @return array<int, array<string, mixed>>
     */
    private function loadProcedureTypes(int $providerId, array $procedureTypeIds): array
    {
        $placeholders = implode(',', array_fill(0, count($procedureTypeIds), '?'));
        $bind = array_merge([$providerId], $procedureTypeIds);

        $rows = QueryUtils::fetchRecords(
            "SELECT procedure_type_id, name, procedure_code
             FROM procedure_type
             WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1
               AND procedure_type_id IN ({$placeholders})",
            $bind
        ) ?: [];

        $byId = [];
        foreach ($rows as $row) {
            $byId[(int) ($row['procedure_type_id'] ?? 0)] = $row;
        }

        $ordered = [];
        foreach ($procedureTypeIds as $id) {
            if (isset($byId[$id])) {
                $ordered[] = $byId[$id];
            }
        }

        return $ordered;
    }

    private function resolveOrderProviderId(int $pid, int $encounter, int $actorUserId): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT provider_id FROM form_encounter WHERE pid = ? AND encounter = ?',
            [$pid, $encounter]
        );
        $providerId = is_array($row) ? (int) ($row['provider_id'] ?? 0) : 0;

        return $providerId > 0 ? $providerId : $actorUserId;
    }

    private function loadLabDisplayName(int $providerId): string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT name FROM procedure_providers WHERE ppid = ?',
            [$providerId]
        );

        return is_array($row) ? trim((string) ($row['name'] ?? 'Lab')) : 'Lab';
    }
}
