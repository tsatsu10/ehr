<?php

/**
 * Lab Desk queue and workflow (M8)
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

class LabService
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
        private readonly LabOpsOrderMetaService $orderMeta = new LabOpsOrderMetaService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly LabDirectService $labDirectService = new LabDirectService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getLabQueue(int $facilityId, ?string $visitDate, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->assertLabRoleEnabled($facilityId);
        $visitDate = $visitDate ?? $this->clinicDate->today();
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ?
                AND v.state IN ('ready_for_lab', 'in_lab')
                ORDER BY v.is_urgent DESC, v.visit_date ASC, v.queue_number ASC, v.started_at ASC"
                . QueueLimits::limitClause(QueueLimits::QUEUE_HARD_CAP);

        $rows = QueryUtils::fetchRecords($sql, [$facilityId]) ?: [];
        [$rows, $queueTruncated] = QueueLimits::applyCap($rows, QueueLimits::QUEUE_HARD_CAP);
        $visitIds = array_map(fn (array $row) => (int) ($row['id'] ?? 0), $rows);
        $holders = $this->rowEnricher->batchLabHolders($visitIds);
        $orderCounts = $this->rowEnricher->batchLabOrderCounts($visitIds);
        $unreleasedCounts = $this->rowEnricher->batchLabUnreleasedCounts($visitIds);
        $rows = $this->rowEnricher->enrichVisitRows($rows);

        $visits = [];
        $waitingCount = 0;
        $inLabCount = 0;
        foreach ($rows as $row) {
            $enriched = $this->enrichQueueRow($row, $actorUserId, $holders, $orderCounts, $unreleasedCounts);
            $visits[] = $enriched;
            if ($enriched['state'] === 'ready_for_lab') {
                $waitingCount++;
            } else {
                $inLabCount++;
            }
        }

        $activeWork = $this->findActiveLabWork($facilityId, $actorUserId);

        return [
            'visits' => $visits,
            'queue_truncated' => $queueTruncated,
            'queue_cap' => QueueLimits::QUEUE_HARD_CAP,
            'counts' => [
                'waiting' => $waitingCount,
                'in_lab' => $inLabCount,
                'total' => count($visits),
            ],
            'active_work' => $activeWork,
            'has_active_work' => !empty($activeWork),
            'visit_date' => $visitDate,
            'last_updated' => date('c'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function selectVisit(int $visitId, int $actorUserId): array
    {
        $this->assertLabRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if (!in_array($visit['state'], ['ready_for_lab', 'in_lab'], true)) {
            throw new \InvalidArgumentException('Visit is not on the lab queue');
        }

        if ($visit['state'] === 'in_lab') {
            return $this->getActivePayload($visitId, $actorUserId);
        }

        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $preview = $this->patientContextService->previewPayload(
            (int) $visit['pid'],
            $actorUserId,
            'lab'
        );
        $orders = $this->getLabOrdersForEncounter((int) $visit['pid'], (int) $visit['encounter']);
        $criticalUnreleased = $this->countCriticalUnreleasedResults((int) $visit['pid'], (int) $visit['encounter']);
        $enrichedVisit = $detail['visit'];
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        return array_merge(
            [
                'visit' => $enrichedVisit,
                'preview' => $preview,
                'lab_orders' => $orders,
                'skipped_triage' => $detail['skipped_triage'],
                'session_bound' => false,
                'can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
                'critical_unreleased_count' => $criticalUnreleased,
                'critical_unreleased' => $criticalUnreleased > 0,
            ],
            $this->labDirectDeskFlags($visit, $facilityId, (int) $visit['pid'], count($orders)),
        );
    }

    /**
     * @param array<string, mixed> $visit
     * @return array{lab_direct_intake?: array<string, mixed>}
     */
    private function labDirectDeskFlags(array $visit, int $facilityId, int $pid, int $orderCount): array
    {
        $intake = $this->labDirectService->intakePayload($visit, $facilityId, $pid, $orderCount);

        return $intake === null ? [] : ['lab_direct_intake' => $intake];
    }

    /**
     * @return array<string, mixed>
     */
    public function takePatient(int $visitId, int $actorUserId, int $expectedVersion): array
    {
        $this->assertLabRoleEnabled();

        $visit = $this->queueService->getVisitForActor($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        $existing = $this->findActiveLabWork($facilityId, $actorUserId);
        if (!empty($existing) && (int) ($existing['id'] ?? 0) !== $visitId) {
            throw new VisitNotTakeableException(
                'Complete or release your current patient before taking another'
            );
        }

        $this->queueService->takeLabPatient($visitId, $actorUserId, $expectedVersion);
        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return $this->buildActivePayload($visitId, $actorUserId);
    }

    /**
     * @return array<string, mixed>
     */
    public function getActivePayload(int $visitId, int $actorUserId): array
    {
        $this->assertLabRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_lab') {
            throw new \InvalidArgumentException('Visit is not in active lab work');
        }

        $this->assertActorMayWorkLab($visit, $actorUserId);
        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return $this->buildActivePayload($visitId, $actorUserId);
    }

    /**
     * @return array<string, mixed>
     */
    public function completeLab(int $visitId, int $actorUserId, int $expectedVersion, ?string $esignOverrideReason = null): array
    {
        $this->assertLabRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_lab') {
            throw new \InvalidArgumentException('Visit is not in active lab work');
        }

        $this->assertActorMayWorkLab($visit, $actorUserId);
        $this->signService->assertProfileSigned($visitId, $esignOverrideReason);

        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';

        sqlBeginTrans();
        $committed = false;
        try {
            $this->queueService->transition(
                $visitId,
                'lab_complete',
                $actorUserId,
                $expectedVersion,
                'lab_complete'
            );

            $visit = $this->queueService->getVisitById($visitId) ?? $visit;
            $nextState = self::resolvePostLabState($visit, $pid, $encounter);
            $updated = $this->queueService->transition(
                $visitId,
                $nextState,
                $actorUserId,
                (int) ($visit['row_version'] ?? 0),
                'lab_auto_route'
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
            'lab',
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

        $this->assertLabRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if (!in_array($visit['state'], ['ready_for_lab', 'in_lab'], true)) {
            throw new \InvalidArgumentException('Visit is not on the lab queue');
        }

        $updated = $this->queueService->transition(
            $visitId,
            'ready_for_payment',
            $actorUserId,
            $expectedVersion,
            'skip_lab: ' . mb_substr($reason, 0, 200)
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab',
            $actorUserId,
            1,
            'visit_id=' . $visitId . ' skip_lab_to_payment'
        );

        return ['visit' => $this->rowEnricher->enrichVisitRow($updated)];
    }

    /**
     * @param array<string, mixed> $visit
     */
    public static function resolvePostLabState(array $visit, int $pid, int $encounter): string
    {
        if ((int) ($visit['pharmacy_ordered'] ?? 0) === 1) {
            return 'ready_for_pharmacy';
        }

        $rxRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM prescriptions
             WHERE patient_id = ? AND encounter = ? AND active = 1",
            [$pid, $encounter]
        );
        $rxCount = is_array($rxRow) ? (int) ($rxRow['cnt'] ?? 0) : 0;

        if ($rxCount > 0) {
            return 'ready_for_pharmacy';
        }

        return 'ready_for_payment';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getLabOrdersForEncounter(int $pid, int $encounter): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT po.procedure_order_id, po.order_status, po.date_ordered, po.lab_id,
                    poc.procedure_order_title, poc.procedure_code,
                    meta.fulfillment,
                    (
                        SELECT COUNT(DISTINCT pr.procedure_report_id)
                        FROM procedure_report pr
                        INNER JOIN procedure_result pres ON pres.procedure_report_id = pr.procedure_report_id
                        WHERE pr.procedure_order_id = po.procedure_order_id
                          AND (pr.review_status IS NULL OR pr.review_status != 'reviewed')
                          AND pres.result IS NOT NULL AND pres.result != ''
                    ) AS unreleased_count
             FROM procedure_order po
             LEFT JOIN procedure_order_code poc
                ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
             LEFT JOIN new_lab_order_meta meta ON meta.procedure_order_id = po.procedure_order_id
             WHERE po.patient_id = ? AND po.encounter_id = ? AND po.activity = 1
             ORDER BY po.procedure_order_id ASC",
            [$pid, $encounter]
        ) ?: [];

        $missingMetaIds = [];
        foreach ($rows as $row) {
            $missingMetaIds[] = (int) ($row['procedure_order_id'] ?? 0);
        }
        if ($missingMetaIds !== [] && $this->orderMeta->batchEnsureFulfillmentMeta($missingMetaIds)) {
            $rows = QueryUtils::fetchRecords(
                "SELECT po.procedure_order_id, po.order_status, po.date_ordered, po.lab_id,
                        poc.procedure_order_title, poc.procedure_code,
                        meta.fulfillment,
                        (
                            SELECT COUNT(DISTINCT pr.procedure_report_id)
                            FROM procedure_report pr
                            INNER JOIN procedure_result pres ON pres.procedure_report_id = pr.procedure_report_id
                            WHERE pr.procedure_order_id = po.procedure_order_id
                              AND (pr.review_status IS NULL OR pr.review_status != 'reviewed')
                              AND pres.result IS NOT NULL AND pres.result != ''
                        ) AS unreleased_count
                 FROM procedure_order po
                 LEFT JOIN procedure_order_code poc
                    ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
                 LEFT JOIN new_lab_order_meta meta ON meta.procedure_order_id = po.procedure_order_id
                 WHERE po.patient_id = ? AND po.encounter_id = ? AND po.activity = 1
                 ORDER BY po.procedure_order_id ASC",
                [$pid, $encounter]
            ) ?: [];
        }

        $webroot = $GLOBALS['webroot'] ?? '';
        $requisitionBase = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/lab-ops/requisition.php';

        $orderMeta = new LabOpsOrderMetaService();

        return array_map(function (array $row) use ($requisitionBase, $orderMeta): array {
            $status = strtolower((string) ($row['order_status'] ?? 'pending'));
            if ($status === '') {
                $status = 'pending';
            }

            $fulfillment = $orderMeta->resolveFulfillment(
                (string) ($row['fulfillment'] ?? ''),
                (int) ($row['lab_id'] ?? 0)
            );

            $orderId = (int) ($row['procedure_order_id'] ?? 0);

            return [
                'id' => $orderId,
                'title' => (string) ($row['procedure_order_title'] ?? 'Lab order'),
                'code' => (string) ($row['procedure_code'] ?? ''),
                'status' => $status,
                'date_ordered' => $row['date_ordered'] ?? null,
                'fulfillment' => $fulfillment,
                'fulfillment_label' => $fulfillment === 'send_out' ? 'Send-out' : 'In-house',
                'unreleased_count' => (int) ($row['unreleased_count'] ?? 0),
                'requisition_url' => $orderId > 0
                    ? $requisitionBase . '?procedure_order_id=' . urlencode((string) $orderId)
                    : null,
            ];
        }, $rows);
    }

    private function assertLabRoleEnabled(?int $facilityId = null): void
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->config->resolveReaderFacilityId();
        }
        if ($this->config->getInt('enable_lab_role', 0, $facilityId) !== 1) {
            throw new \RuntimeException('Lab role is disabled for this clinic', 403);
        }
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function assertActorMayWorkLab(array $visit, int $actorUserId): void
    {
        $assigned = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($assigned > 0 && $assigned !== $actorUserId) {
            if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                throw new \InvalidArgumentException('Visit is assigned to another lab tech');
            }
        }
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, array<string, mixed>> $holders
     * @param array<int, int> $orderCounts
     * @param array<int, int> $unreleasedCounts
     * @return array<string, mixed>
     */
    private function enrichQueueRow(
        array $row,
        int $actorUserId,
        array $holders,
        array $orderCounts,
        array $unreleasedCounts = []
    ): array {
        $visitId = (int) ($row['id'] ?? 0);
        $holder = $holders[$visitId] ?? null;
        $row['lab_actor_id'] = $holder['actor_user_id'] ?? null;
        $row['lab_actor_name'] = $holder['actor_name'] ?? null;
        $row['lab_mine'] = !empty($holder['actor_user_id'])
            && (int) $holder['actor_user_id'] === $actorUserId;
        $row['order_count'] = $orderCounts[$visitId] ?? 0;
        $row['unreleased_count'] = $unreleasedCounts[$visitId] ?? 0;

        return $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findActiveLabWork(int $facilityId, int $actorUserId): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                    vt.label AS visit_type_label
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.facility_id = ?
             AND v.state = 'in_lab' AND v.assigned_provider_id = ?
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
        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $visit = $detail['visit'];
        $preview = $this->patientContextService->previewPayload(
            (int) $visit['pid'],
            $actorUserId,
            'lab'
        );
        $orders = $this->getLabOrdersForEncounter((int) $visit['pid'], (int) $visit['encounter']);
        $criticalUnreleased = $this->countCriticalUnreleasedResults((int) $visit['pid'], (int) $visit['encounter']);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        return array_merge(
            [
                'visit' => $visit,
                'preview' => $preview,
                'lab_orders' => $orders,
                'skipped_triage' => $detail['skipped_triage'],
                'session_bound' => true,
                'can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
                'critical_unreleased_count' => $criticalUnreleased,
                'critical_unreleased' => $criticalUnreleased > 0,
            ],
            $this->labDirectDeskFlags($visit, $facilityId, (int) $visit['pid'], count($orders)),
        );
    }

    private function countCriticalUnreleasedResults(int $pid, int $encounter): int
    {
        if ($pid <= 0 || $encounter <= 0) {
            return 0;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT pr.procedure_report_id) AS cnt
             FROM procedure_order po
             INNER JOIN procedure_report pr ON pr.procedure_order_id = po.procedure_order_id
             INNER JOIN procedure_result pres ON pres.procedure_report_id = pr.procedure_report_id
             WHERE po.patient_id = ? AND po.encounter_id = ? AND po.activity = 1
               AND (pr.review_status IS NULL OR pr.review_status != 'reviewed')
               AND pres.result IS NOT NULL AND pres.result != ''
               AND pres.abnormal IN ('yes', 'high', 'low')",
            [$pid, $encounter]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }
}
