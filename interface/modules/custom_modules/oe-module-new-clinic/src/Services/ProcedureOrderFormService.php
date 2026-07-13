<?php

/**
 * Native procedure-order form — read/write service (GAP-D / D3).
 *
 * Backs the native React procedure-order pane that replaces the stock
 * `procedure_order` encounter form when `enable_native_proc_order` is on
 * (see ProcedureOrderEnginePolicy). Full-parity fields per the D3 product
 * decision: multi-test selection from the in-house + external lab catalog,
 * order priority, specimen type/volume, clinical history, order diagnosis,
 * external-lab (procedure_providers) choice, and edit of an existing order.
 *
 * Writes the canonical two-table shape (procedure_order header +
 * procedure_order_code lines) and the `forms` registry row, reusing the
 * proven idioms from LabPanelOrderService, and posts in-house cashier
 * charges through LabOrderChargeService — no duplicate billing logic.
 *
 * NOT in scope (deferred, kept on the stock bridge for the rare case):
 * per-line procedure questions/answers (procedure_answers), specimen
 * collection scheduling, and ABN. Lazy getters only (crash-pattern rule).
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

class ProcedureOrderFormService
{
    /** Fallback priority options when the Order_Priority list is unseeded. */
    private const DEFAULT_PRIORITIES = [
        ['id' => 'normal', 'title' => 'Routine'],
        ['id' => 'high', 'title' => 'Urgent'],
        ['id' => 'stat', 'title' => 'STAT'],
    ];

    private const CLINICAL_STATES = [
        'awaiting_triage', 'in_triage', 'with_doctor',
        'ready_for_lab', 'in_lab', 'ready_for_pharmacy', 'in_pharmacy',
    ];

    public function __construct(
        private readonly ProcedureOrderEnginePolicy $policy = new ProcedureOrderEnginePolicy(),
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly EncounterSessionService $encounterSession = new EncounterSessionService(),
        private readonly LabOrderChargeService $orderCharges = new LabOrderChargeService(),
    ) {
    }

    /**
     * Form bootstrap payload: visit context, lab catalog, option lists, and
     * (when editing) the existing order.
     *
     * @return array<string, mixed>
     */
    public function getFormData(int $visitId, int $procedureOrderId, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if ($facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        if (!$this->policy->isNativeProcOrderEnabled($facilityId)) {
            throw new \RuntimeException('Native procedure order is not enabled', 403);
        }

        // $procedureOrderId is the domain id (procedure_order.procedure_order_id).
        // The host page maps the clinical-doc `form_id` (forms.id) to it before
        // calling in — the two are NOT the same (forms.form_id == the order id).
        $existing = $procedureOrderId > 0
            ? $this->loadExistingOrder($procedureOrderId, $pid, $encounter)
            : null;

        return [
            'enabled' => true,
            'visit_id' => $visitId,
            'pid' => $pid,
            'encounter' => $encounter,
            'facility_id' => $facilityId,
            'patient_name' => $this->resolvePatientName($pid),
            'labs' => $this->fetchLabCatalog($facilityId),
            'priority_options' => $this->fetchPriorityOptions(),
            'specimen_options' => $this->fetchListOptions('Specimen_Type'),
            'default_lab_id' => $this->inHouseProviderId($facilityId),
            'auto_bill_on_order' => $this->orderCharges->isAutoBillEnabled($facilityId),
            'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
            'order' => $existing,
        ];
    }

    /**
     * Create or update a procedure order from the native form.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveOrder(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visitId = (int) ($body['visit_id'] ?? 0);
        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if ($facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        if (!$this->policy->isNativeProcOrderEnabled($facilityId)) {
            throw new \RuntimeException('Native procedure order is not enabled', 403);
        }
        if ($encounter <= 0) {
            throw new \RuntimeException('This visit has no encounter yet', 409);
        }

        $this->encounterSession->bindForVisit($visitId, $actorUserId);
        $this->encounterSession->assertBound($visitId);

        $orderId = (int) ($body['procedure_order_id'] ?? 0);
        $labId = (int) ($body['lab_id'] ?? 0);
        if ($labId <= 0) {
            $labId = $this->inHouseProviderId($facilityId);
        }
        $this->assertLabProvider($labId);

        $priority = $this->normalizePriority((string) ($body['order_priority'] ?? 'normal'));
        $specimenType = mb_substr(trim((string) ($body['specimen_type'] ?? '')), 0, 31);
        $specimenVolume = mb_substr(trim((string) ($body['specimen_volume'] ?? '')), 0, 30);
        $clinicalHx = mb_substr(trim((string) ($body['clinical_hx'] ?? '')), 0, 255);
        $orderDiagnosis = mb_substr(trim((string) ($body['order_diagnosis'] ?? '')), 0, 255);

        $lines = $this->resolveOrderLines($labId, $body['procedure_type_ids'] ?? []);
        if ($lines === []) {
            throw new \InvalidArgumentException('Select at least one test for the order');
        }

        $orderProviderId = $this->resolveOrderProviderId($pid, $encounter, $actorUserId);
        $orderTitle = mb_substr(implode(', ', array_map(
            static fn (array $l): string => (string) $l['name'],
            $lines
        )), 0, 250);

        $isNew = $orderId <= 0;
        if ($isNew) {
            $orderId = $this->insertOrder(
                $pid,
                $encounter,
                $orderProviderId,
                $labId,
                $priority,
                $specimenType,
                $specimenVolume,
                $clinicalHx,
                $orderDiagnosis,
                $orderTitle
            );
            UuidRegistry::createMissingUuidsForTables(['procedure_order']);
        } else {
            // Guard: the order must belong to this exact patient + encounter
            // before any update (wrong-patient prevention, G12).
            $this->assertOrderOnEncounter($orderId, $pid, $encounter);
            $this->updateOrder(
                $orderId,
                $orderProviderId,
                $labId,
                $priority,
                $specimenType,
                $specimenVolume,
                $clinicalHx,
                $orderDiagnosis,
                $orderTitle
            );
        }

        $this->replaceOrderLines($orderId, $lines);

        if ($isNew) {
            $labName = $this->loadLabName($labId);
            $formTitle = mb_substr($labName . '-' . ($orderTitle ?: (string) $orderId) . '-' . date('Y-m-d'), 0, 255);
            (new FormService())->addForm($encounter, $formTitle, $orderId, 'procedure_order', $pid, '1');
        }

        // In-house charges only, posted once on create (avoid double-billing on edit).
        $billing = null;
        if ($isNew && $labId === $this->inHouseProviderId($facilityId)) {
            $billing = $this->orderCharges->postChargesForProcedureCodes(
                $pid,
                $encounter,
                $orderProviderId,
                $facilityId,
                array_map(static fn (array $l): string => (string) $l['procedure_code'], $lines),
                $actorUserId
            );
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            $isNew ? 'proc_order.native_created' : 'proc_order.native_updated',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'visit_id=' . $visitId
            . ' procedure_order_id=' . $orderId
            . ' lab_id=' . $labId
            . ' tests=' . count($lines),
            $pid
        );

        return [
            'procedure_order_id' => $orderId,
            'visit_id' => $visitId,
            'test_count' => count($lines),
            'is_new' => $isNew,
            'billing' => $billing,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveClinicalVisit(int $visitId, int $actorUserId): array
    {
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $state = (string) ($visit['state'] ?? '');
        if (!in_array($state, self::CLINICAL_STATES, true)) {
            throw new \InvalidArgumentException('Visit is not in an active clinical state');
        }
        if ($state === 'with_doctor' && (int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        return $visit;
    }

    /**
     * @return array<int, array{ppid: int, name: string, is_inhouse: bool, tests: array<int, array<string, mixed>>}>
     */
    private function fetchLabCatalog(int $facilityId): array
    {
        $inHouse = $this->inHouseProviderId($facilityId);
        $providers = QueryUtils::fetchRecords(
            'SELECT ppid, name FROM procedure_providers WHERE active = 1 ORDER BY name ASC',
            []
        ) ?: [];

        $catalog = [];
        foreach ($providers as $provider) {
            $ppid = (int) ($provider['ppid'] ?? 0);
            if ($ppid <= 0) {
                continue;
            }
            $catalog[] = [
                'ppid' => $ppid,
                'name' => trim((string) ($provider['name'] ?? 'Lab')),
                'is_inhouse' => $ppid === $inHouse,
                'tests' => $this->fetchProviderTests($ppid, $facilityId, $ppid === $inHouse),
            ];
        }

        return $catalog;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchProviderTests(int $ppid, int $facilityId, bool $withFees): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT procedure_type_id, name, procedure_code
             FROM procedure_type
             WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1
             ORDER BY name ASC, procedure_code ASC",
            [$ppid]
        ) ?: [];

        $feeByCode = [];
        if ($withFees) {
            $codes = array_map(static fn (array $r): string => (string) ($r['procedure_code'] ?? ''), $rows);
            foreach ($this->orderCharges->resolveFeeLinesForCodes($facilityId, $codes) as $fee) {
                $feeByCode[$fee['procedure_code']] = $fee;
            }
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
            ];
        }, $rows);
    }

    /**
     * @param mixed $procedureTypeIds
     * @return array<int, array{procedure_type_id: int, name: string, procedure_code: string}>
     */
    private function resolveOrderLines(int $labId, $procedureTypeIds): array
    {
        if (!is_array($procedureTypeIds)) {
            return [];
        }
        $ids = array_values(array_unique(array_filter(
            array_map(static fn ($v): int => (int) $v, $procedureTypeIds),
            static fn (int $id): bool => $id > 0
        )));
        if ($ids === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT procedure_type_id, name, procedure_code
             FROM procedure_type
             WHERE lab_id = ? AND procedure_type = 'ord' AND activity = 1
               AND procedure_type_id IN ({$placeholders})",
            array_merge([$labId], $ids)
        ) ?: [];

        $byId = [];
        foreach ($rows as $row) {
            $byId[(int) ($row['procedure_type_id'] ?? 0)] = [
                'procedure_type_id' => (int) ($row['procedure_type_id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'procedure_code' => (string) ($row['procedure_code'] ?? ''),
            ];
        }
        if (count($byId) !== count($ids)) {
            throw new \InvalidArgumentException('One or more selected tests are not in the chosen lab catalog');
        }

        // Preserve the caller's ordering.
        $ordered = [];
        foreach ($ids as $id) {
            $ordered[] = $byId[$id];
        }

        return $ordered;
    }

    private function insertOrder(
        int $pid,
        int $encounter,
        int $orderProviderId,
        int $labId,
        string $priority,
        string $specimenType,
        string $specimenVolume,
        string $clinicalHx,
        string $orderDiagnosis,
        string $orderTitle
    ): int {
        return (int) QueryUtils::sqlInsert(
            'INSERT INTO procedure_order SET
                date_ordered = ?, provider_id = ?, lab_id = ?, order_priority = ?,
                order_status = ?, specimen_type = ?, specimen_volume = ?, clinical_hx = ?,
                order_diagnosis = ?, patient_id = ?, encounter_id = ?, procedure_order_type = ?,
                order_intent = ?, activity = 1',
            [
                date('Y-m-d H:i:s'), $orderProviderId, $labId, $priority,
                '', $specimenType, $specimenVolume, $clinicalHx,
                $orderDiagnosis, $pid, $encounter, $orderTitle,
                'order',
            ]
        );
    }

    private function updateOrder(
        int $orderId,
        int $orderProviderId,
        int $labId,
        string $priority,
        string $specimenType,
        string $specimenVolume,
        string $clinicalHx,
        string $orderDiagnosis,
        string $orderTitle
    ): void {
        sqlStatement(
            'UPDATE procedure_order SET
                provider_id = ?, lab_id = ?, order_priority = ?, specimen_type = ?,
                specimen_volume = ?, clinical_hx = ?, order_diagnosis = ?, procedure_order_type = ?
             WHERE procedure_order_id = ?',
            [
                $orderProviderId, $labId, $priority, $specimenType,
                $specimenVolume, $clinicalHx, $orderDiagnosis, $orderTitle,
                $orderId,
            ]
        );
    }

    /**
     * @param array<int, array{procedure_type_id: int, name: string, procedure_code: string}> $lines
     */
    private function replaceOrderLines(int $orderId, array $lines): void
    {
        sqlStatement('DELETE FROM procedure_order_code WHERE procedure_order_id = ?', [$orderId]);
        $seq = 1;
        foreach ($lines as $line) {
            QueryUtils::sqlInsert(
                'INSERT INTO procedure_order_code SET
                    procedure_order_id = ?, procedure_order_seq = ?, procedure_order_title = ?,
                    procedure_code = ?, procedure_name = ?, procedure_type = ?',
                [
                    $orderId, $seq, (string) $line['name'],
                    (string) $line['procedure_code'], (string) $line['name'], 'ord',
                ]
            );
            $seq++;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadExistingOrder(int $procedureOrderId, int $pid, int $encounter): ?array
    {
        // Scoped to the exact patient + encounter (wrong-patient prevention, G12).
        $header = QueryUtils::querySingleRow(
            'SELECT procedure_order_id, lab_id, order_priority, specimen_type, specimen_volume,
                    clinical_hx, order_diagnosis
             FROM procedure_order
             WHERE procedure_order_id = ? AND patient_id = ? AND encounter_id = ? AND activity = 1',
            [$procedureOrderId, $pid, $encounter]
        );
        if (!is_array($header)) {
            return null;
        }

        $codes = QueryUtils::fetchRecords(
            'SELECT procedure_order_seq, procedure_code, procedure_name
             FROM procedure_order_code
             WHERE procedure_order_id = ?
             ORDER BY procedure_order_seq ASC',
            [$procedureOrderId]
        ) ?: [];

        return [
            'procedure_order_id' => (int) $header['procedure_order_id'],
            'lab_id' => (int) ($header['lab_id'] ?? 0),
            'order_priority' => (string) ($header['order_priority'] ?? 'normal'),
            'specimen_type' => (string) ($header['specimen_type'] ?? ''),
            'specimen_volume' => (string) ($header['specimen_volume'] ?? ''),
            'clinical_hx' => (string) ($header['clinical_hx'] ?? ''),
            'order_diagnosis' => (string) ($header['order_diagnosis'] ?? ''),
            'codes' => array_map(static fn (array $c): array => [
                'procedure_code' => (string) ($c['procedure_code'] ?? ''),
                'procedure_name' => (string) ($c['procedure_name'] ?? ''),
            ], $codes),
        ];
    }

    private function assertOrderOnEncounter(int $orderId, int $pid, int $encounter): void
    {
        $row = QueryUtils::querySingleRow(
            'SELECT procedure_order_id FROM procedure_order
             WHERE procedure_order_id = ? AND patient_id = ? AND encounter_id = ? AND activity = 1',
            [$orderId, $pid, $encounter]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('Order is not on this visit');
        }
    }

    private function normalizePriority(string $priority): string
    {
        $priority = strtolower(trim($priority));
        $allowed = array_map(
            static fn (array $p): string => $p['id'],
            $this->fetchPriorityOptions()
        );

        return in_array($priority, $allowed, true) ? $priority : 'normal';
    }

    /**
     * @return array<int, array{id: string, title: string}>
     */
    private function fetchPriorityOptions(): array
    {
        $rows = $this->fetchListOptions('Order_Priority');
        if ($rows === []) {
            return self::DEFAULT_PRIORITIES;
        }

        return array_map(
            static fn (array $r): array => ['id' => (string) $r['id'], 'title' => (string) $r['title']],
            $rows
        );
    }

    /**
     * @return array<int, array{id: string, title: string}>
     */
    private function fetchListOptions(string $listId): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT option_id, title FROM list_options
             WHERE list_id = ? AND activity = 1 ORDER BY seq, title',
            [$listId]
        ) ?: [];

        return array_map(
            static fn (array $r): array => [
                'id' => (string) ($r['option_id'] ?? ''),
                'title' => (string) ($r['title'] ?? ''),
            ],
            $rows
        );
    }

    private function inHouseProviderId(int $facilityId): int
    {
        $ppid = (int) $this->config->get('lab_inhouse_provider_id', '0', $facilityId);
        if ($ppid <= 0) {
            return 0;
        }
        $row = QueryUtils::querySingleRow(
            'SELECT ppid FROM procedure_providers WHERE ppid = ? AND active = 1',
            [$ppid]
        );

        return is_array($row) ? (int) ($row['ppid'] ?? 0) : 0;
    }

    private function assertLabProvider(int $labId): void
    {
        if ($labId <= 0) {
            throw new \InvalidArgumentException('Choose a lab for the order');
        }
        $row = QueryUtils::querySingleRow(
            'SELECT ppid FROM procedure_providers WHERE ppid = ? AND active = 1',
            [$labId]
        );
        if (!is_array($row)) {
            throw new \InvalidArgumentException('The chosen lab is not active');
        }
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

    private function loadLabName(int $ppid): string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT name FROM procedure_providers WHERE ppid = ?',
            [$ppid]
        );

        return is_array($row) ? trim((string) ($row['name'] ?? 'Lab')) : 'Lab';
    }

    private function resolvePatientName(int $pid): string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname FROM patient_data WHERE pid = ?',
            [$pid]
        );
        if (!is_array($row)) {
            return '';
        }

        return trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));
    }
}
