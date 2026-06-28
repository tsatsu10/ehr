<?php

/**
 * Doctor Desk queue and consult workflow (M4)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;

class DoctorService
{
    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitBoardService $boardService = new VisitBoardService(),
        private readonly PatientContextService $patientContextService = new PatientContextService(),
        private readonly EncounterSessionService $encounterSessionService = new EncounterSessionService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VitalsPreviewBuilder $vitalsPreview = new VitalsPreviewBuilder(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly LabResultsReadinessService $labReadiness = new LabResultsReadinessService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getDoctorQueue(
        int $facilityId,
        ?string $visitDate,
        int $actorUserId,
        string $scope = 'me'
    ): array {
        $visitDate = $visitDate ?? date('Y-m-d');
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $scope = $scope === 'all' ? 'all' : 'me';
        if ($this->config->getInt('enable_multi_doctor_filters', 0, $facilityId) !== 1) {
            $scope = 'all';
        }

        $bind = [$facilityId, $visitDate];
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label,
                       u.fname AS provider_fname, u.lname AS provider_lname
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                LEFT JOIN users u ON u.id = v.assigned_provider_id
                WHERE v.facility_id = ? AND v.visit_date = ?
                AND v.state = 'ready_for_doctor'";

        if ($scope === 'me') {
            $sql .= " AND (v.assigned_provider_id IS NULL OR v.assigned_provider_id = 0 OR v.assigned_provider_id = ?)";
            $bind[] = $actorUserId;
        }

        $sql .= " ORDER BY v.is_urgent DESC, v.queue_number ASC, v.started_at ASC";

        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $routingByVisit = $this->labReadiness->batchRoutingChipsForVisits($rows, $facilityId);
        $visits = array_map(
            fn (array $row) => $this->enrichQueueRow(
                $row,
                $routingByVisit[(int) ($row['id'] ?? 0)] ?? null
            ),
            $rows
        );

        $activeConsult = $this->findActiveConsult($facilityId, $visitDate, $actorUserId, $routingByVisit);
        $doneToday = $this->fetchDoneToday($facilityId, $visitDate, $actorUserId);
        $canReopenAny = AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super');
        $canReopenConsult = AclMain::aclCheckCore('new_clinic', 'new_visit_reopen') || $canReopenAny;
        $reopenableToday = $canReopenConsult
            ? $this->fetchReopenableToday($facilityId, $visitDate, $actorUserId, $canReopenAny)
            : [];

        return [
            'visits' => $visits,
            'counts' => [
                'waiting' => count($visits),
                'done_today' => count($doneToday),
                'reopenable_today' => count($reopenableToday),
            ],
            'active_consult' => $activeConsult,
            'has_active_consult' => !empty($activeConsult),
            'visit_date' => $visitDate,
            'scope' => $scope,
            'last_updated' => date('c'),
            'done_today' => $doneToday,
            'reopenable_today' => $reopenableToday,
            'can_reopen_consult' => $canReopenConsult,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getActiveConsultPayload(int $visitId, int $actorUserId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'with_doctor') {
            throw new \InvalidArgumentException('Visit is not in active consult');
        }

        if ((int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return $this->buildConsultPayload($visitId, $actorUserId);
    }

    /**
     * @return array<string, mixed>
     */
    public function takePatient(int $visitId, int $actorUserId, int $expectedVersion): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $visitDate = (string) ($visit['visit_date'] ?? date('Y-m-d'));

        $existing = $this->findActiveConsult($facilityId, $visitDate, $actorUserId);
        if (!empty($existing) && (int) ($existing['id'] ?? 0) !== $visitId) {
            throw new VisitNotTakeableException(
                'Complete or release your current patient before taking another'
            );
        }

        $assigned = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($assigned > 0 && $assigned !== $actorUserId) {
            if (!AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                throw new VisitNotTakeableException('Visit is assigned to another provider');
            }
        }

        $this->queueService->takePatient($visitId, $actorUserId, $expectedVersion);
        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return $this->buildConsultPayload($visitId, $actorUserId);
    }

    /**
     * @return array<string, mixed>
     */
    public function completeConsult(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        bool $needsLab,
        bool $needsRx,
        ?string $notes = null,
        ?string $esignOverrideReason = null
    ): array {
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'with_doctor') {
            throw new \InvalidArgumentException('Visit is not in active consult');
        }

        if ((int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        if ($needsLab && $needsRx) {
            throw new \InvalidArgumentException('Choose lab or pharmacy routing, not both');
        }

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if ($this->config->getInt('require_esign_before_complete_consult', 0, $facilityId) === 1) {
            $pid = (int) ($visit['pid'] ?? 0);
            $encounterId = (int) ($visit['encounter'] ?? 0);
            if (!$this->canOverrideEsign($esignOverrideReason)) {
                $this->signService->assertConsultSigned($encounterId, $pid);
            } else {
                $this->signService->assertProfileSigned($visitId, $esignOverrideReason);
            }
        }

        $newState = self::resolveConsultTargetState($needsLab, $needsRx);

        $updated = $this->queueService->transition(
            $visitId,
            $newState,
            $actorUserId,
            $expectedVersion,
            'complete_consult' . ($notes ? ': ' . mb_substr(trim($notes), 0, 200) : ''),
            null,
            null,
            $needsRx
        );

        return [
            'visit' => $this->rowEnricher->enrichVisitRow($updated),
            'new_state' => $newState,
            'routing_method' => 'manual',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function reopenConsult(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        string $reason
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_visit_reopen')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
            && !AclMain::aclCheckCore('admin', 'super')) {
            throw new \InvalidArgumentException('Not authorized to reopen consult');
        }

        $reason = trim($reason);
        if (mb_strlen($reason) < 10) {
            throw new \InvalidArgumentException('Reopen reason must be at least 10 characters');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $fromState = (string) ($visit['state'] ?? '');
        if (!VisitFsm::canReverseTransition($fromState, 'with_doctor')) {
            throw new \InvalidArgumentException('Visit cannot be reopened from state ' . $fromState);
        }

        $assigned = (int) ($visit['assigned_provider_id'] ?? 0);
        $isAdmin = AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super');
        if ($assigned > 0 && $assigned !== $actorUserId && !$isAdmin) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $visitDate = (string) ($visit['visit_date'] ?? date('Y-m-d'));
        $existing = $this->findActiveConsult($facilityId, $visitDate, $actorUserId);
        if (!empty($existing) && (int) ($existing['id'] ?? 0) !== $visitId) {
            throw new VisitNotTakeableException(
                'Complete or release your current patient before reopening another'
            );
        }

        $providerId = $assigned > 0 ? $assigned : $actorUserId;
        $updated = $this->queueService->reopenToWithDoctor(
            $visitId,
            $actorUserId,
            $expectedVersion,
            $reason,
            $providerId
        );
        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return [
            'visit' => $this->rowEnricher->enrichVisitRow($updated),
            'new_state' => 'with_doctor',
            'consult' => $this->buildConsultPayload($visitId, $actorUserId),
        ];
    }

    /**
     * @throws \InvalidArgumentException when both routing flags are set
     */
    public static function resolveConsultTargetState(bool $needsLab, bool $needsRx): string
    {
        if ($needsLab && $needsRx) {
            throw new \InvalidArgumentException('Choose lab or pharmacy routing, not both');
        }

        if ($needsLab) {
            return 'ready_for_lab';
        }

        if ($needsRx) {
            return 'ready_for_pharmacy';
        }

        return 'ready_for_payment';
    }

    /**
     * @return array<string, mixed>
     */
    public function getRoutingPreview(int $visitId, int $actorUserId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];

        $labRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM procedure_order
             WHERE patient_id = ? AND encounter_id = ? AND activity = 1",
            [$pid, $encounter]
        );
        $labCount = is_array($labRow) ? (int) ($labRow['cnt'] ?? 0) : 0;

        $rxRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM prescriptions
             WHERE patient_id = ? AND encounter = ? AND active = 1",
            [$pid, $encounter]
        );
        $rxCount = is_array($rxRow) ? (int) ($rxRow['cnt'] ?? 0) : 0;

        return [
            'detected_lab' => $labCount > 0,
            'detected_rx' => $rxCount > 0,
            'lab_count' => $labCount,
            'rx_count' => $rxCount,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed>|null $routingChips
     * @return array<string, mixed>
     */
    private function enrichQueueRow(array $row, ?array $routingChips = null): array
    {
        $row = $this->rowEnricher->enrichVisitRow($row);
        $providerName = trim(($row['provider_fname'] ?? '') . ' ' . ($row['provider_lname'] ?? ''));
        if ($providerName !== '') {
            $row['assigned_provider_name'] = $providerName;
        }
        if ($routingChips !== null) {
            $row['routing_chips'] = $routingChips;
        }

        return $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    /**
     * @param array<int, array<string, mixed>> $routingByVisit
     */
    private function findActiveConsult(
        int $facilityId,
        string $visitDate,
        int $actorUserId,
        array $routingByVisit = []
    ): ?array {
        $row = QueryUtils::querySingleRow(
            "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                    vt.label AS visit_type_label
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.facility_id = ? AND v.visit_date = ?
             AND v.state = 'with_doctor' AND v.assigned_provider_id = ?
             ORDER BY v.updated_at DESC LIMIT 1",
            [$facilityId, $visitDate, $actorUserId]
        );

        if (!is_array($row) || empty($row['id'])) {
            return null;
        }

        $visitId = (int) ($row['id'] ?? 0);
        $chips = $routingByVisit[$visitId] ?? null;
        if ($chips === null) {
            $batch = $this->labReadiness->batchRoutingChipsForVisits([$row], $facilityId);
            $chips = $batch[$visitId] ?? null;
        }

        return $this->enrichQueueRow($row, $chips);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchReopenableToday(int $facilityId, string $visitDate, int $actorUserId, bool $canReopenAny): array
    {
        $states = VisitFsm::REOPEN_SOURCE_STATES;
        $placeholders = implode(',', array_fill(0, count($states), '?'));
        $bind = array_merge([$facilityId, $visitDate], $states);

        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ?
                AND v.state IN ({$placeholders})";

        if (!$canReopenAny) {
            $sql .= " AND v.assigned_provider_id = ?";
            $bind[] = $actorUserId;
        }

        $sql .= " ORDER BY v.updated_at DESC LIMIT 15";

        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];

        return array_map(fn (array $row) => $this->rowEnricher->enrichVisitRow($row), $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchDoneToday(int $facilityId, string $visitDate, int $actorUserId): array
    {
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ?
                AND v.state = 'completed' AND v.assigned_provider_id = ?
                ORDER BY v.updated_at DESC LIMIT 10";

        $rows = QueryUtils::fetchRecords($sql, [$facilityId, $visitDate, $actorUserId]) ?: [];

        return array_map(fn (array $row) => $this->rowEnricher->enrichVisitRow($row), $rows);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildConsultPayload(int $visitId, int $actorUserId): array
    {
        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $visit = $detail['visit'];
        $preview = $this->patientContextService->previewPayload(
            (int) $visit['pid'],
            $actorUserId,
            'doctor'
        );

        $vitalsRows = $this->vitalsPreview->getEncounterVitals((int) $visit['pid'], (int) $visit['encounter']);
        $warnings = $this->vitalsPreview->evaluateWarnings($vitalsRows);
        $preview = $this->vitalsPreview->mergeIntoPreview($preview, $vitalsRows, $warnings, false);

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $routingChips = $this->labReadiness->getEncounterRouting(
            (int) $visit['pid'],
            (int) $visit['encounter'],
            $facilityId
        );

        return [
            'visit' => $visit,
            'preview' => $preview,
            'vitals_warnings' => $warnings,
            'skipped_triage' => $detail['skipped_triage'],
            'routing_chips' => $routingChips,
            'routing_preview' => $this->getRoutingPreview($visitId, $actorUserId),
            'session_bound' => true,
            'encounter_signed' => $this->signService->isConsultSigned((int) $visit['encounter']),
            'require_esign_before_complete_consult' => $this->config->getInt(
                'require_esign_before_complete_consult',
                0,
                (int) ($visit['facility_id'] ?? 0)
            ) === 1,
            'encounter_url' => EncounterSignService::buildEncounterUrl(
                $GLOBALS['webroot'] ?? '',
                (int) $visit['pid'],
                (int) $visit['encounter']
            ),
        ];
    }

    private function canOverrideEsign(?string $reason): bool
    {
        return trim((string) $reason) !== ''
            && AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete');
    }
}
