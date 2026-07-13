<?php

/**
 * Visit queue service (M0)
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
use OpenEMR\Modules\NewClinic\Exceptions\StaleVisitException;
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
use OpenEMR\Modules\NewClinic\Support\VisitTransitionConflictResolver;
use OpenEMR\Services\AppointmentService;
use OpenEMR\Services\EncounterService;
use OpenEMR\Services\PatientService;

class VisitQueueService
{
    public function __construct(
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly RevisitCompletionGateService $revisitGate = new RevisitCompletionGateService(),
        private readonly ReferralDocumentService $referralDocuments = new ReferralDocumentService(),
    ) {
    }

    public function getQueue(array $filters = []): array
    {
        $facilityId = (int) ($filters['facility_id'] ?? 0);
        if ($facilityId === 0) {
            $facilityId = $this->visitScope->resolveDefaultFacilityId();
        }
        $this->visitScope->assertFacilityAccessible($facilityId);

        // Active visits: no date cap — visible until explicitly closed.
        // Terminal visits (completed / cancelled / closed_unpaid): date-bounded
        // to today so done lists reset each morning.
        // An explicit visit_date from the caller overrides this (historical view).
        $visitDate = $filters['visit_date'] ?? null;
        $today = $this->clinicDate->today();
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate ?? $today);

        $state = $filters['state'] ?? null;
        $bind = [$facilityId];

        if (!empty($state)) {
            // Explicit state filter — caller knows what they want; honour it.
            $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid
                    FROM new_visit v
                    INNER JOIN patient_data pd ON pd.pid = v.pid
                    WHERE v.facility_id = ?";

            if ($visitDate !== null) {
                $sql .= " AND v.visit_date = ?";
                $bind[] = $visitDate;
            }

            if (is_array($state)) {
                $placeholders = implode(',', array_fill(0, count($state), '?'));
                $sql .= " AND v.state IN ($placeholders)";
                $bind = array_merge($bind, $state);
            } else {
                $sql .= " AND v.state = ?";
                $bind[] = $state;
            }
        } else {
            // Default: all active states (no date cap) + terminal states for today only.
            $dateScope = $visitDate ?? $today;
            $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid
                    FROM new_visit v
                    INNER JOIN patient_data pd ON pd.pid = v.pid
                    WHERE v.facility_id = ?
                    AND (
                        v.state NOT IN ('completed', 'closed_unpaid', 'cancelled')
                        OR v.visit_date = ?
                    )";
            $bind[] = $dateScope;
        }

        $sql .= " ORDER BY v.is_urgent DESC, v.visit_date ASC, v.queue_number ASC, v.started_at ASC"
            . QueueLimits::limitClause(QueueLimits::QUEUE_HARD_CAP);

        // SCALE-1.2 (R1): hard cap. The +1 fetched by limitClause is sliced off here.
        [$rows] = QueueLimits::applyCap(QueryUtils::fetchRecords($sql, $bind) ?: [], QueueLimits::QUEUE_HARD_CAP);

        return $rows;
    }

    /**
     * Aggregate today's visit counts for T1 queue stats strip.
     *
     * @return array<string, int>
     */
    public function getCounts(int $facilityId = 0, ?string $visitDate = null): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $canonicalDate = $visitDate ?? $this->clinicDate->today();

        // SCALE-3.3 — every open shell polls queue.counts every 30 s; a 5 s
        // per-facility cache absorbs that fleet-wide load almost entirely. Keyed
        // AFTER facility resolution (facility scoping is per-actor), date included
        // so midnight rollover and explicit-date callers never mix buckets. A ≤5 s
        // stale badge is invisible next to the 30 s poll interval.
        //
        // SCALE-6.1 — served via remember() (serve-stale-while-one-rebuilds), not a
        // bare get/set: without it, all open tabs miss together at each 5 s expiry
        // and re-run the GROUP BY + repair simultaneously (a stampede). Now only the
        // lock winner rebuilds; the rest serve the ≤5 s-stale value. 5 s fresh /
        // 30 s hard (hard ≤ 30 s keeps cross-server staleness bounded, BP-5; polls
        // every ~30 s always trigger the rebuild well before the hard ceiling, so
        // the badge stays ~5 s fresh in practice).
        $cacheKey = 'counts:' . $facilityId . ':' . $canonicalDate;
        $counts = (new CacheService())->remember($cacheKey, 5, 30, function () use ($facilityId, $canonicalDate): array {
            // Repair runs only for the rebuilder now (not every miss); it has its
            // own SCALE-1.3 maintenance-lock throttle regardless.
            $this->visitScope->repairOrphanVisits($facilityId, $canonicalDate);

            // Counts cover all open visits (no date cap) + date-bounded terminal
            // states so the stats strip accurately reflects the live workload.
            $rows = QueryUtils::fetchRecords(
                "SELECT state, COUNT(*) AS cnt FROM new_visit
                 WHERE facility_id = ? AND (
                     state NOT IN ('completed', 'closed_unpaid', 'cancelled')
                     OR visit_date = ?
                 )
                 GROUP BY state",
                [$facilityId, $canonicalDate]
            ) ?: [];

            $byState = [];
            foreach ($rows as $row) {
                $byState[(string) $row['state']] = (int) $row['cnt'];
            }

            $result = [];
            foreach (VisitBoardService::COLUMN_STATES as $key => $states) {
                $result[$key] = 0;
                foreach ($states as $state) {
                    $result[$key] += $byState[$state] ?? 0;
                }
            }
            $result['cancelled'] = $byState['cancelled'] ?? 0;
            $result['closed_unpaid'] = $byState['closed_unpaid'] ?? 0;

            return $result;
        });

        // Defensive (BP-8): remember() returns the producer's array on every real
        // path, but a corrupt/foreign cache wrapper (non-array nc_v) must degrade
        // soft, not fatal array_map(). Such a row self-expires within the hard TTL.
        /** @var array<string, int> $counts */
        return array_map('intval', is_array($counts) ? $counts : []);
    }

    public function getVisitById(int $visitId): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT * FROM new_visit WHERE id = ?",
            [$visitId]
        );

        return empty($row) ? null : $row;
    }

    /**
     * The doctor who actually conducted the consult — NOT `new_visit.assigned_provider_id`,
     * which is a generic "current holder" field overwritten by whichever desk (lab, pharmacy)
     * takes the patient next. Reads the state log for the last transition INTO `with_doctor`,
     * which survives every downstream desk touching the visit afterward. Returns 0 if the visit
     * never reached a doctor.
     */
    public function lastDoctorForVisit(int $visitId): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT actor_user_id FROM new_visit_state_log
             WHERE visit_id = ? AND to_state = 'with_doctor'
             ORDER BY id DESC LIMIT 1",
            [$visitId]
        );

        return is_array($row) ? (int) ($row['actor_user_id'] ?? 0) : 0;
    }

    /**
     * @return array<string, mixed>
     */
    public function getVisitForActor(int $visitId): array
    {
        $visit = $this->getVisitById($visitId);
        if (empty($visit)) {
            throw new \InvalidArgumentException('Visit not found');
        }

        $visit = $this->visitScope->normalizeVisitFacility($visit);
        $this->visitScope->assertVisitAccessible($visit);

        return $visit;
    }

    public function assertCanStartVisit(int $pid, int $facilityId): ?array
    {
        $allowMultiple = $this->config->getInt('allow_multiple_visits_per_day', 1, $facilityId) === 1;

        $today = $this->clinicDate->today();
        if ($allowMultiple) {
            $sql = "SELECT * FROM new_visit
                    WHERE pid = ? AND facility_id = ?
                    AND state NOT IN ('completed', 'closed_unpaid', 'cancelled')
                    ORDER BY id DESC LIMIT 1";
            $bind = [$pid, $facilityId];
        } else {
            $sql = "SELECT * FROM new_visit
                    WHERE pid = ? AND facility_id = ? AND visit_date = ?
                    AND state != 'cancelled'
                    ORDER BY id DESC LIMIT 1";
            $bind = [$pid, $facilityId, $today];
        }

        $row = QueryUtils::querySingleRow($sql, $bind);
        if (empty($row)) {
            return null;
        }

        return $this->visitScope->normalizeVisitFacility($row);
    }

    public function startVisit(
        int $pid,
        int $visitTypeId,
        int $actorUserId,
        ?int $facilityId = null,
        ?string $chiefComplaint = null,
        bool $isUrgent = false,
        ?string $revisitOverrideReason = null,
        ?int $referralDocumentId = null,
    ): array {
        return $this->createVisit(
            $pid,
            $visitTypeId,
            $actorUserId,
            $facilityId,
            $chiefComplaint,
            $isUrgent,
            null,
            null,
            null,
            null,
            null,
            null,
            $revisitOverrideReason,
            $referralDocumentId
        );
    }

    /**
     * Atomic scheduled arrival: encounter + new_visit + optional @ Arrived (M0-F16).
     *
     * @return array{visit: array<string, mixed>, recurring_guard_fired: bool, appointment_status_updated: bool}
     */
    public function startVisitFromAppointment(
        int $pid,
        int $pcEid,
        string $apptDate,
        int $actorUserId,
        ?int $visitTypeId = null,
        ?int $facilityId = null,
        ?string $chiefComplaint = null,
        bool $isUrgent = false,
        ?string $revisitOverrideReason = null
    ): array {
        $facilityId = $facilityId ?? $this->visitScope->resolveActorFacilityId(null);
        $appointmentService = new AppointmentTodayService();
        $appointment = $appointmentService->getAppointmentForCheckIn($pid, $pcEid, $apptDate, $facilityId);
        if ($appointment === null) {
            throw new \InvalidArgumentException('Appointment not found or not eligible for check-in today');
        }

        $resolvedVisitTypeId = $visitTypeId ?? 0;
        if ($resolvedVisitTypeId <= 0) {
            $resolvedVisitTypeId = $appointmentService->resolveVisitTypeIdForCategory(
                (int) ($appointment['pc_catid'] ?? 0),
                $facilityId
            ) ?? 0;
        }
        if ($resolvedVisitTypeId <= 0) {
            throw new \InvalidArgumentException('No OPD visit type mapped for this appointment category');
        }

        $visitType = $this->loadVisitTypeForFacility($resolvedVisitTypeId, $facilityId);
        if ((string) $visitType['service_profile'] !== 'full_opd') {
            throw new \InvalidArgumentException('Only OPD visit types can be used for appointment check-in');
        }

        $assignedProviderId = (int) ($appointment['pc_aid'] ?? 0);
        $encounterProviderId = $assignedProviderId > 0 ? $assignedProviderId : $actorUserId;
        $isRecurring = (int) ($appointment['pc_recurrtype'] ?? 0) !== 0;
        $fromStatus = (string) ($appointment['pc_apptstatus'] ?? '');

        sqlBeginTrans();
        try {
            $visit = $this->createVisit(
                $pid,
                $resolvedVisitTypeId,
                $actorUserId,
                $facilityId,
                $chiefComplaint,
                $isUrgent,
                null,
                'started_from_appointment',
                (int) ($appointment['pc_eid'] ?? 0),
                (string) ($appointment['pc_eventDate'] ?? $apptDate),
                $assignedProviderId > 0 ? $assignedProviderId : null,
                $encounterProviderId,
                $revisitOverrideReason
            );

            $appointmentStatusUpdated = false;
            if (!$isRecurring) {
                $encounter = (int) ($visit['encounter'] ?? 0);
                (new AppointmentService())->updateAppointmentStatus($pcEid, '@', $actorUserId, $encounter);
                $appointmentStatusUpdated = true;
                $this->audit('new_visit', 'appointment_linked', $pid, (int) ($visit['id'] ?? 0), [
                    'pc_eid' => $pcEid,
                    'appt_date' => $apptDate,
                    'from_status' => $fromStatus,
                    'to_status' => '@',
                    'encounter' => $encounter,
                ]);
            }

            sqlCommitTrans();
        } catch (\Throwable $e) {
            sqlRollbackTrans();
            throw $e;
        }

        return [
            'visit' => $visit,
            'recurring_guard_fired' => $isRecurring,
            'appointment_status_updated' => $appointmentStatusUpdated,
        ];
    }

    public function startVisitAtTriage(
        int $pid,
        int $visitTypeId,
        int $actorUserId,
        ?int $facilityId = null,
        ?string $chiefComplaint = null,
        bool $isUrgent = false
    ): array {
        if ($this->config->getInt('enable_triage', 1) !== 1) {
            throw new \InvalidArgumentException('Triage is disabled for this clinic');
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveActorFacilityId(null);
        $visitType = $this->loadVisitTypeForFacility($visitTypeId, $facilityId);
        if ((string) $visitType['service_profile'] !== 'full_opd') {
            throw new \InvalidArgumentException('Only OPD visit types can be auto-started at triage');
        }

        return $this->createVisit(
            $pid,
            $visitTypeId,
            $actorUserId,
            $facilityId,
            $chiefComplaint,
            $isUrgent,
            'in_triage',
            'auto_started_at_triage'
        );
    }

    /**
     * Doctor's own walk-in bypass — a patient who never passed through Front Desk or Triage
     * (e.g. a VIP who walks straight into the doctor's office). Skips the whole front-of-house
     * pipeline: the visit is created directly in with_doctor, bound to the doctor initiating it.
     * Same visit/encounter model as every other visit — no special-cased data shape downstream.
     */
    public function startVisitWithDoctor(
        int $pid,
        int $visitTypeId,
        int $actorUserId,
        ?int $facilityId = null,
        ?string $chiefComplaint = null
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_doctor')) {
            throw new \InvalidArgumentException('Not authorized to start a visit directly with the doctor');
        }

        $facilityId = $facilityId ?? $this->visitScope->resolveActorFacilityId(null);
        $visitType = $this->loadVisitTypeForFacility($visitTypeId, $facilityId);
        if ((string) $visitType['service_profile'] !== 'full_opd') {
            throw new \InvalidArgumentException('Only OPD visit types can be started directly with a doctor');
        }

        return $this->createVisit(
            $pid,
            $visitTypeId,
            $actorUserId,
            $facilityId,
            $chiefComplaint,
            false,
            'with_doctor',
            'doctor_walk_in',
            null,
            null,
            $actorUserId
        );
    }

    public function startTriage(int $visitId, int $actorUserId, int $expectedVersion): array
    {
        $visit = $this->getVisitForActor($visitId);
        if ($visit['state'] !== 'waiting') {
            throw new \InvalidArgumentException('Visit is not waiting for triage');
        }

        return $this->transition($visitId, 'in_triage', $actorUserId, $expectedVersion, 'start_triage');
    }

    public function sendToDoctor(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        ?string $chiefComplaint = null,
        ?int $hardAssignedProviderId = null
    ): array {
        $visit = $this->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_triage') {
            throw new \InvalidArgumentException('Visit is not in triage');
        }

        $chiefComplaintValue = null;
        if ($chiefComplaint !== null) {
            $chiefComplaintValue = mb_substr(trim($chiefComplaint), 0, 500);
            if ($chiefComplaintValue === '') {
                $chiefComplaintValue = null;
            }
        }

        $updated = $this->transition(
            $visitId,
            'ready_for_doctor',
            $actorUserId,
            $expectedVersion,
            'send_to_doctor',
            $chiefComplaintValue
        );

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        (new VisitHardAssignService())->applyHardAssignOnReady(
            $visitId,
            $facilityId,
            $hardAssignedProviderId,
            $actorUserId
        );

        return $this->finalizeReadyForDoctor($visitId, $updated);
    }

    /**
     * @param array<string, mixed> $updated
     * @return array<string, mixed>
     */
    private function finalizeReadyForDoctor(int $visitId, array $updated): array
    {
        $fresh = $this->getVisitById($visitId) ?? $updated;
        if ((string) ($fresh['state'] ?? '') !== 'ready_for_doctor') {
            throw new StaleVisitException($visitId);
        }

        (new DoctorReadyNotifyService())->recordForReadyVisit($fresh);

        return $fresh;
    }

    /**
     * Reception skip triage: waiting → ready_for_doctor (M1d-F07).
     *
     * @return array<string, mixed>
     */
    public function skipTriage(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        ?string $reason = null,
        ?int $hardAssignedProviderId = null
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_skip_triage')) {
            throw new \InvalidArgumentException('Skip triage not permitted');
        }

        $visit = $this->getVisitForActor($visitId);
        if ($visit['state'] !== 'waiting') {
            throw new \InvalidArgumentException('Visit must be in waiting state to skip triage');
        }

        $reasonValue = $reason !== null ? mb_substr(trim($reason), 0, 200) : null;
        if ($reasonValue === '') {
            $reasonValue = null;
        }

        $updated = $this->transition(
            $visitId,
            'ready_for_doctor',
            $actorUserId,
            $expectedVersion,
            $reasonValue ?? 'skip_triage',
            null,
            null,
            false,
            ['skip_triage' => 1]
        );

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        (new VisitHardAssignService())->applyHardAssignOnReady(
            $visitId,
            $facilityId,
            $hardAssignedProviderId,
            $actorUserId
        );

        return $this->finalizeReadyForDoctor($visitId, $updated);
    }

    private function createVisit(
        int $pid,
        int $visitTypeId,
        int $actorUserId,
        ?int $facilityId = null,
        ?string $chiefComplaint = null,
        bool $isUrgent = false,
        ?string $initialStateOverride = null,
        ?string $stateLogReason = null,
        ?int $pcEid = null,
        ?string $apptDate = null,
        ?int $assignedProviderId = null,
        ?int $encounterProviderId = null,
        ?string $revisitOverrideReason = null,
        ?int $referralDocumentId = null,
    ): array {
        $facilityId = $facilityId ?? $this->visitScope->resolveActorFacilityId(null);
        $this->visitScope->assertFacilityAccessible($facilityId);

        $this->revisitGate->assertCanStartVisit($pid, $actorUserId, $facilityId, $revisitOverrideReason);

        $existing = $this->assertCanStartVisit($pid, $facilityId);
        if ($existing) {
            $allowMultiple = $this->config->getInt('allow_multiple_visits_per_day', 1, $facilityId) === 1;
            $message = $allowMultiple
                ? 'Active visit already exists for patient today at this facility'
                : 'Only one visit per patient per day is allowed at this facility';
            throw new \InvalidArgumentException($message);
        }

        $visitType = $this->loadVisitTypeForFacility($visitTypeId, $facilityId);

        $normalizedReferralDocumentId = $referralDocumentId !== null && $referralDocumentId > 0
            ? $referralDocumentId
            : null;
        if ($normalizedReferralDocumentId !== null) {
            if ((string) ($visitType['service_profile'] ?? '') !== 'lab_direct') {
                throw new \InvalidArgumentException('Referral upload is only supported for lab-direct visit types');
            }
            $this->referralDocuments->assertBelongsToPatient($normalizedReferralDocumentId, $pid);
        }

        $this->facilityScope->assertPatientAccessible($pid);

        $patientService = new PatientService();
        $patient = $patientService->findByPid($pid);
        if (empty($patient)) {
            throw new \InvalidArgumentException('Patient not found');
        }

        $puuid = $patient['uuid'] ?? null;
        if (empty($puuid)) {
            throw new \RuntimeException('Patient UUID missing');
        }
        if (!is_string($puuid) || strlen($puuid) === 16) {
            $puuid = UuidRegistry::uuidToString($puuid);
        }

        $encounterService = new EncounterService();
        $encounterData = [
            'pc_catid' => (int) $visitType['pc_catid'],
            'class_code' => 'AMB',
            'date' => $this->clinicDate->today(),
            'provider_id' => $encounterProviderId ?? $actorUserId,
            'user' => $actorUserId,
            'group' => 'Default',
            'facility_id' => $facilityId,
        ];

        $result = $encounterService->insertEncounter($puuid, $encounterData);
        if (!$result->isValid() || !$result->hasData()) {
            $errors = $result->getValidationMessages();
            throw new \RuntimeException('Failed to create encounter: ' . json_encode($errors));
        }

        $encounterRow = $result->getFirstDataResult();
        $encounter = (int) ($encounterRow['encounter'] ?? 0);
        if ($encounter > 0 && $facilityId > 0) {
            sqlStatement(
                "UPDATE form_encounter SET facility_id = ?
                 WHERE encounter = ? AND pid = ? AND (facility_id = 0 OR facility_id IS NULL)",
                [$facilityId, $encounter, $pid]
            );
        }
        $queueNumber = $this->nextQueueNumber($facilityId);
        $initialState = $initialStateOverride
            ?? $this->resolveInitialState((string) $visitType['service_profile']);

        $chiefComplaint = $chiefComplaint !== null ? mb_substr(trim($chiefComplaint), 0, 500) : null;
        if ($chiefComplaint === '') {
            $chiefComplaint = null;
        }

        $visitDate = $this->clinicDate->today();
        $visitId = QueryUtils::sqlInsert(
            "INSERT INTO new_visit SET
                pid = ?, encounter = ?, facility_id = ?, visit_date = ?,
                visit_type_id = ?, queue_number = ?, state = ?, service_profile = ?,
                chief_complaint = ?, is_urgent = ?,
                pc_eid = ?, appt_date = ?, assigned_provider_id = ?,
                referral_document_id = ?,
                started_at = NOW(), created_by = ?, created_at = NOW(), updated_at = NOW()",
            [
                $pid,
                $encounter,
                $facilityId,
                $visitDate,
                $visitTypeId,
                $queueNumber,
                $initialState,
                $visitType['service_profile'],
                $chiefComplaint,
                $isUrgent ? 1 : 0,
                $pcEid,
                $apptDate,
                $assignedProviderId,
                $normalizedReferralDocumentId,
                $actorUserId,
            ]
        );

        $this->logStateChange((int) $visitId, null, $initialState, $actorUserId, $stateLogReason);
        $auditEvent = $stateLogReason === 'started_from_appointment' ? 'started_from_appointment' : 'created';
        $auditPayload = [
            'encounter' => $encounter,
            'queue_number' => $queueNumber,
        ];
        if ($stateLogReason !== null) {
            $auditPayload['reason'] = $stateLogReason;
        }
        if ($pcEid !== null && $pcEid > 0) {
            $auditPayload['pc_eid'] = $pcEid;
            $auditPayload['appt_date'] = $apptDate;
            $auditPayload['visit_type_id'] = $visitTypeId;
        }
        if ($normalizedReferralDocumentId !== null) {
            $auditPayload['referral_document_id'] = $normalizedReferralDocumentId;
        }
        $this->audit('new_visit', $auditEvent, $pid, (int) $visitId, $auditPayload);

        $serviceProfile = (string) ($visitType['service_profile'] ?? 'full_opd');
        if ($serviceProfile !== 'full_opd') {
            $this->audit('new_visit', 'ancillary_started', $pid, (int) $visitId, [
                'service_profile' => $serviceProfile,
                'visit_type_id' => $visitTypeId,
            ]);
        }
        if ($serviceProfile === 'full_opd') {
            $this->linkPendingPharmacyReferral($pid, $facilityId, (int) $visitId, $actorUserId);
        }
        $this->linkWrongVisitTypeReplacement((int) $visitId, $pid, $facilityId, $visitDate, $actorUserId);

        return $this->getVisitById((int) $visitId) ?? [];
    }

    public function transition(
        int $visitId,
        string $newState,
        int $actorUserId,
        int $expectedVersion,
        ?string $reason = null,
        ?string $chiefComplaint = null,
        ?int $assignedProviderId = null,
        bool $setPharmacyOrdered = false,
        array $auditExtra = []
    ): array {
        $visit = $this->getVisitForActor($visitId);

        $fromState = $visit['state'];
        if (!VisitFsm::canTransition($fromState, $newState)) {
            throw new \InvalidArgumentException("Invalid transition {$fromState} -> {$newState}");
        }

        if ($chiefComplaint !== null) {
            $sql = "UPDATE new_visit
                    SET state = ?, chief_complaint = ?, row_version = row_version + 1, updated_at = NOW()
                    WHERE id = ? AND state = ? AND row_version = ?";
            sqlStatement($sql, [$newState, $chiefComplaint, $visitId, $fromState, $expectedVersion]);
        } elseif ($setPharmacyOrdered) {
            $sql = "UPDATE new_visit
                    SET state = ?, pharmacy_ordered = 1, row_version = row_version + 1, updated_at = NOW()
                    WHERE id = ? AND state = ? AND row_version = ?";
            sqlStatement($sql, [$newState, $visitId, $fromState, $expectedVersion]);
        } elseif ($assignedProviderId !== null && in_array($newState, ['with_doctor', 'in_lab', 'in_pharmacy'], true)) {
            if ($newState === 'with_doctor') {
                $sql = "UPDATE new_visit
                        SET state = ?, assigned_provider_id = ?, routing_suggested_provider_id = NULL,
                            row_version = row_version + 1, updated_at = NOW()
                        WHERE id = ? AND state = ? AND row_version = ?";
            } else {
                $sql = "UPDATE new_visit
                        SET state = ?, assigned_provider_id = ?, row_version = row_version + 1, updated_at = NOW()
                        WHERE id = ? AND state = ? AND row_version = ?";
            }
            sqlStatement($sql, [$newState, $assignedProviderId, $visitId, $fromState, $expectedVersion]);
        } elseif ($newState === 'closed_unpaid') {
            $sql = "UPDATE new_visit
                    SET state = ?, left_unpaid_at = NOW(), row_version = row_version + 1, updated_at = NOW()
                    WHERE id = ? AND state = ? AND row_version = ?";
            sqlStatement($sql, [$newState, $visitId, $fromState, $expectedVersion]);
        } else {
            $sql = "UPDATE new_visit
                    SET state = ?, row_version = row_version + 1, updated_at = NOW()
                    WHERE id = ? AND state = ? AND row_version = ?";
            sqlStatement($sql, [$newState, $visitId, $fromState, $expectedVersion]);
        }

        if (generic_sql_affected_rows() < 1) {
            $this->resolveTransitionConflict($visitId, $fromState, $newState, $expectedVersion);
        }

        $this->logStateChange($visitId, $fromState, $newState, $actorUserId, $reason);
        $this->audit('new_visit', 'state_changed', (int) $visit['pid'], $visitId, array_merge([
            'from' => $fromState,
            'to' => $newState,
            'reason' => $reason,
        ], $auditExtra));

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $visitDate = (string) ($visit['visit_date'] ?? $this->clinicDate->today());
        $routing = new VisitRoutingService();
        if ($routing->isEnabled($facilityId)) {
            if ($newState === 'ready_for_doctor' || $fromState === 'ready_for_doctor') {
                $routingReason = $newState === 'ready_for_doctor' ? 'enter_ready' : 'pool_change';
                $routing->recomputeFacility($facilityId, $visitDate, $routingReason);
            }
        }

        return $this->getVisitById($visitId) ?? [];
    }

    /**
     * Reverse FSM transition — reopen consult (§6.4a).
     *
     * @return array<string, mixed>
     */
    public function reopenToWithDoctor(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        string $reason,
        int $assignedProviderId
    ): array {
        $visit = $this->getVisitForActor($visitId);
        $fromState = (string) $visit['state'];

        if (!VisitFsm::canReverseTransition($fromState, 'with_doctor')) {
            throw new \InvalidArgumentException("Invalid reverse transition {$fromState} -> with_doctor");
        }

        $sql = "UPDATE new_visit
                SET state = 'with_doctor', assigned_provider_id = ?, row_version = row_version + 1, updated_at = NOW()
                WHERE id = ? AND state = ? AND row_version = ?";
        sqlStatement($sql, [$assignedProviderId, $visitId, $fromState, $expectedVersion]);

        if (generic_sql_affected_rows() < 1) {
            $this->resolveTransitionConflict($visitId, $fromState, 'with_doctor', $expectedVersion);
        }

        $this->logStateChange($visitId, $fromState, 'with_doctor', $actorUserId, $reason, true);
        $this->audit('new_visit', 'reopened', (int) $visit['pid'], $visitId, [
            'from_state' => $fromState,
            'actor' => $actorUserId,
            'reason' => mb_substr(trim($reason), 0, 200),
        ]);

        return $this->getVisitById($visitId) ?? [];
    }

    /**
     * Reception routes a patient back into the shared doctor pool once ancillary work is done
     * (lab/pharmacy complete, or the patient needs to be seen before payment after all) — unlike
     * reopenToWithDoctor(), this does NOT lock a specific doctor's session; it joins the same
     * shared ready_for_doctor pool a brand-new patient enters, so any on-duty doctor can Take it.
     * The original assigned doctor is carried forward as the routing suggestion (hint) so whoever
     * looks at the shared queue sees who saw this patient before — assigned_provider_id itself is
     * left untouched as the continuity-of-care record.
     *
     * @return array<string, mixed>
     */
    public function sendBackToDoctor(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        ?string $reason = null
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_visit_return_to_doctor')) {
            throw new \InvalidArgumentException('Not authorized to send visit back to doctor');
        }

        $visit = $this->getVisitForActor($visitId);
        $fromState = (string) ($visit['state'] ?? '');
        if (!VisitFsm::canReverseTransition($fromState, 'ready_for_doctor')) {
            throw new \InvalidArgumentException("Invalid reverse transition {$fromState} -> ready_for_doctor");
        }

        $reasonValue = $reason !== null ? mb_substr(trim($reason), 0, 200) : null;
        if ($reasonValue === '') {
            $reasonValue = null;
        }
        // The doctor who actually saw this patient — not new_visit.assigned_provider_id, which
        // lab/pharmacy overwrote once they took the patient after the doctor released it.
        $suggestedProviderId = $this->lastDoctorForVisit($visitId);

        $sql = "UPDATE new_visit
                SET state = 'ready_for_doctor', routing_suggested_provider_id = ?,
                    row_version = row_version + 1, updated_at = NOW()
                WHERE id = ? AND state = ? AND row_version = ?";
        sqlStatement($sql, [$suggestedProviderId > 0 ? $suggestedProviderId : null, $visitId, $fromState, $expectedVersion]);

        if (generic_sql_affected_rows() < 1) {
            $this->resolveTransitionConflict($visitId, $fromState, 'ready_for_doctor', $expectedVersion);
        }

        $this->logStateChange($visitId, $fromState, 'ready_for_doctor', $actorUserId, $reasonValue ?? 'sent_back_to_doctor');
        $this->audit('new_visit', 'sent_back_to_doctor', (int) $visit['pid'], $visitId, [
            'from_state' => $fromState,
            'reason' => $reasonValue,
            'suggested_provider_id' => $suggestedProviderId,
        ]);

        return $this->getVisitById($visitId) ?? [];
    }

    public function takePatient(int $visitId, int $actorUserId, int $expectedVersion, ?string $overrideReason = null): array
    {
        $visit = $this->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_doctor') {
            throw new VisitNotTakeableException('Visit is not ready for doctor');
        }

        $updated = $this->transition(
            $visitId,
            'with_doctor',
            $actorUserId,
            $expectedVersion,
            null,
            null,
            $actorUserId
        );

        sqlStatement(
            "UPDATE form_encounter SET provider_id = ? WHERE pid = ? AND encounter = ?",
            [$actorUserId, $visit['pid'], $visit['encounter']]
        );

        $auditPayload = [
            'provider_id' => $actorUserId,
            'was_suggested_for' => (int) ($visit['routing_suggested_provider_id'] ?? 0) ?: null,
            'take_mode' => $this->classifyTakeMode($visit, $actorUserId),
        ];
        if ($overrideReason !== null && trim($overrideReason) !== '') {
            $auditPayload['override_reason'] = mb_substr(trim($overrideReason), 0, 200);
        }

        $hardAssigned = (int) ($visit['hard_assigned_provider_id'] ?? 0);
        if ($hardAssigned > 0 && $hardAssigned !== $actorUserId && $overrideReason !== null && trim($overrideReason) !== '') {
            $this->audit('new_visit', 'take_assigned_override', (int) $visit['pid'], $visitId, [
                'actor' => $actorUserId,
                'hard_assigned_provider_id' => $hardAssigned,
                'reason' => mb_substr(trim($overrideReason), 0, 200),
            ]);
        }

        $this->audit('new_visit', 'taken', (int) $visit['pid'], $visitId, $auditPayload);

        return $this->getVisitById($visitId) ?? $updated;
    }

    public function takeLabPatient(int $visitId, int $actorUserId, int $expectedVersion): array
    {
        $visit = $this->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_lab') {
            throw new VisitNotTakeableException('Visit is not ready for lab');
        }

        $updated = $this->transition(
            $visitId,
            'in_lab',
            $actorUserId,
            $expectedVersion,
            null,
            null,
            $actorUserId
        );

        $this->audit('new_visit', 'lab_taken', (int) $visit['pid'], $visitId, [
            'lab_tech_id' => $actorUserId,
        ]);

        return $this->getVisitById($visitId) ?? $updated;
    }

    public function takePharmacyPatient(int $visitId, int $actorUserId, int $expectedVersion): array
    {
        $visit = $this->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_pharmacy') {
            throw new VisitNotTakeableException('Visit is not ready for pharmacy');
        }

        $updated = $this->transition(
            $visitId,
            'in_pharmacy',
            $actorUserId,
            $expectedVersion,
            null,
            null,
            $actorUserId
        );

        $this->audit('new_visit', 'pharmacy_taken', (int) $visit['pid'], $visitId, [
            'pharmacist_id' => $actorUserId,
        ]);

        return $this->getVisitById($visitId) ?? $updated;
    }

    /**
     * M0-F19 — set/clear hard_assigned_provider_id (§6.5.3).
     *
     * @return array<string, mixed>
     */
    public function hardAssignProvider(
        int $visitId,
        int $facilityId,
        ?int $providerId,
        int $actorUserId,
        int $expectedVersion
    ): array {
        return (new VisitHardAssignService())->hardAssignProvider(
            $visitId,
            $facilityId,
            $providerId,
            $actorUserId,
            $expectedVersion
        );
    }

    public function cancelVisit(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        string $reason
    ): array {
        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('Cancel reason is required');
        }
        $reason = mb_substr($reason, 0, 200);

        $visit = $this->getVisitForActor($visitId);

        if (VisitFsm::isTerminal($visit['state'])) {
            throw new \InvalidArgumentException('Visit is already closed');
        }

        $fromState = (string) $visit['state'];
        if (stripos($reason, 'wrong_visit_type') !== false && $fromState !== 'waiting') {
            throw new \InvalidArgumentException(
                'Wrong visit type correction is only allowed while the visit is still waiting'
            );
        }

        $sql = "UPDATE new_visit
                SET state = 'cancelled', cancel_reason = ?, cancelled_at = NOW(),
                    row_version = row_version + 1, updated_at = NOW()
                WHERE id = ? AND state = ? AND row_version = ?";
        sqlStatement($sql, [$reason, $visitId, $fromState, $expectedVersion]);

        if (generic_sql_affected_rows() < 1) {
            throw new StaleVisitException($visitId);
        }

        $this->logStateChange($visitId, $fromState, 'cancelled', $actorUserId, $reason);
        $this->audit('new_visit', 'cancelled', (int) $visit['pid'], $visitId, [
            'reason' => $reason,
        ]);

        return $this->getVisitById($visitId) ?? [];
    }

    public function setPharmacyOutcome(int $visitId, string $outcome): void
    {
        $allowed = array_merge(
            PharmacyWalkinService::DISPENSE_OUTCOMES,
            PharmacyWalkinService::NON_DISPENSE_OUTCOMES
        );
        if (!in_array($outcome, $allowed, true)) {
            throw new \InvalidArgumentException('Invalid pharmacy outcome');
        }

        sqlStatement(
            "UPDATE new_visit SET pharmacy_outcome = ? WHERE id = ?",
            [$outcome, $visitId]
        );
    }

    public function linkReferredVisit(int $fromVisitId, int $toVisitId, int $actorUserId): void
    {
        if ($fromVisitId <= 0 || $toVisitId <= 0) {
            throw new \InvalidArgumentException('Invalid visit link');
        }

        $from = $this->getVisitById($fromVisitId);
        $to = $this->getVisitById($toVisitId);
        if (empty($from) || empty($to)) {
            throw new \InvalidArgumentException('Visit not found for referral link');
        }

        sqlStatement(
            "UPDATE new_visit SET referred_to_visit_id = ? WHERE id = ?",
            [$toVisitId, $fromVisitId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'pharmacy_outcome',
            $actorUserId,
            1,
            'visit_id=' . $fromVisitId
                . ' outcome=' . (string) ($from['pharmacy_outcome'] ?? '')
                . ' referred_to_visit_id=' . $toVisitId
        );
    }

    private function linkPendingPharmacyReferral(
        int $pid,
        int $facilityId,
        int $opdVisitId,
        int $actorUserId
    ): void {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM new_visit
             WHERE pid = ? AND facility_id = ? AND visit_date = ?
               AND service_profile = 'pharmacy_walkin'
               AND pharmacy_outcome = 'rx_required_refer_to_opd'
               AND referred_to_visit_id IS NULL
             ORDER BY id DESC
             LIMIT 1",
            [$pid, $facilityId, $this->clinicDate->today()]
        );
        if (!is_array($row) || empty($row['id'])) {
            return;
        }

        $this->linkReferredVisit((int) $row['id'], $opdVisitId, $actorUserId);
    }

    private function linkWrongVisitTypeReplacement(
        int $newVisitId,
        int $pid,
        int $facilityId,
        string $visitDate,
        int $actorUserId,
    ): void {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM new_visit
             WHERE pid = ? AND facility_id = ? AND visit_date = ?
               AND state = 'cancelled'
               AND cancel_reason LIKE '%wrong_visit_type%'
               AND id <> ?
             ORDER BY updated_at DESC, id DESC
             LIMIT 1",
            [$pid, $facilityId, $visitDate, $newVisitId]
        );
        if (!is_array($row) || empty($row['id'])) {
            return;
        }

        $cancelledId = (int) $row['id'];
        sqlStatement(
            "UPDATE new_visit SET referred_to_visit_id = ? WHERE id = ? AND referred_to_visit_id IS NULL",
            [$cancelledId, $newVisitId]
        );

        $this->audit('new_visit', 'wrong_visit_type_replacement_linked', $pid, $newVisitId, [
            'cancelled_visit_id' => $cancelledId,
        ]);
    }

    private function resolveInitialState(string $serviceProfile): string
    {
        $enableTriage = $this->config->getInt('enable_triage', 1) === 1;

        return match ($serviceProfile) {
            'lab_direct' => 'ready_for_lab',
            'pharmacy_walkin' => 'ready_for_pharmacy',
            default => $enableTriage ? 'waiting' : 'ready_for_doctor',
        };
    }

    private function nextQueueNumber(int $facilityId): int
    {
        $today = $this->clinicDate->today();
        sqlStatement(
            "INSERT INTO new_visit_queue_counter (facility_id, counter_date, last_seq)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE last_seq = last_seq + 1",
            [$facilityId, $today]
        );

        $row = QueryUtils::querySingleRow(
            "SELECT last_seq FROM new_visit_queue_counter WHERE facility_id = ? AND counter_date = ?",
            [$facilityId, $today]
        );

        return (int) ($row['last_seq'] ?? 1);
    }

    private function logStateChange(
        int $visitId,
        ?string $from,
        string $to,
        int $actorUserId,
        ?string $reason,
        bool $isReverse = false
    ): void {
        QueryUtils::sqlInsert(
            "INSERT INTO new_visit_state_log (visit_id, from_state, to_state, actor_user_id, reason, is_reverse)
             VALUES (?, ?, ?, ?, ?, ?)",
            [$visitId, $from, $to, $actorUserId, $reason, $isReverse ? 1 : 0]
        );
    }

    private function resolveTransitionConflict(
        int $visitId,
        string $fromState,
        string $intendedNewState,
        int $expectedVersion
    ): void {
        $current = $this->getVisitById($visitId);
        if (empty($current)) {
            throw new StaleVisitException($visitId);
        }

        $outcome = VisitTransitionConflictResolver::classify(
            $fromState,
            $intendedNewState,
            (string) $current['state'],
            $expectedVersion,
            (int) $current['row_version']
        );

        if ($outcome === VisitTransitionConflictResolver::OUTCOME_CLAIM_LOSS) {
            throw $this->buildTakenElsewhereException($current, $fromState);
        }

        throw new StaleVisitException($visitId);
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function buildTakenElsewhereException(array $visit, string $fromState): VisitNotTakeableException
    {
        // claim_kind from VisitTransitionConflictResolver (e.g. start_triage, take_patient).
        $state = (string) ($visit['state'] ?? '');
        $meta = VisitTransitionConflictResolver::claimMetaForState($state) ?? [
            'kind' => 'take_patient',
            'role' => 'Staff',
        ];
        $visitId = (int) ($visit['id'] ?? 0);
        $taker = $this->lookupClaimActor($visitId, $state, (int) ($visit['assigned_provider_id'] ?? 0));
        $patient = QueryUtils::querySingleRow(
            "SELECT fname, lname, pubpid FROM patient_data WHERE pid = ?",
            [(int) ($visit['pid'] ?? 0)]
        );
        $patientName = trim((string) (($patient['fname'] ?? '') . ' ' . ($patient['lname'] ?? '')));

        return new VisitNotTakeableException(
            sprintf('%s %s took this patient first', $meta['role'], $taker['display_name']),
            [
                'interrupt' => 'taken_elsewhere',
                'claim_kind' => $meta['kind'],
                'taker_display_name' => $taker['display_name'],
                'taker_role_label' => $meta['role'],
                'patient_display_name' => $patientName,
                'patient_mrn' => (string) ($patient['pubpid'] ?? ''),
                'queue_number' => (string) ($visit['queue_number'] ?? ''),
            ]
        );
    }

    /**
     * @return array{user_id: int, display_name: string}
     */
    private function lookupClaimActor(int $visitId, string $toState, int $assignedProviderId): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT l.actor_user_id, u.fname, u.lname
             FROM new_visit_state_log l
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE l.visit_id = ? AND l.to_state = ?
             ORDER BY l.id DESC
             LIMIT 1",
            [$visitId, $toState]
        );

        if (!empty($row)) {
            $name = trim((string) ($row['fname'] ?? '') . ' ' . (string) ($row['lname'] ?? ''));
            if ($name !== '') {
                return [
                    'user_id' => (int) ($row['actor_user_id'] ?? 0),
                    'display_name' => $name,
                ];
            }
        }

        if ($assignedProviderId > 0) {
            $provider = QueryUtils::querySingleRow(
                "SELECT fname, lname FROM users WHERE id = ?",
                [$assignedProviderId]
            );
            if (!empty($provider)) {
                $name = trim((string) ($provider['fname'] ?? '') . ' ' . (string) ($provider['lname'] ?? ''));
                if ($name !== '') {
                    return [
                        'user_id' => $assignedProviderId,
                        'display_name' => $name,
                    ];
                }
            }
        }

        return ['user_id' => 0, 'display_name' => 'Another user'];
    }

    private function loadVisitTypeForFacility(int $visitTypeId, int $facilityId): array
    {
        $visitType = QueryUtils::querySingleRow(
            "SELECT * FROM new_visit_type
             WHERE id = ? AND is_active = 1 AND (facility_id = 0 OR facility_id = ?)",
            [$visitTypeId, $facilityId]
        );
        if (empty($visitType)) {
            throw new \InvalidArgumentException('Invalid visit type for this facility');
        }

        return $visitType;
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function classifyTakeMode(array $visit, int $actorUserId): string
    {
        $hardAssigned = (int) ($visit['hard_assigned_provider_id'] ?? 0);
        if ($hardAssigned > 0) {
            return $hardAssigned === $actorUserId ? 'hard_assigned_match' : 'hard_assigned_override';
        }

        $suggested = (int) ($visit['routing_suggested_provider_id'] ?? 0);
        if ($suggested <= 0) {
            return 'unassigned';
        }

        return $suggested === $actorUserId ? 'accepted_suggestion' : 'manual_override';
    }

    /**
     * Nurse-side urgency escalation (triage.set_urgent). Never a state change — urgent alone
     * must not skip triage (workflows §12.2) — so this bypasses logStateChange entirely.
     * Self-contained like cancelVisit(): validates its own reason rule, re-checks facility
     * access via getVisitForActor(), pins state in the optimistic-lock WHERE clause, and always
     * enforces row_version — including when the target value happens to already match current
     * state, so a stale caller can never get a silent "success" instead of a conflict.
     *
     * @return array<string, mixed>
     */
    public function setUrgency(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        bool $isUrgent,
        ?string $reason
    ): array {
        $reasonValue = $reason !== null ? mb_substr(trim($reason), 0, 200) : null;
        if ($reasonValue === '') {
            $reasonValue = null;
        }
        if (!$isUrgent && $reasonValue === null) {
            throw new \InvalidArgumentException('Reason required to remove the urgent flag');
        }

        $visit = $this->getVisitForActor($visitId);
        if (!in_array($visit['state'], ['waiting', 'in_triage'], true)) {
            throw new \InvalidArgumentException('Visit must be waiting or in triage to change urgency');
        }

        $priorValue = (int) ($visit['is_urgent'] ?? 0);
        $targetValue = $isUrgent ? 1 : 0;

        $sql = "UPDATE new_visit SET is_urgent = ?, row_version = row_version + 1, updated_at = NOW()
                WHERE id = ? AND state IN ('waiting', 'in_triage') AND row_version = ?";
        sqlStatement($sql, [$targetValue, $visitId, $expectedVersion]);

        if (generic_sql_affected_rows() < 1) {
            throw new StaleVisitException($visitId);
        }

        if ($priorValue !== $targetValue) {
            $this->audit('new_visit', 'urgency_changed', (int) $visit['pid'], $visitId, [
                'is_urgent' => $isUrgent,
                'reason' => $reasonValue,
                'set_by_role' => 'nurse',
                'actor_user_id' => $actorUserId,
                'prior_value' => $priorValue,
            ]);
        }

        return $this->getVisitById($visitId) ?? [];
    }

    private function audit(string $category, string $event, int $pid, int $visitId, array $payload): void
    {
        EventAuditLogger::getInstance()->newEvent(
            $category,
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            $event,
            'pid=' . $pid . ';visit_id=' . $visitId . ';' . json_encode($payload),
            $pid
        );
    }
}
