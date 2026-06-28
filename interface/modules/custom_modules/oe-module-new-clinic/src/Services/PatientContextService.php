<?php

/**
 * Shared patient context builder (M0-F20)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Dto\PatientPreviewDto;
use OpenEMR\Services\PatientService;

class PatientContextService
{
    public function __construct(
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly VitalsPreviewBuilder $vitalsPreview = new VitalsPreviewBuilder(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly PatientActivityFeedService $activityFeed = new PatientActivityFeedService(),
        private readonly AppointmentTodayService $appointmentToday = new AppointmentTodayService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function preview(int $pid, int $actorUserId, string $context = 'default'): PatientPreviewDto
    {
        $payload = $this->previewPayload($pid, $actorUserId, $context);

        return new PatientPreviewDto(
            pid: $pid,
            displayName: $payload['identity']['display_name'],
            mrn: $payload['identity']['pubpid'],
            completionScore: (int) $payload['completion']['score'],
            allergiesUndocumented: (bool) $payload['safety']['allergies_undocumented'],
            activeVisitId: $payload['active_visit']['visit_id'] ?? null,
            activeVisitState: $payload['active_visit']['state'] ?? null,
            queueNumber: $payload['active_visit']['queue_number'] ?? null,
            chiefComplaint: $payload['active_visit']['chief_complaint'] ?? null,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function previewPayload(int $pid, int $actorUserId, string $context = 'default'): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $patientService = new PatientService();
        $patient = $patientService->findByPid($pid);
        if (empty($patient)) {
            throw new \RuntimeException('Patient not found', 404);
        }

        $displayName = trim(($patient['fname'] ?? '') . ' ' . ($patient['lname'] ?? ''));
        $completionResult = $this->completionService->readCached($pid);
        $score = (int) ($completionResult['score'] ?? 0);
        $meta = QueryUtils::querySingleRow(
            "SELECT dob_estimated FROM new_patient_meta WHERE pid = ?",
            [$pid]
        );

        $allergies = QueryUtils::fetchRecords(
            "SELECT title FROM lists WHERE pid = ? AND type = 'allergy' AND activity = 1 ORDER BY id DESC LIMIT 5",
            [$pid]
        ) ?: [];
        $allergiesUndocumented = !$this->completionService->hasAllergyDocumentationForPatient($pid);
        $allergyTitles = array_values(array_filter(array_map(
            fn ($row) => $row['title'] ?? '',
            $allergies
        ), function ($title) {
            return trim((string) $title) !== ''
                && !PatientCompletionService::isNkdaOnlyTitle((string) $title);
        }));

        $problemRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM lists WHERE pid = ? AND type = 'medical_problem' AND activity = 1",
            [$pid]
        );
        $problemCount = is_array($problemRow) ? (int) ($problemRow['cnt'] ?? 0) : 0;

        $visit = QueryUtils::querySingleRow(
            "SELECT id, state, queue_number, chief_complaint, encounter, facility_id FROM new_visit
             WHERE pid = ?
             AND state NOT IN ('completed', 'closed_unpaid', 'cancelled')
             ORDER BY id DESC LIMIT 1",
            [$pid]
        );

        $lastVisit = QueryUtils::querySingleRow(
            "SELECT MAX(date) AS last_visit_date FROM form_encounter WHERE pid = ?",
            [$pid]
        );

        $phoneNorm = (string) ($patient['phone_normalized'] ?? '');
        if ($phoneNorm === '' && !empty($patient['phone_cell'])) {
            $phoneNorm = $this->phoneNormalizer->normalize((string) $patient['phone_cell']);
        }

        $dobEstimated = is_array($meta) && !empty($meta['dob_estimated']);
        $ageYears = $this->ageYears($patient['DOB'] ?? null);
        $pediatricBlock = $dobEstimated && $ageYears !== null && $ageYears < 5;

        $activeVisit = null;
        if (is_array($visit) && !empty($visit['id'])) {
            $encounterId = (int) ($visit['encounter'] ?? 0);
            $facilityId = (int) ($visit['facility_id'] ?? 0);
            $activeVisit = [
                'visit_id' => (int) $visit['id'],
                'state' => $visit['state'],
                'queue_number' => (int) $visit['queue_number'],
                'chief_complaint' => $visit['chief_complaint'] ?? null,
                'encounter_id' => $encounterId > 0 ? $encounterId : null,
                'encounter_signed' => $encounterId > 0
                    ? $this->signService->isEncounterDocumentationSigned($encounterId)
                    : true,
                'require_esign_before_complete_consult' => $this->config->getInt(
                    'require_esign_before_complete_consult',
                    0,
                    $facilityId
                ) === 1,
            ];
        }

        $payload = [
            'identity' => [
                'pid' => $pid,
                'display_name' => $displayName,
                'sex' => $patient['sex'] ?? '',
                'age_years' => $ageYears,
                'dob_estimated' => $dobEstimated,
                'pubpid' => $patient['pubpid'] ?? '',
                'phone_masked' => $this->phoneNormalizer->mask($phoneNorm),
                'photo_url' => null,
            ],
            'safety' => [
                'allergies_severe' => $allergyTitles,
                'allergies_undocumented' => $allergiesUndocumented,
                'problem_count' => $problemCount,
            ],
            'pediatric_dob_block' => $pediatricBlock,
            'completion' => [
                'pid' => $pid,
                'score' => $score,
                'status' => $completionResult['status'] ?? 'incomplete',
                'missing_fields' => $completionResult['missing'] ?? [],
                'missing_labels' => $completionResult['missing_labels'] ?? [],
                'nearest_missing_field' => ($completionResult['missing_labels'][0] ?? null),
                'demographics_url' => ($GLOBALS['webroot'] ?? '')
                    . '/interface/patient_file/summary/demographics.php?set_pid=' . urlencode((string) $pid),
                'chart_url' => PatientCompletionService::chartUrl($pid, 'profile'),
                'chart_open_url' => PatientCompletionService::chartUrl($pid, null),
                'billing_threshold' => $this->completionService->getBillingThreshold(),
            ],
            'active_visit' => $activeVisit,
            'vitals_today' => [
                'summary' => null,
                'vitals_missing_today' => true,
                'vitals_abnormal_today' => false,
                'vitals_breach_list' => [],
                'pain_score' => null,
            ],
            'last_visit' => [
                'date' => is_array($lastVisit) ? ($lastVisit['last_visit_date'] ?? null) : null,
                'label' => $this->formatDateLabel(is_array($lastVisit) ? ($lastVisit['last_visit_date'] ?? null) : null),
            ],
            'context' => $context,
        ];

        $payload = $this->enrichVitalsToday($payload, $pid);

        if ($context === 'patient-chart') {
            $overview = $this->activityFeed->getOverviewBlocks($pid, true);
            $payload['action_required'] = $overview['action_required'];
            $payload['activity_feed'] = $overview['activity_feed'];
        }

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $payload['appointment_today'] = $this->appointmentToday->chipForPatient($pid, $facilityId);
        $payload['chips'] = [
            'appointment_today' => $payload['appointment_today'],
            'recall_due' => false,
        ];

        return $payload;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function enrichVitalsToday(array $payload, int $pid): array
    {
        $encounterRow = QueryUtils::querySingleRow(
            "SELECT encounter FROM new_visit
             WHERE pid = ?
             AND state NOT IN ('completed', 'closed_unpaid', 'cancelled')
             AND encounter > 0
             ORDER BY id DESC LIMIT 1",
            [$pid]
        );
        $encounter = is_array($encounterRow) ? (int) ($encounterRow['encounter'] ?? 0) : 0;
        if ($encounter <= 0) {
            return $payload;
        }

        $vitalsRows = $this->vitalsPreview->getEncounterVitals($pid, $encounter);
        $warnings = $this->vitalsPreview->evaluateWarnings($vitalsRows);

        return $this->vitalsPreview->mergeIntoPreview($payload, $vitalsRows, $warnings, true);
    }

    private function ageYears(?string $dob): ?int
    {
        if (empty($dob) || $dob === '0000-00-00') {
            return null;
        }

        try {
            return (int) (new \DateTime($dob))->diff(new \DateTime('today'))->y;
        } catch (\Exception) {
            return null;
        }
    }

    private function formatDateLabel(?string $date): ?string
    {
        if (empty($date) || $date === '0000-00-00') {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }
}
