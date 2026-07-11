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
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly PharmacyService $pharmacyService = new PharmacyService(),
        private readonly PharmOpsAccessService $pharmOpsAccess = new PharmOpsAccessService(),
        private readonly ClinicalDocDocumentationStatusService $docStatus = new ClinicalDocDocumentationStatusService(),
        private readonly VisitRoutingService $routingService = new VisitRoutingService(),
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
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $visitDate = $visitDate ?? $this->clinicDate->today();
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $scope = $scope === 'all' ? 'all' : 'me';
        if ($this->config->getInt('enable_multi_doctor_filters', 0, $facilityId) !== 1) {
            $scope = 'all';
        }

        $advisoryEnabled = $this->routingService->isEnabled($facilityId);
        $hardAssign = new VisitHardAssignService();
        $hardAssignEnabled = $hardAssign->isEnabled($facilityId);
        $notifyService = new DoctorReadyNotifyService();

        $bind = [$facilityId];
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label,
                       u.fname AS provider_fname, u.lname AS provider_lname,
                       rs.fname AS suggested_fname, rs.lname AS suggested_lname,
                       ha.fname AS hard_fname, ha.lname AS hard_lname
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                LEFT JOIN users u ON u.id = v.assigned_provider_id
                LEFT JOIN users rs ON rs.id = v.routing_suggested_provider_id
                LEFT JOIN users ha ON ha.id = v.hard_assigned_provider_id
                WHERE v.facility_id = ?
                AND v.state = 'ready_for_doctor'";

        if ($scope === 'me') {
            if ($hardAssignEnabled) {
                $sql .= " AND (v.hard_assigned_provider_id IS NULL OR v.hard_assigned_provider_id = 0
                          OR v.hard_assigned_provider_id = ?)";
                $bind[] = $actorUserId;
            } elseif ($advisoryEnabled) {
                $sql .= " AND (v.assigned_provider_id IS NULL OR v.assigned_provider_id = 0
                          OR v.assigned_provider_id = ? OR v.routing_suggested_provider_id = ?)";
                $bind[] = $actorUserId;
                $bind[] = $actorUserId;
            } else {
                $sql .= " AND (v.assigned_provider_id IS NULL OR v.assigned_provider_id = 0 OR v.assigned_provider_id = ?)";
                $bind[] = $actorUserId;
            }
        }

        if ($advisoryEnabled) {
            $sql .= " ORDER BY CASE WHEN v.routing_suggested_provider_id = ? THEN 0 ELSE 1 END,
                      v.is_urgent DESC, v.visit_date ASC, v.queue_number ASC, v.started_at ASC";
            $bind[] = $actorUserId;
        } else {
            $sql .= " ORDER BY v.is_urgent DESC, v.visit_date ASC, v.queue_number ASC, v.started_at ASC";
        }

        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $routingByVisit = $this->labReadiness->batchRoutingChipsForVisits($rows, $facilityId);
        $rows = $this->rowEnricher->enrichVisitRows($rows);
        $visits = array_map(
            fn (array $row) => $this->enrichQueueRow(
                $row,
                $routingByVisit[(int) ($row['id'] ?? 0)] ?? null
            ),
            $rows
        );

        $activeConsult = $this->findActiveConsult($facilityId, $actorUserId, $routingByVisit);
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
            'advisory_routing_enabled' => $advisoryEnabled,
            'hard_provider_assignment_enabled' => $hardAssignEnabled,
            'doctor_ready_notify_enabled' => $notifyService->isEnabled($facilityId),
            'can_take_assigned_override' => $hardAssign->canOverrideTake($actorUserId),
            'ready_notify_pending' => $notifyService->listPendingForDoctor($actorUserId, $facilityId),
            'require_override_reason' => $this->config->getInt('require_override_reason', 0, $facilityId) === 1,
            'my_user_id' => $actorUserId,
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
    public function takePatient(int $visitId, int $actorUserId, int $expectedVersion, ?string $overrideReason = null): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        $existing = $this->findActiveConsult($facilityId, $actorUserId);
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

        (new VisitHardAssignService())->assertCanTake($visit, $actorUserId, $overrideReason);

        $this->queueService->takePatient($visitId, $actorUserId, $expectedVersion, $overrideReason);
        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        return $this->buildConsultPayload($visitId, $actorUserId);
    }

    /**
     * Doctor's own walk-in bypass — patient never passed through Front Desk or Triage. Same
     * "one active consult at a time" guard as taking a patient off the shared queue.
     */
    public function startWalkIn(
        int $pid,
        int $visitTypeId,
        int $actorUserId,
        ?int $facilityId = null,
        ?string $chiefComplaint = null
    ): array {
        $resolvedFacilityId = $this->visitScope->resolveActorFacilityId($facilityId);
        $existing = $this->findActiveConsult($resolvedFacilityId, $actorUserId);
        if (!empty($existing)) {
            throw new VisitNotTakeableException(
                'Complete or release your current patient before starting a new one'
            );
        }

        $visit = $this->queueService->startVisitWithDoctor(
            $pid,
            $visitTypeId,
            $actorUserId,
            $resolvedFacilityId,
            $chiefComplaint
        );
        $visitId = (int) ($visit['id'] ?? 0);
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
                $this->signService->assertConsultSigned($encounterId, $pid, $visit);
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
    /**
     * Reopening your own patient's own visit is frictionless by design — same encounter, same
     * doctor, nothing new to justify (reason is optional and ignored). Reopening a visit assigned
     * to someone else (admin-only path) still requires a real reason — that's the actual
     * oversight-worthy action, not a doctor picking their own patient back up.
     */
    public function reopenConsult(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        ?string $reason = null
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_visit_reopen')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
            && !AclMain::aclCheckCore('admin', 'super')) {
            throw new \InvalidArgumentException('Not authorized to reopen consult');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $fromState = (string) ($visit['state'] ?? '');
        if (!VisitFsm::canReverseTransition($fromState, 'with_doctor')) {
            throw new \InvalidArgumentException('Visit cannot be reopened from state ' . $fromState);
        }

        // The doctor who actually conducted the consult — not new_visit.assigned_provider_id,
        // which lab/pharmacy overwrite once they take the patient after the doctor releases it.
        $assigned = $this->queueService->lastDoctorForVisit($visitId);
        $isAdmin = AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('admin', 'super');
        $isOwnVisit = $assigned > 0 && $assigned === $actorUserId;
        if ($assigned > 0 && !$isOwnVisit && !$isAdmin) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        $reason = trim((string) ($reason ?? ''));
        if (!$isOwnVisit && mb_strlen($reason) < 10) {
            throw new \InvalidArgumentException('Reopen reason must be at least 10 characters');
        }

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $existing = $this->findActiveConsult($facilityId, $actorUserId);
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
            $reason !== '' ? $reason : 'self_reopen',
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
        $providerName = trim(($row['provider_fname'] ?? '') . ' ' . ($row['provider_lname'] ?? ''));
        if ($providerName !== '') {
            $row['assigned_provider_name'] = $providerName;
        }
        $suggestedName = trim(($row['suggested_fname'] ?? '') . ' ' . ($row['suggested_lname'] ?? ''));
        $suggestedId = (int) ($row['routing_suggested_provider_id'] ?? 0);
        if ($suggestedId > 0) {
            $row['routing_suggested_provider_id'] = $suggestedId;
            if ($suggestedName !== '') {
                $row['routing_suggested_provider_name'] = $suggestedName;
            }
        }
        $hardName = trim(($row['hard_fname'] ?? '') . ' ' . ($row['hard_lname'] ?? ''));
        $hardId = (int) ($row['hard_assigned_provider_id'] ?? 0);
        if ($hardId > 0) {
            $row['hard_assigned_provider_id'] = $hardId;
            if ($hardName !== '') {
                $row['hard_assigned_provider_name'] = $hardName;
            }
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
        int $actorUserId,
        array $routingByVisit = []
    ): ?array {
        $row = QueryUtils::querySingleRow(
            "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                    vt.label AS visit_type_label
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.facility_id = ?
             AND v.state = 'with_doctor' AND v.assigned_provider_id = ?
             ORDER BY v.updated_at DESC LIMIT 1",
            [$facilityId, $actorUserId]
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

        $row = $this->rowEnricher->enrichVisitRow($row, $visitId);

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

        // last_doctor_id: who actually conducted the consult — NOT v.assigned_provider_id, which
        // is a generic "current holder" overwritten by lab/pharmacy once they take the patient.
        // Filtering on this (via HAVING) keeps "my reopenable patients" correct even after the
        // visit has moved through ancillary desks since the consult.
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label,
                       (SELECT sl.actor_user_id FROM new_visit_state_log sl
                        WHERE sl.visit_id = v.id AND sl.to_state = 'with_doctor'
                        ORDER BY sl.id DESC LIMIT 1) AS last_doctor_id
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ?
                AND v.state IN ({$placeholders})";

        if (!$canReopenAny) {
            $sql .= " HAVING last_doctor_id = ?";
            $bind[] = $actorUserId;
        }

        $sql .= " ORDER BY v.updated_at DESC LIMIT 15";

        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];

        // Lab-ready badge — same neutral "a result exists" signal as the live queue and Visit
        // Board, no severity judgment (see LabOpsResultService::orderHasAbnormal for that).
        $labChips = $this->labReadiness->batchRoutingChipsForVisits($rows, $facilityId);
        foreach ($rows as &$row) {
            $visitId = (int) ($row['id'] ?? 0);
            $row['lab_results_ready'] = !empty($labChips[$visitId]['results_ready']);
            // Overwrite the raw (stale) v.assigned_provider_id with the true consulting doctor
            // so the frontend's "is this my own patient" check is correct for reopenable rows.
            $row['assigned_provider_id'] = (int) ($row['last_doctor_id'] ?? 0) ?: null;
        }
        unset($row);

        return $this->rowEnricher->enrichVisitRows($rows);
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

        return $this->rowEnricher->enrichVisitRows($rows);
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

        $supervisorMeta = $this->getSupervisorMeta((int) $visit['encounter'], $actorUserId);
        $pharmOpsEnabled = $this->pharmOpsAccess->isHubEnabled($facilityId);
        $rxPrintEnabled = $this->pharmOpsAccess->isRxPrintEnabled($facilityId);
        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];

        $payload = [
            'visit' => $visit,
            'preview' => $preview,
            'vitals_warnings' => $warnings,
            'skipped_triage' => $detail['skipped_triage'],
            'routing_chips' => $routingChips,
            'routing_preview' => $this->getRoutingPreview($visitId, $actorUserId),
            'session_bound' => true,
            'encounter_signed' => $this->signService->isVisitDocumentationSigned($visit),
            'require_esign_before_complete_consult' => $this->config->getInt(
                'require_esign_before_complete_consult',
                0,
                (int) ($visit['facility_id'] ?? 0)
            ) === 1,
            'encounter_url' => $this->signService->buildOpenUrlForVisit($visit, [
                'return_to' => 'doctor',
                'tab' => 'consult',
            ]),
            'supervisor_id' => $supervisorMeta['supervisor_id'],
            'supervisor_display_name' => $supervisorMeta['supervisor_display_name'],
            'supervisor_from_profile' => $supervisorMeta['supervisor_from_profile'],
            'pharm_ops_enabled' => $pharmOpsEnabled,
            'rx_print_enabled' => $rxPrintEnabled,
            'can_print_rx' => $rxPrintEnabled && $this->pharmOpsAccess->canPrintRx(),
        ];

        if ($pharmOpsEnabled || $rxPrintEnabled) {
            $payload['prescriptions'] = $this->pharmacyService->getPrescriptionsWithStockForEncounter(
                $pid,
                $encounter,
                $facilityId
            );
            $payload['rx_list_url'] = $this->pharmacyService->rxListUrl($pid);
        }

        $docStatus = $this->docStatus->getStatusForVisit($visit, $facilityId);
        $payload['clinical_doc_hub_enabled'] = (bool) ($docStatus['hub_enabled'] ?? false);
        $payload['documentation_status'] = $docStatus;

        return $payload;
    }

    private function canOverrideEsign(?string $reason): bool
    {
        return trim((string) $reason) !== ''
            && AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete');
    }

    /**
     * Get supervisor metadata for encounter
     * Returns supervisor_id from encounter, display name, and whether it came from profile default
     *
     * @param int $encounterId
     * @param int $actorUserId
     * @return array{supervisor_id: int|null, supervisor_display_name: string|null, supervisor_from_profile: bool}
     */
    public function getSupervisorMeta(int $encounterId, int $actorUserId): array
    {
        $encounter = sqlQuery(
            "SELECT supervisor_id FROM form_encounter WHERE encounter = ?",
            [$encounterId]
        );

        $supervisorId = isset($encounter['supervisor_id']) && (int) $encounter['supervisor_id'] > 0
            ? (int) $encounter['supervisor_id']
            : null;

        if ($supervisorId === null) {
            return [
                'supervisor_id' => null,
                'supervisor_display_name' => null,
                'supervisor_from_profile' => false,
            ];
        }

        $supervisor = sqlQuery(
            "SELECT fname, lname FROM users WHERE id = ?",
            [$supervisorId]
        );

        $displayName = $supervisor
            ? trim(($supervisor['fname'] ?? '') . ' ' . ($supervisor['lname'] ?? ''))
            : null;

        // Check if this supervisor came from actor's profile default
        $actorProfile = sqlQuery(
            "SELECT supervisor_id FROM users WHERE id = ?",
            [$actorUserId]
        );
        $fromProfile = isset($actorProfile['supervisor_id'])
            && (int) $actorProfile['supervisor_id'] === $supervisorId;

        return [
            'supervisor_id' => $supervisorId,
            'supervisor_display_name' => $displayName,
            'supervisor_from_profile' => $fromProfile,
        ];
    }

    /**
     * Set or clear supervising provider for an encounter
     *
     * @param int $encounterId
     * @param int|null $supervisorId - Provider user ID or null to clear
     * @param int $actorUserId - User making the change
     * @return array<string, mixed>
     */
    public function setSupervisor(int $encounterId, ?int $supervisorId, int $actorUserId): array
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_doctor')) {
            throw new \InvalidArgumentException('Not authorized to set supervisor');
        }

        if ($encounterId <= 0) {
            throw new \InvalidArgumentException('Invalid encounter ID');
        }

        // If setting a supervisor, validate that the supervisor exists and is a provider
        if ($supervisorId !== null && $supervisorId > 0) {
            $supervisor = sqlQuery(
                "SELECT id, fname, lname FROM users WHERE id = ? AND active = 1",
                [$supervisorId]
            );

            if (!$supervisor) {
                throw new \InvalidArgumentException('Invalid supervisor ID');
            }

            // Don't allow doctor to supervise themselves
            $encounter = sqlQuery(
                "SELECT provider_id FROM form_encounter WHERE encounter = ?",
                [$encounterId]
            );

            if ($encounter && (int) ($encounter['provider_id'] ?? 0) === $supervisorId) {
                throw new \InvalidArgumentException('Cannot supervise own consult');
            }
        }

        // Update encounter supervisor
        sqlStatement(
            "UPDATE form_encounter SET supervisor_id = ? WHERE encounter = ?",
            [$supervisorId, $encounterId]
        );

        // Audit the change
        $this->queueService->audit('form_encounter', 'supervisor_set', 0, $encounterId, [
            'supervisor_id' => $supervisorId,
            'actor' => $actorUserId,
        ]);

        return $this->getSupervisorMeta($encounterId, $actorUserId);
    }

    /**
     * Search providers for supervisor combobox
     *
     * @param string $query - Search term
     * @param int $facilityId - Facility to scope search
     * @param int $excludeUserId - User ID to exclude (consulting doctor)
     * @return array<int, array<string, mixed>>
     */
    public function searchProviders(string $query, int $facilityId, int $excludeUserId): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        $likeQuery = '%' . $query . '%';

        $sql = "SELECT u.id, u.fname, u.lname, u.username
                FROM users u
                WHERE u.active = 1
                AND u.id != ?
                AND (u.fname LIKE ? OR u.lname LIKE ? OR u.username LIKE ?)
                ORDER BY u.lname, u.fname
                LIMIT 20";

        $rows = QueryUtils::fetchRecords($sql, [$excludeUserId, $likeQuery, $likeQuery, $likeQuery]) ?: [];

        return array_map(function ($row) {
            return [
                'id' => (int) $row['id'],
                'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
                'username' => $row['username'] ?? '',
            ];
        }, $rows);
    }
}
