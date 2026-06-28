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
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getPharmacyQueue(int $facilityId, ?string $visitDate, int $actorUserId): array
    {
        $visitDate = $visitDate ?? date('Y-m-d');
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->assertPharmacyRoleEnabled($facilityId);
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ?
                AND v.state IN ('ready_for_pharmacy', 'in_pharmacy')
                ORDER BY v.is_urgent DESC, v.queue_number ASC, v.started_at ASC";

        $rows = QueryUtils::fetchRecords($sql, [$facilityId, $visitDate]) ?: [];
        $visitIds = array_map(fn (array $row) => (int) ($row['id'] ?? 0), $rows);
        $holders = $this->rowEnricher->batchPharmacyHolders($visitIds);
        $rxCounts = $this->rowEnricher->batchRxCounts($visitIds);

        $visits = [];
        $waitingCount = 0;
        $inPharmacyCount = 0;
        foreach ($rows as $row) {
            $enriched = $this->enrichQueueRow($row, $actorUserId, $holders, $rxCounts);
            $visits[] = $enriched;
            if ($enriched['state'] === 'ready_for_pharmacy') {
                $waitingCount++;
            } else {
                $inPharmacyCount++;
            }
        }

        $activeWork = $this->findActivePharmacyWork($facilityId, $visitDate, $actorUserId);

        return [
            'visits' => $visits,
            'counts' => [
                'waiting' => $waitingCount,
                'in_pharmacy' => $inPharmacyCount,
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

        return [
            'visit' => $detail['visit'],
            'preview' => $preview,
            'prescriptions' => $prescriptions,
            'rx_list_url' => $this->rxListUrl((int) $visit['pid']),
            'skipped_triage' => $detail['skipped_triage'],
            'session_bound' => false,
            'can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function takePatient(int $visitId, int $actorUserId, int $expectedVersion): array
    {
        $this->assertPharmacyRoleEnabled();

        $visit = $this->queueService->getVisitForActor($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $visitDate = (string) ($visit['visit_date'] ?? date('Y-m-d'));

        $existing = $this->findActivePharmacyWork($facilityId, $visitDate, $actorUserId);
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
    public function completePharmacy(int $visitId, int $actorUserId, int $expectedVersion, ?string $esignOverrideReason = null): array
    {
        $this->assertPharmacyRoleEnabled();
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_pharmacy') {
            throw new \InvalidArgumentException('Visit is not in active pharmacy work');
        }

        $this->assertActorMayWorkPharmacy($visit, $actorUserId);
        $this->signService->assertProfileSigned($visitId, $esignOverrideReason);

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
            "SELECT id, drug, dosage, quantity, route, `interval`, refills,
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
                'sig' => implode(' ', $sigParts),
                'quantity' => (string) ($row['quantity'] ?? ''),
                'refills' => (int) ($row['refills'] ?? 0),
                'status' => $filled ? 'dispensed' : 'to_dispense',
                'start_date' => $row['start_date'] ?? null,
                'end_date' => $row['end_date'] ?? null,
            ];
        }, $rows);
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
    private function enrichQueueRow(array $row, int $actorUserId, array $holders, array $rxCounts): array
    {
        $visitId = (int) ($row['id'] ?? 0);
        $row = $this->rowEnricher->enrichVisitRow($row, $visitId);
        $holder = $holders[$visitId] ?? null;
        $row['pharmacy_actor_id'] = $holder['actor_user_id'] ?? null;
        $row['pharmacy_actor_name'] = $holder['actor_name'] ?? null;
        $row['pharmacy_mine'] = !empty($holder['actor_user_id'])
            && (int) $holder['actor_user_id'] === $actorUserId;
        $row['rx_count'] = $rxCounts[$visitId] ?? 0;

        return $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findActivePharmacyWork(int $facilityId, string $visitDate, int $actorUserId): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                    vt.label AS visit_type_label
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND v.state = 'in_pharmacy' AND v.assigned_provider_id = ?
             ORDER BY v.updated_at DESC LIMIT 1",
            [$facilityId, $visitDate, $actorUserId]
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
            'pharmacy'
        );
        $prescriptions = $this->getPrescriptionsForEncounter((int) $visit['pid'], (int) $visit['encounter']);

        return [
            'visit' => $visit,
            'preview' => $preview,
            'prescriptions' => $prescriptions,
            'rx_list_url' => $this->rxListUrl((int) $visit['pid']),
            'skipped_triage' => $detail['skipped_triage'],
            'session_bound' => true,
            'can_skip_to_payment' => AclMain::aclCheckCore('new_clinic', 'new_visit_skip_queue'),
        ];
    }
}
