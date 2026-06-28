<?php

/**
 * Triage desk queue and vitals workflow (M3)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Exceptions\VitalsValidationException;
use OpenEMR\Services\EncounterService;

class TriageService
{
    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitBoardService $boardService = new VisitBoardService(),
        private readonly PatientContextService $patientContextService = new PatientContextService(),
        private readonly EncounterSessionService $encounterSessionService = new EncounterSessionService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
        private readonly VitalsValidationService $vitalsValidation = new VitalsValidationService(),
        private readonly VitalsPreviewBuilder $vitalsPreview = new VitalsPreviewBuilder(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getTriageQueue(int $facilityId, ?string $visitDate, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $today = $this->clinicDate->today();
        $this->visitScope->repairOrphanVisits($facilityId, $today);

        $bind = [$facilityId];
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ?
                AND v.state IN ('waiting', 'in_triage')";

        // Match Visit Board: active triage queue has no date cap unless caller
        // explicitly requests a historical date (carry-over visits stay visible).
        if ($visitDate !== null && trim($visitDate) !== '') {
            $sql .= " AND v.visit_date = ?";
            $bind[] = $visitDate;
        }

        $sql .= " ORDER BY v.is_urgent DESC, v.visit_date ASC, v.queue_number ASC, v.started_at ASC";

        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $visitIds = array_map(fn (array $row) => (int) ($row['id'] ?? 0), $rows);
        $holders = $this->rowEnricher->batchTriageHolders($visitIds);

        $visits = [];
        $waitingCount = 0;
        $inTriageCount = 0;

        foreach ($rows as $row) {
            $enriched = $this->enrichQueueRow($row, $actorUserId, $holders);
            $visits[] = $enriched;
            if ($enriched['state'] === 'waiting') {
                $waitingCount++;
            } else {
                $inTriageCount++;
            }
        }

        return [
            'visits' => $visits,
            'counts' => [
                'waiting' => $waitingCount,
                'in_triage' => $inTriageCount,
                'total' => count($visits),
            ],
            'visit_date' => $visitDate ?? $today,
            'queue_date_filter' => $visitDate,
            'last_updated' => date('c'),
            'vitals_unit_label' => $this->vitalsValidation->formTemperatureUnitLabel(),
            'vitals_form_rules' => $this->vitalsValidation->getFormRules(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function selectPatient(int $visitId, int $actorUserId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        if (!in_array($visit['state'], ['waiting', 'in_triage'], true)) {
            throw new \InvalidArgumentException('Visit is not on the triage queue');
        }

        if ($visit['state'] === 'waiting') {
            $visit = $this->queueService->startTriage(
                $visitId,
                $actorUserId,
                (int) ($visit['row_version'] ?? 0)
            );
        } elseif ($visit['state'] === 'in_triage') {
            $holders = $this->rowEnricher->batchTriageHolders([$visitId]);
            $holder = $holders[$visitId] ?? null;
            $holderId = (int) ($holder['actor_user_id'] ?? 0);
            if ($holderId > 0 && $holderId !== $actorUserId) {
                throw new \InvalidArgumentException(
                    'Visit is being triaged by ' . ($holder['actor_name'] ?? 'another nurse')
                );
            }
        }

        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);
        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $preview = $this->patientContextService->previewPayload(
            (int) $visit['pid'],
            $actorUserId,
            'triage'
        );
        $vitals = $this->vitalsPreview->getEncounterVitals((int) $visit['pid'], (int) $visit['encounter']);
        $warnings = $this->vitalsPreview->evaluateWarnings($vitals);

        return [
            'visit' => $detail['visit'],
            'preview' => $this->vitalsPreview->mergeIntoPreview($preview, $vitals, $warnings, true),
            'vitals' => $vitals,
            'form_vitals' => $this->vitalsPreview->formatLatestForForm($vitals),
            'vitals_warnings' => $warnings,
            'skipped_triage' => $detail['skipped_triage'],
            'vitals_unit_label' => $this->vitalsValidation->formTemperatureUnitLabel(),
            'vitals_form_rules' => $this->vitalsValidation->getFormRules(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function sendToDoctor(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        ?string $chiefComplaint = null
    ): array {
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_triage') {
            throw new \InvalidArgumentException('Visit is not in triage');
        }

        if (!$this->vitalsPreview->hasCompleteTriageVitals((int) $visit['pid'], (int) $visit['encounter'])) {
            throw new \InvalidArgumentException('Save vitals before sending the patient to the doctor');
        }

        return $this->queueService->sendToDoctor(
            $visitId,
            $actorUserId,
            $expectedVersion,
            $chiefComplaint
        );
    }

    /**
     * @param array<string, mixed> $vitals
     * @return array<string, mixed>
     */
    public function saveVitals(
        int $visitId,
        int $actorUserId,
        array $vitals,
        ?string $chiefComplaint = null
    ): array {
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'in_triage') {
            throw new \InvalidArgumentException('Visit must be in triage to save vitals');
        }

        $validated = $this->vitalsValidation->validateForTriage($vitals);
        if (!empty($validated['errors'])) {
            throw new VitalsValidationException(
                $validated['errors'],
                $validated['field_errors'],
                $validated['field_warnings']
            );
        }

        $this->encounterSessionService->bindForVisit($visitId, $actorUserId);

        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];
        $payload = $validated['payload'];

        $encounterService = new EncounterService();
        [$vitalsId] = $encounterService->insertVital($pid, $encounter, $payload);

        if ($chiefComplaint !== null) {
            $chiefComplaint = mb_substr(trim($chiefComplaint), 0, 500);
            if ($chiefComplaint !== '') {
                sqlStatement(
                    "UPDATE new_visit SET chief_complaint = ?, updated_at = NOW() WHERE id = ?",
                    [$chiefComplaint, $visitId]
                );
            }
        }

        $saved = $this->vitalsPreview->getEncounterVitals($pid, $encounter);
        $warnings = $this->vitalsPreview->evaluateWarnings($saved);

        return [
            'vitals_id' => (int) $vitalsId,
            'last_vitals_today' => $saved,
            'form_vitals' => $this->vitalsPreview->formatLatestForForm($saved),
            'vitals_warnings' => $warnings,
            'vitals_abnormal_today' => !empty($warnings),
            'visit' => $this->queueService->getVisitForActor($visitId),
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, array<string, mixed>> $holders
     * @return array<string, mixed>
     */
    private function enrichQueueRow(array $row, int $actorUserId, array $holders): array
    {
        $visitId = (int) ($row['id'] ?? 0);
        $row = $this->rowEnricher->enrichVisitRow($row, $visitId);

        $holder = $holders[$visitId] ?? null;
        $row['triage_actor_id'] = $holder['actor_user_id'] ?? null;
        $row['triage_actor_name'] = $holder['actor_name'] ?? null;
        $row['triage_started_at'] = $holder['created_at'] ?? null;
        $row['triage_mine'] = !empty($holder['actor_user_id'])
            && (int) $holder['actor_user_id'] === $actorUserId;

        return $row;
    }
}
