<?php

/**
 * Pharmacy Desk queue and workflow (M9)
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
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;

class PharmacyService
{
    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitBoardService $boardService = new VisitBoardService(),
        private readonly PatientContextService $patientContextService = new PatientContextService(),
        private readonly EncounterSessionService $encounterSessionService = new EncounterSessionService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly PharmOpsAccessService $pharmOpsAccess = new PharmOpsAccessService(),
        private readonly PharmacyWalkinService $walkinService = new PharmacyWalkinService(),
        private readonly ExternalRxValidationService $externalRxService = new ExternalRxValidationService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getPharmacyQueue(int $facilityId, ?string $visitDate, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->assertPharmacyRoleEnabled($facilityId);
        $visitDate = $visitDate ?? $this->clinicDate->today();
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ?
                AND v.state IN ('ready_for_pharmacy', 'in_pharmacy')
                ORDER BY v.is_urgent DESC, v.visit_date ASC, v.queue_number ASC, v.started_at ASC"
                . QueueLimits::limitClause(QueueLimits::QUEUE_HARD_CAP);

        $rows = QueryUtils::fetchRecords($sql, [$facilityId]) ?: [];
        [$rows, $queueTruncated] = QueueLimits::applyCap($rows, QueueLimits::QUEUE_HARD_CAP);
        $visitIds = array_map(fn (array $row) => (int) ($row['id'] ?? 0), $rows);
        $holders = $this->rowEnricher->batchPharmacyHolders($visitIds);
        $rxCounts = $this->rowEnricher->batchRxCounts($visitIds);
        $pharmOpsEnabled = $this->pharmOpsAccess->isHubEnabled($facilityId);
        $inhousePharmacy = $this->isInhousePharmacyEnabled();
        $undispensedCounts = $inhousePharmacy
            ? $this->rowEnricher->batchUndispensedRxCounts($visitIds)
            : [];
        $rows = $this->rowEnricher->enrichVisitRows($rows);

        $visits = [];
        $waitingCount = 0;
        $inPharmacyCount = 0;
        foreach ($rows as $row) {
            $enriched = $this->enrichQueueRow(
                $row,
                $actorUserId,
                $holders,
                $rxCounts,
                $inhousePharmacy,
                $undispensedCounts
            );
            $visits[] = $enriched;
            if ($enriched['state'] === 'ready_for_pharmacy') {
                $waitingCount++;
            } else {
                $inPharmacyCount++;
            }
        }

        $activeWork = $this->findActivePharmacyWork($facilityId, $actorUserId);

        return [
            'visits' => $visits,
            'queue_truncated' => $queueTruncated,
            'queue_cap' => QueueLimits::QUEUE_HARD_CAP,
            'counts' => [
                'waiting' => $waitingCount,
                'in_pharmacy' => $inPharmacyCount,
                'total' => count($visits),
            ],
            'active_work' => $activeWork,
            'has_active_work' => !empty($activeWork),
            'visit_date' => $visitDate,
            'last_updated' => date('c'),
            'pharm_ops_enabled' => $pharmOpsEnabled,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function selectVisit(int $visitId, int $actorUserId): array
    {
        $this->assertPharmacyRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if (!in_array($visit['state'], ['ready_for_pharmacy', 'in_pharmacy'], true)) {
            throw new \InvalidArgumentException('Visit is not on the pharmacy queue');
        }

        if ($visit['state'] === 'in_pharmacy') {
            return $this->getActivePayload($visitId, $actorUserId);
        }

        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $preview = $this->patientContextService->previewPayload(
            (int) $visit['pid'],
            $actorUserId,
            'pharmacy'
        );
        $prescriptions = $this->getPrescriptionsForEncounter((int) $visit['pid'], (int) $visit['encounter']);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        return array_merge(
            [
                'visit' => $detail['visit'],
                'preview' => $preview,
                'prescriptions' => $this->enrichPrescriptionsWithStock($prescriptions, $facilityId),
                'rx_list_url' => $this->rxListUrl((int) $visit['pid']),
                'skipped_triage' => $detail['skipped_triage'],
                'session_bound' => false,
                'can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
            ],
            $this->pharmOpsDeskFlags($facilityId),
            $this->undispensedDeskFlags((int) $visit['pid'], (int) $visit['encounter']),
            $this->walkinDeskFlags($visit, $facilityId, (int) $visit['pid']),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function takePatient(int $visitId, int $actorUserId, int $expectedVersion): array
    {
        $this->assertPharmacyRoleEnabled();

        $visit = $this->queueService->getVisitForActor($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        $existing = $this->findActivePharmacyWork($facilityId, $actorUserId);
        if (!empty($existing) && (int) ($existing['id'] ?? 0) !== $visitId) {
            throw new VisitNotTakeableException(
                'Complete or release your current patient before taking another'
            );
        }

        $this->queueService->takePharmacyPatient($visitId, $actorUserId, $expectedVersion);
        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return $this->buildActivePayload($visitId, $actorUserId);
    }

    /**
     * @return array<string, mixed>
     */
    public function getActivePayload(int $visitId, int $actorUserId): array
    {
        $this->assertPharmacyRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_pharmacy') {
            throw new \InvalidArgumentException('Visit is not in active pharmacy work');
        }

        $this->assertActorMayWorkPharmacy($visit, $actorUserId);
        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return $this->buildActivePayload($visitId, $actorUserId);
    }

    /**
     * @return array<string, mixed>
     */
    public function completePharmacy(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        ?string $esignOverrideReason = null,
        ?string $undispensedOverrideReason = null,
        ?string $pharmacyOutcome = null,
        ?string $externalRxOverrideReason = null,
    ): array {
        $this->assertPharmacyRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_pharmacy') {
            throw new \InvalidArgumentException('Visit is not in active pharmacy work');
        }

        $this->assertActorMayWorkPharmacy($visit, $actorUserId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $pid = (int) ($visit['pid'] ?? 0);

        if ($this->walkinService->isWalkinVisit($visit) && $this->walkinService->isAncillaryEnabled($facilityId)) {
            $outcome = trim((string) ($pharmacyOutcome ?? ''));
            if ($outcome === '') {
                throw new \InvalidArgumentException('Select a pharmacy walk-in outcome before completing');
            }
            $this->walkinService->assertDispenseAllowed($pid, $outcome);
            $this->walkinService->persistDispenseOutcome($visitId, $outcome, $actorUserId);
            if ($outcome === 'external_rx_dispensed') {
                $this->externalRxService->assertComplete(
                    $pid,
                    (int) ($visit['encounter'] ?? 0),
                    $facilityId,
                    $externalRxOverrideReason,
                    $actorUserId,
                    $visitId,
                );
            }
        }

        $this->signService->assertProfileSigned($visitId, $esignOverrideReason);
        $this->assertUndispensedGateResolved($visitId, $visit, $actorUserId, $undispensedOverrideReason);

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';

        sqlBeginTrans();
        $committed = false;
        try {
            $this->queueService->transition(
                $visitId,
                'pharmacy_complete',
                $actorUserId,
                $expectedVersion,
                'pharmacy_complete'
            );

            $visit = $this->queueService->getVisitById($visitId) ?? $visit;
            $nextState = self::resolvePostPharmacyState();
            $updated = $this->queueService->transition(
                $visitId,
                $nextState,
                $actorUserId,
                (int) ($visit['row_version'] ?? 0),
                'pharmacy_auto_route'
            );
            sqlCommitTrans(true);
            $committed = true;
        } catch (\Throwable $e) {
            if (!$committed) {
                sqlCommitTrans(false);
            }
            throw $e;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy',
            $actorUserId,
            1,
            'visit_id=' . $visitId . ' routed=' . $nextState
        );

        return [
            'visit' => $this->rowEnricher->enrichVisitRow($updated),
            'new_state' => $nextState,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function skipToPayment(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        string $reason
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue')) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('Reason is required');
        }

        $this->assertPharmacyRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if (!in_array($visit['state'], ['ready_for_pharmacy', 'in_pharmacy'], true)) {
            throw new \InvalidArgumentException('Visit is not on the pharmacy queue');
        }

        $updated = $this->queueService->transition(
            $visitId,
            'ready_for_payment',
            $actorUserId,
            $expectedVersion,
            'skip_pharmacy: ' . mb_substr($reason, 0, 200)
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy',
            $actorUserId,
            1,
            'visit_id=' . $visitId . ' skip_pharmacy_to_payment'
        );

        return ['visit' => $this->rowEnricher->enrichVisitRow($updated)];
    }

    /**
     * @return array<string, mixed>
     */
    public function closeWalkinWithoutDispense(
        int $visitId,
        string $outcome,
        int $actorUserId,
        int $expectedVersion,
        ?string $esignOverrideReason = null,
    ): array {
        $this->assertPharmacyRoleEnabled();

        return $this->walkinService->closeWithoutDispense(
            $visitId,
            $outcome,
            $actorUserId,
            $expectedVersion,
            $esignOverrideReason
        );
    }

    public static function resolvePostPharmacyState(): string
    {
        return 'ready_for_payment';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getPrescriptionsForEncounter(int $pid, int $encounter): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, drug, drug_id, dosage, quantity, route, `interval`, refills,
                    start_date, end_date, filled_date, active, note
             FROM prescriptions
             WHERE patient_id = ? AND encounter = ? AND active = 1
             ORDER BY id ASC",
            [$pid, $encounter]
        ) ?: [];

        return array_map(static function (array $row): array {
            $filled = !empty($row['filled_date']) && $row['filled_date'] !== '0000-00-00';
            $sigParts = array_filter([
                (string) ($row['dosage'] ?? ''),
                (string) ($row['route'] ?? ''),
                !empty($row['interval']) ? 'q' . $row['interval'] : '',
            ]);

            return [
                'id' => (int) ($row['id'] ?? 0),
                'drug' => (string) ($row['drug'] ?? 'Medication'),
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'sig' => implode(' ', $sigParts),
                'quantity' => (string) ($row['quantity'] ?? ''),
                'refills' => (int) ($row['refills'] ?? 0),
                'status' => $filled ? 'dispensed' : 'to_dispense',
                'start_date' => $row['start_date'] ?? null,
                'end_date' => $row['end_date'] ?? null,
            ];
        }, $rows);
    }

    /**
     * @param array<int, array<string, mixed>> $prescriptions
     * @return array<int, array<string, mixed>>
     */
    private function enrichPrescriptionsWithStock(array $prescriptions, int $facilityId): array
    {
        if (!$this->pharmOpsAccess->isHubEnabled($facilityId)) {
            return array_map(static function (array $row): array {
                unset($row['drug_id']);

                return $row;
            }, $prescriptions);
        }

        return array_map(static function (array $row): array {
            $drugId = (int) ($row['drug_id'] ?? 0);
            unset($row['drug_id']);
            if ($drugId > 0) {
                $stock = PharmOpsWorklistService::stockSummaryForDrug($drugId);
                $row['stock_status'] = $stock['stock_status'];
                if (!empty($stock['qoh_display'])) {
                    $row['qoh_display'] = $stock['qoh_display'];
                }
            }

            return $row;
        }, $prescriptions);
    }

    /**
     * @return array{pharm_ops_enabled: bool, can_dispense: bool, rx_print_enabled: bool, can_print_rx: bool}
     */
    private function pharmOpsDeskFlags(int $facilityId): array
    {
        $enabled = $this->pharmOpsAccess->isHubEnabled($facilityId);
        $rxPrintEnabled = $this->pharmOpsAccess->isRxPrintEnabled($facilityId);

        return [
            'pharm_ops_enabled' => $enabled,
            'can_dispense' => $enabled && $this->pharmOpsAccess->canDispense(),
            'rx_print_enabled' => $rxPrintEnabled,
            'can_print_rx' => $rxPrintEnabled && $this->pharmOpsAccess->canPrintRx(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getPrescriptionsWithStockForEncounter(int $pid, int $encounter, int $facilityId): array
    {
        return $this->enrichPrescriptionsWithStock(
            $this->getPrescriptionsForEncounter($pid, $encounter),
            $facilityId
        );
    }

    public function rxListUrl(int $pid): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot . '/controller.php?prescription&list&id=' . urlencode((string) $pid);
    }

    private function assertPharmacyRoleEnabled(?int $facilityId = null): void
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->config->resolveReaderFacilityId();
        }
        if ($this->config->getInt('enable_pharmacy_role', 0, $facilityId) !== 1) {
            throw new \RuntimeException('Pharmacy role is disabled for this clinic', 403);
        }
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertActorMayWorkPharmacy(array $visit, int $actorUserId): void
    {
        $assigned = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($assigned > 0 && $assigned !== $actorUserId) {
            if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                throw new \InvalidArgumentException('Visit is assigned to another pharmacist');
            }
        }
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, array<string, mixed>> $holders
     * @param array<int, int> $rxCounts
     * @return array<string, mixed>
     */
    private function enrichQueueRow(
        array $row,
        int $actorUserId,
        array $holders,
        array $rxCounts,
        bool $inhousePharmacy = false,
        array $undispensedCounts = [],
    ): array {
        $visitId = (int) ($row['id'] ?? 0);
        $holder = $holders[$visitId] ?? null;
        $row['pharmacy_actor_id'] = $holder['actor_user_id'] ?? null;
        $row['pharmacy_actor_name'] = $holder['actor_name'] ?? null;
        $row['pharmacy_mine'] = !empty($holder['actor_user_id'])
            && (int) $holder['actor_user_id'] === $actorUserId;
        $row['rx_count'] = $rxCounts[$visitId] ?? 0;
        if ($inhousePharmacy) {
            $row['undispensed_rx_count'] = $undispensedCounts[$visitId] ?? 0;
        }

        return $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findActivePharmacyWork(int $facilityId, int $actorUserId): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                    vt.label AS visit_type_label
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.facility_id = ?
             AND v.state = 'in_pharmacy' AND v.assigned_provider_id = ?
             ORDER BY v.updated_at DESC LIMIT 1",
            [$facilityId, $actorUserId]
        );

        if (!is_array($row) || empty($row['id'])) {
            return null;
        }

        return $this->rowEnricher->enrichVisitRow($row);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildActivePayload(int $visitId, int $actorUserId): array
    {
        $rawVisit = $this->queueService->getVisitForActor($visitId);
        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $visit = $detail['visit'];
        $preview = $this->patientContextService->previewPayload(
            (int) $visit['pid'],
            $actorUserId,
            'pharmacy'
        );
        $prescriptions = $this->getPrescriptionsForEncounter((int) $visit['pid'], (int) $visit['encounter']);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        return array_merge(
            [
                'visit' => $visit,
                'preview' => $preview,
                'prescriptions' => $this->enrichPrescriptionsWithStock($prescriptions, $facilityId),
                'rx_list_url' => $this->rxListUrl((int) $visit['pid']),
                'skipped_triage' => $detail['skipped_triage'],
                'session_bound' => true,
                'can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
            ],
            $this->pharmOpsDeskFlags($facilityId),
            $this->undispensedDeskFlags((int) $visit['pid'], (int) $visit['encounter']),
            $this->walkinDeskFlags($rawVisit, $facilityId, (int) $visit['pid']),
        );
    }

    public function countUndispensedForEncounter(int $pid, int $encounter): int
    {
        if ($pid <= 0 || $encounter <= 0) {
            return 0;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT rx.quantity, rx.filled_date, COALESCE(ds.qty_dispensed, 0) AS qty_dispensed
             FROM prescriptions rx
             LEFT JOIN (
                 SELECT prescription_id, SUM(quantity) AS qty_dispensed
                 FROM drug_sales
                 WHERE prescription_id > 0
                 GROUP BY prescription_id
             ) ds ON ds.prescription_id = rx.id
             WHERE rx.patient_id = ? AND rx.encounter = ? AND rx.active = 1",
            [$pid, $encounter]
        ) ?: [];

        $count = 0;
        foreach ($rows as $row) {
            $qtyOrdered = PharmOpsWorklistService::parseQuantity((string) ($row['quantity'] ?? ''));
            $qtyDispensed = (int) ($row['qty_dispensed'] ?? 0);
            $filledDate = (string) ($row['filled_date'] ?? '');
            $filled = $filledDate !== '' && !str_starts_with($filledDate, '0000-00-00');
            if (PharmOpsWorklistService::classifyDispenseStatus($qtyOrdered, $qtyDispensed, $filled) !== null) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * @param array<string, mixed> $visit
     * @return array{walkin_triage?: array<string, mixed>}
     */
    private function walkinDeskFlags(array $visit, int $facilityId, int $pid): array
    {
        $triage = $this->walkinService->triagePayload($visit, $facilityId, $pid);
        if ($triage === null) {
            return [];
        }

        return [
            'walkin_triage' => $triage,
            'can_external_rx_override' => !empty($triage['external_rx']['can_override']),
        ];
    }

    private function isInhousePharmacyEnabled(): bool
    {
        return !empty($GLOBALS['inhouse_pharmacy']);
    }

    /**
     * @return array{undispensed_rx_count: int, can_undispensed_override: bool}
     */
    private function undispensedDeskFlags(int $pid, int $encounter): array
    {
        if (!$this->isInhousePharmacyEnabled()) {
            return [
                'undispensed_rx_count' => 0,
                'can_undispensed_override' => false,
            ];
        }

        return [
            'undispensed_rx_count' => $this->countUndispensedForEncounter($pid, $encounter),
            'can_undispensed_override' => AclMain::aclCheckCore(
                'new_clinic',
                'new_pharmacy_undispensed_override'
            ),
        ];
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertUndispensedGateResolved(
        int $visitId,
        array $visit,
        int $actorUserId,
        ?string $overrideReason,
    ): void {
        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        $undispensedCount = $this->countUndispensedForEncounter($pid, $encounter);
        $hasOverrideAcl = AclMain::aclCheckCore('new_clinic', 'new_pharmacy_undispensed_override');

        PharmOpsUndispensedGate::assertResolved(
            $this->isInhousePharmacyEnabled(),
            $undispensedCount,
            $overrideReason,
            $hasOverrideAcl
        );

        if ($undispensedCount > 0 && PharmOpsUndispensedGate::isOverrideAllowed($overrideReason, $hasOverrideAcl)) {
            EventAuditLogger::getInstance()->newEvent(
                'new_clinic',
                'pharmacy_ops.complete_with_undispensed',
                $actorUserId,
                1,
                'visit_id=' . $visitId
                    . ' pid=' . $pid
                    . ' encounter=' . $encounter
                    . ' undispensed=' . $undispensedCount
                    . ' reason=' . mb_substr(trim((string) $overrideReason), 0, 200)
            );
        }
    }
}
