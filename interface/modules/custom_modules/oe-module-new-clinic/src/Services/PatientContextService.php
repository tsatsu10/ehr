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
use OpenEMR\Modules\NewClinic\Services\PatientInsuranceUtil;
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
        private readonly RecallDueService $recallDue = new RecallDueService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly RevisitCompletionGateService $revisitGate = new RevisitCompletionGateService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly QueueBridgeSurfaceService $queueBridgeSurface = new QueueBridgeSurfaceService(),
        private readonly ReviewVisitSuggestionService $reviewSuggestion = new ReviewVisitSuggestionService(),
    ) {
    }

    /**
     * REF-4 / D34 — Zone A "Referral issued" chip when the active encounter has
     * an outbound referral (distinct from inbound "Referral on file", D-REF-5).
     *
     * @param array<string, mixed>|null $activeVisit
     */
    protected function encounterHasOutboundReferral(?array $activeVisit): bool
    {
        $encounterId = (int) (is_array($activeVisit) ? ($activeVisit['encounter_id'] ?? 0) : 0);
        if ($encounterId <= 0) {
            return false;
        }

        $row = \OpenEMR\Common\Database\QueryUtils::querySingleRow(
            'SELECT id FROM new_referral_meta WHERE encounter_id = ? LIMIT 1',
            [$encounterId]
        );

        return is_array($row) && (int) ($row['id'] ?? 0) > 0;
    }

    /**
     * D-FIN-8 — MRD Zone A "Visit charges" chip for `new_chart_depth_finance_summary`.
     * Clinical states only; charge total only (no receipt #, no payment method).
     *
     * @param array<string, mixed>|null $activeVisit
     */
    private function buildVisitChargesChip(int $pid, ?array $activeVisit): ?string
    {
        if (!is_array($activeVisit)) {
            return null;
        }

        $encounterId = (int) ($activeVisit['encounter_id'] ?? 0);
        $state = (string) ($activeVisit['state'] ?? '');
        $clinicalStates = [
            'with_doctor', 'ready_for_doctor', 'ready_for_lab', 'in_lab',
            'ready_for_pharmacy', 'in_pharmacy', 'ready_for_payment',
        ];
        if ($encounterId <= 0 || !in_array($state, $clinicalStates, true)) {
            return null;
        }

        if (
            !\OpenEMR\Common\Acl\AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance_summary')
            && !\OpenEMR\Common\Acl\AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance')
        ) {
            return null;
        }

        try {
            $summary = (new PaymentHistoryService())->getVisitChargesSummary($pid, $encounterId);
        } catch (\RuntimeException) {
            return null;
        }

        return 'Visit charges: '
            . (string) ($summary['currency_symbol'] ?? '')
            . number_format((float) ($summary['charges_amount'] ?? 0), 2);
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
        $allergyCountRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM lists WHERE pid = ? AND type = 'allergy' AND activity = 1",
            [$pid]
        );
        $allergyCount = is_array($allergyCountRow) ? (int) ($allergyCountRow['cnt'] ?? 0) : 0;
        $allergiesUndocumented = !$this->completionService->hasAllergyDocumentationForPatient($pid);
        $allergyTitles = array_values(array_filter(array_map(
            fn ($row) => $row['title'] ?? '',
            $allergies
        ), function ($title) {
            return trim((string) $title) !== ''
                && !PatientCompletionService::isNkdaOnlyTitle((string) $title);
        }));

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $pregnant = $this->config->getInt('enable_pregnancy_banner_chip', 0, $facilityId) === 1
            && $this->isPatientPregnant($pid, is_array($meta) ? $meta : []);
        $bannerMrdDeepLinks = $this->config->getInt('enable_banner_mrd_deep_links', 0, $facilityId) === 1;
        $allergyCountChip = $this->config->getInt('enable_allergy_count_chip', 0, $facilityId) === 1;

        $problemRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM lists WHERE pid = ? AND type = 'medical_problem' AND activity = 1",
            [$pid]
        );
        $problemCount = is_array($problemRow) ? (int) ($problemRow['cnt'] ?? 0) : 0;

        $visit = QueryUtils::querySingleRow(
            "SELECT v.id, v.state, v.queue_number, v.chief_complaint, v.encounter, v.facility_id, v.row_version,
                    v.hard_assigned_provider_id, v.assigned_provider_id, ha.fname AS hard_fname, ha.lname AS hard_lname
             FROM new_visit v
             LEFT JOIN users ha ON ha.id = v.hard_assigned_provider_id
             WHERE v.pid = ?
             AND v.state NOT IN ('completed', 'closed_unpaid', 'cancelled')
             ORDER BY v.id DESC LIMIT 1",
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
            $hardId = (int) ($visit['hard_assigned_provider_id'] ?? 0);
            $hardName = trim(($visit['hard_fname'] ?? '') . ' ' . ($visit['hard_lname'] ?? ''));
            $activeVisit = [
                'visit_id' => (int) $visit['id'],
                'state' => $visit['state'],
                'queue_number' => (int) $visit['queue_number'],
                'row_version' => (int) ($visit['row_version'] ?? 0),
                'chief_complaint' => $visit['chief_complaint'] ?? null,
                'encounter_id' => $encounterId > 0 ? $encounterId : null,
                'encounter_signed' => $encounterId > 0
                    ? $this->signService->isVisitDocumentationSigned($visit, $facilityId)
                    : true,
                'require_esign_before_complete_consult' => $this->config->getInt(
                    'require_esign_before_complete_consult',
                    0,
                    $facilityId
                ) === 1,
                'assigned_provider_id' => (int) ($visit['assigned_provider_id'] ?? 0) ?: null,
            ];
            if ($hardId > 0) {
                $activeVisit['hard_assigned_provider_id'] = $hardId;
                if ($hardName !== '') {
                    $activeVisit['hard_assigned_provider_name'] = $hardName;
                }
            }
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
                'pregnant' => $pregnant,
                'allergy_count' => $allergyCount,
            ],
            'pediatric_dob_block' => $pediatricBlock,
            'completion' => [
                'pid' => $pid,
                'score' => $score,
                'status' => $completionResult['status'] ?? 'incomplete',
                'missing_fields' => $completionResult['missing'] ?? [],
                'missing_labels' => $completionResult['missing_labels'] ?? [],
                'nearest_missing_field' => ($completionResult['missing_labels'][0] ?? null),
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
            'banner_mrd_deep_links' => $bannerMrdDeepLinks,
            'allergy_count_chip' => $allergyCountChip,
        ];

        $payload = $this->enrichVitalsToday($payload, $pid);

        if ($context === 'patient-chart') {
            // Keep the cheap "action required" block in the blocking preview so
            // the banner paints immediately; the heavy activity feed is fetched
            // separately by the chart (patients.chart.activity_feed) so it never
            // gates first paint.
            $payload['action_required'] = $this->activityFeed->getActionRequired($pid, true);

            $chargesLabel = $this->buildVisitChargesChip($pid, $activeVisit);
            if ($chargesLabel !== null && is_array($payload['active_visit'])) {
                $payload['active_visit']['visit_charges_label'] = $chargesLabel;
            }

            if (is_array($payload['active_visit']) && $this->encounterHasOutboundReferral($activeVisit)) {
                $payload['active_visit']['referral_issued'] = true;
            }
        }

        $payload['appointment_today'] = $this->appointmentToday->chipForPatient($pid, $facilityId);
        $recallChip = $this->recallDue->chipForPatient($pid, $facilityId);
        $payload['recall_due'] = $recallChip;
        $payload['chips'] = [
            'appointment_today' => $payload['appointment_today'],
            'recall_due' => $recallChip,
        ];
        $payload['visits_today'] = $this->loadVisitsToday($pid, $facilityId);
        $payload['revisit_gate'] = $this->revisitGate->assess($pid, $facilityId);
        $payload['queue_bridge'] = $this->queueBridgeSurface->patientFlags($pid, $facilityId);

        if ($context === 'front-desk') {
            $hardAssign = new VisitHardAssignService();
            $hardEnabled = $hardAssign->isEnabled($facilityId);
            $canHardAssign = $hardAssign->canAssign($actorUserId);
            $payload['hard_provider_assignment_enabled'] = $hardEnabled;
            $payload['can_hard_assign_provider'] = $canHardAssign;
            if ($hardEnabled && $canHardAssign) {
                $payload['assignable_doctors'] = $hardAssign->listAssignableDoctors($facilityId);
            }

            $insuranceMeta = QueryUtils::querySingleRow(
                "SELECT insurance_type, nhis_expiry FROM new_patient_meta WHERE pid = ?",
                [$pid]
            ) ?: [];
            $payload['insurance_effective'] = PatientInsuranceUtil::effectiveType($insuranceMeta);
            $payload['insurance_label'] = PatientInsuranceUtil::displayLabel($insuranceMeta);

            $unpaidRow = QueryUtils::querySingleRow(
                "SELECT COUNT(*) AS cnt FROM new_visit WHERE pid = ? AND state = 'closed_unpaid'",
                [$pid]
            );
            $payload['unpaid_visits_count'] = is_array($unpaidRow) ? (int) ($unpaidRow['cnt'] ?? 0) : 0;

            $payload['review_suggestion'] = $this->reviewSuggestion->suggestFor($pid, $facilityId);
        }

        return $payload;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadVisitsToday(int $pid, int $facilityId): array
    {
        $today = $this->clinicDate->today();
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, v.queue_number, v.state, vt.label AS visit_type_label
             FROM new_visit v
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             WHERE v.pid = ? AND v.facility_id = ? AND v.visit_date = ?
             ORDER BY v.queue_number ASC, v.id ASC",
            [$pid, $facilityId, $today]
        ) ?: [];

        return array_map(static function (array $row): array {
            $state = (string) ($row['state'] ?? '');
            $terminal = in_array($state, ['completed', 'closed_unpaid', 'cancelled'], true);

            return [
                'visit_id' => (int) ($row['visit_id'] ?? 0),
                'queue_number' => (int) ($row['queue_number'] ?? 0),
                'state' => $state,
                'visit_type_label' => (string) ($row['visit_type_label'] ?? ''),
                'is_finished' => $terminal,
            ];
        }, $rows);
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

    /**
     * @param array<string, mixed> $meta
     */
    private function isPatientPregnant(int $pid, array $meta): bool
    {
        if (strcasecmp(trim((string) ($meta['pregnancy_status'] ?? '')), 'Pregnant') === 0) {
            return true;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM lists
             WHERE pid = ?
               AND type = 'medical_problem'
               AND activity = 1
               AND (
                    LOWER(title) LIKE '%pregnan%'
                    OR LOWER(title) LIKE '%gravida%'
               )",
            [$pid]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }
}
