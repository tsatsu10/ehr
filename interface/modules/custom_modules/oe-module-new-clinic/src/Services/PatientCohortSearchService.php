<?php

/**
 * Patient Registry cohort search (M10 PR-1 demographics + PR-2 clinical/visit filters)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class PatientCohortSearchService
{
    private const PAGE_SIZE_DEFAULT = 25;
    private const PAGE_SIZE_MAX = 100;
    private const EXPORT_ROW_LIMIT = 5000;

    /** @var array<int, string> */
    public const VISIT_STATE_OPTIONS = [
        'waiting',
        'in_triage',
        'ready_for_doctor',
        'with_doctor',
        'ready_for_lab',
        'in_lab',
        'lab_complete',
        'ready_for_pharmacy',
        'in_pharmacy',
        'pharmacy_complete',
        'ready_for_payment',
        'completed',
        'closed_unpaid',
        'cancelled',
    ];

    /** @var array<int, string> */
    public const CONFIRMATION_SOURCES = [
        'problem_active',
        'problem_ever',
        'lab_positive',
        'encounter_diagnosis',
        'any_source',
    ];

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitTypeAdminService $visitTypeAdmin = new VisitTypeAdminService(),
        private readonly CohortSavedFilterService $savedFilterService = new CohortSavedFilterService(),
    ) {
    }

    public function assertRegistryAccess(): void
    {
        if (!AclMain::aclCheckCore('patients', 'demo')) {
            throw new \RuntimeException('Forbidden', 403);
        }

        if (
            !AclMain::aclCheckCore('new_clinic', 'new_registry')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
            && !AclMain::aclCheckCore('new_clinic', 'new_doctor')
            && !AclMain::aclCheckCore('new_clinic', 'new_nurse')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertExportAccess(): void
    {
        $this->assertRegistryAccess();

        if (
            !AclMain::aclCheckCore('new_clinic', 'new_registry_export')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
            && !AclMain::aclCheckCore('new_clinic', 'new_doctor')
            && !AclMain::aclCheckCore('new_clinic', 'new_nurse')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function presets(): array
    {
        $today = date('Y-m-d');
        $lostCutoff = date('Y-m-d', strtotime('-180 days'));
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $userId = (int) ($_SESSION['authUserID'] ?? 0);
        $visitTypes = array_values(array_filter(
            $this->visitTypeAdmin->listForAdmin($facilityId),
            static fn (array $row): bool => !empty($row['is_active'])
        ));

        return [
            'builtins' => [
                [
                    'id' => 'in_clinic_now',
                    'label' => 'In clinic now',
                    'filters' => ['active_visit_today' => 'yes'],
                ],
                [
                    'id' => 'incomplete_profiles',
                    'label' => 'Incomplete profiles',
                    'filters' => [
                        'completion_max' => max(0, $this->completionService->getBillingThreshold() - 1),
                    ],
                ],
                [
                    'id' => 'ready_for_doctor_today',
                    'label' => 'Ready for doctor today',
                    'filters' => [
                        'visit_states' => ['ready_for_doctor'],
                        'visit_date_from' => $today,
                        'visit_date_to' => $today,
                    ],
                ],
                [
                    'id' => 'lost_to_followup',
                    'label' => 'Lost to follow-up (180+ days)',
                    'filters' => [
                        'last_visit_to' => $lostCutoff,
                        'record_status' => 'active_only',
                    ],
                ],
                [
                    'id' => 'my_patients_in_clinic',
                    'label' => 'My patients in clinic today',
                    'filters' => [
                        'active_visit_today' => 'yes',
                        'my_provider_today' => true,
                    ],
                ],
                [
                    'id' => 'malaria_active',
                    'label' => 'Malaria (active problem)',
                    'filters' => [
                        'condition_key' => 'malaria',
                        'confirmation_source' => 'problem_active',
                        'record_status' => 'active_only',
                    ],
                ],
                [
                    'id' => 'malaria_lab',
                    'label' => 'Malaria (lab positive, 90 days)',
                    'filters' => [
                        'condition_key' => 'malaria',
                        'confirmation_source' => 'lab_positive',
                        'diagnosis_date_from' => date('Y-m-d', strtotime('-90 days')),
                        'record_status' => 'active_only',
                    ],
                ],
                [
                    'id' => 'adolescents',
                    'label' => 'Adolescents (age 12–19 today)',
                    'filters' => [
                        'age_today_min' => 12,
                        'age_today_max' => 19,
                        'record_status' => 'active_only',
                    ],
                ],
                [
                    'id' => 'recall_overdue',
                    'label' => 'Recall overdue',
                    'filters' => [
                        'recall_due' => 'overdue',
                        'record_status' => 'active_only',
                    ],
                ],
            ],
            'saved' => $userId > 0 ? $this->savedFilterService->listForUser($userId) : [],
            'can_share_filter' => AclMain::aclCheckCore('new_clinic', 'new_cohort_share_filter')
                || AclMain::aclCheckCore('new_clinic', 'new_admin'),
            'visit_states' => self::VISIT_STATE_OPTIONS,
            'visit_types' => array_map(static fn (array $row): array => [
                'id' => (int) ($row['id'] ?? 0),
                'label' => (string) ($row['label'] ?? ''),
            ], $visitTypes),
            'condition_map' => $this->listConditionMap(),
            'confirmation_sources' => [
                ['value' => 'problem_active', 'label' => 'Problem list — active'],
                ['value' => 'problem_ever', 'label' => 'Problem list — ever recorded'],
                ['value' => 'lab_positive', 'label' => 'Lab — positive result'],
                ['value' => 'encounter_diagnosis', 'label' => 'Encounter billing diagnosis'],
                ['value' => 'any_source', 'label' => 'Any source'],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $request
     * @return array<string, mixed>
     */
    public function search(array $request): array
    {
        $this->assertRegistryAccess();

        $started = microtime(true);
        $filters = is_array($request['filters'] ?? null) ? $request['filters'] : [];
        $page = max(1, (int) ($request['page'] ?? 1));
        $pageSize = min(max((int) ($request['page_size'] ?? self::PAGE_SIZE_DEFAULT), 1), self::PAGE_SIZE_MAX);
        $sort = $this->normalizeSort((string) ($request['sort'] ?? 'name_asc'));

        $where = ['1=1'];
        $bind = [];

        $this->appendFacilityFilter($where, $bind);

        $this->applyRecordStatus($filters, $where, $bind);
        $this->applyDemographics($filters, $where, $bind);
        $this->applyVisitFilters($filters, $where, $bind);
        $this->applySchedulingFilters($filters, $where, $bind);
        $this->applyClinicalFilters($filters, $where, $bind);
        $this->applyAllergyMedicationFilters($filters, $where, $bind);
        $this->applyCommunicationsFilters($filters, $where, $bind);

        $joinSql = $this->buildJoins($filters);
        $whereSql = implode(' AND ', $where);

        $countRow = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT pd.pid) AS cnt
             FROM patient_data pd
             {$joinSql}
             WHERE {$whereSql}",
            $bind
        );
        $total = is_array($countRow) ? (int) ($countRow['cnt'] ?? 0) : 0;
        $excludedMissingDob = $this->countExcludedMissingDob($filters, $joinSql, $whereSql, $bind);

        $orderSql = $this->sortSql($sort);
        $offset = ($page - 1) * $pageSize;

        $rows = QueryUtils::fetchRecords(
            "SELECT DISTINCT pd.pid, pd.fname, pd.lname, pd.sex, pd.DOB, pd.pubpid, pd.phone_cell,
                    pd.phone_normalized, COALESCE(npc.completion_score, 0) AS completion_pct,
                    pm.dob_estimated,
                    (SELECT MAX(fe.date) FROM form_encounter fe WHERE fe.pid = pd.pid) AS last_visit_date,
                    (SELECT COUNT(*) FROM new_visit nv
                     WHERE nv.pid = pd.pid AND nv.visit_date = CURDATE()
                     AND nv.state NOT IN ('completed', 'closed_unpaid', 'cancelled')) AS active_visit_today
             FROM patient_data pd
             {$joinSql}
             WHERE {$whereSql}
             ORDER BY {$orderSql}
             LIMIT " . (int) $pageSize . " OFFSET " . (int) $offset,
            $bind
        ) ?: [];

        $mapped = array_map(fn (array $row) => $this->mapRow($row), $rows);
        $mapped = $this->enrichClinicalFields($mapped, $filters);

        return [
            'rows' => $mapped,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
            'meta' => [
                'filter_summary' => $this->explainCriteria($filters),
                'excluded_missing_dob' => $excludedMissingDob,
                'query_ms' => (int) round((microtime(true) - $started) * 1000),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $request
     * @return array{filename: string, content: string, row_count: int}
     */
    public function export(array $request): array
    {
        $this->assertExportAccess();

        $filters = is_array($request['filters'] ?? null) ? $request['filters'] : [];
        $sort = $this->normalizeSort((string) ($request['sort'] ?? 'name_asc'));

        $where = ['1=1'];
        $bind = [];

        $this->appendFacilityFilter($where, $bind);

        $this->applyRecordStatus($filters, $where, $bind);
        $this->applyDemographics($filters, $where, $bind);
        $this->applyVisitFilters($filters, $where, $bind);
        $this->applySchedulingFilters($filters, $where, $bind);
        $this->applyClinicalFilters($filters, $where, $bind);
        $this->applyAllergyMedicationFilters($filters, $where, $bind);
        $this->applyCommunicationsFilters($filters, $where, $bind);

        $joinSql = $this->buildJoins($filters);
        $whereSql = implode(' AND ', $where);
        $orderSql = $this->sortSql($sort);

        $countRow = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT pd.pid) AS cnt
             FROM patient_data pd
             {$joinSql}
             WHERE {$whereSql}",
            $bind
        );
        $total = is_array($countRow) ? (int) ($countRow['cnt'] ?? 0) : 0;
        if ($total > self::EXPORT_ROW_LIMIT) {
            throw new \InvalidArgumentException(
                'Export exceeds ' . self::EXPORT_ROW_LIMIT . ' rows. Narrow your filters.'
            );
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT DISTINCT pd.pid, pd.fname, pd.lname, pd.sex, pd.DOB, pd.pubpid, pd.phone_cell,
                    pd.phone_normalized, COALESCE(npc.completion_score, 0) AS completion_pct,
                    (SELECT MAX(fe.date) FROM form_encounter fe WHERE fe.pid = pd.pid) AS last_visit_date,
                    (SELECT COUNT(*) FROM new_visit nv
                     WHERE nv.pid = pd.pid AND nv.visit_date = CURDATE()
                     AND nv.state NOT IN ('completed', 'closed_unpaid', 'cancelled')) AS active_visit_today
             FROM patient_data pd
             {$joinSql}
             WHERE {$whereSql}
             ORDER BY {$orderSql}
             LIMIT " . (int) self::EXPORT_ROW_LIMIT,
            $bind
        ) ?: [];

        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to create export buffer');
        }

        fputcsv($handle, [
            'PID',
            'Name',
            'Age',
            'Sex',
            'MRN',
            'Phone',
            'Completion %',
            'Last visit',
            'Active visit today',
        ]);

        foreach ($rows as $row) {
            $mapped = $this->mapRow($row);
            fputcsv($handle, [
                $mapped['pid'],
                $mapped['name'],
                $mapped['age_today'] ?? '',
                $mapped['sex'],
                $mapped['mrn'],
                $mapped['phone_masked'],
                $mapped['completion_pct'],
                $mapped['last_visit_date'] ?? '',
                $mapped['has_active_visit_today'] ? 'yes' : 'no',
            ]);
        }

        rewind($handle);
        $content = stream_get_contents($handle) ?: '';
        fclose($handle);

        return [
            'filename' => 'patient-registry-' . date('Ymd-His') . '.csv',
            'content' => $content,
            'row_count' => count($rows),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     */
    public function explainCriteria(array $filters): string
    {
        $parts = [];
        $status = (string) ($filters['record_status'] ?? 'active_only');
        $parts[] = match ($status) {
            'include_inactive' => 'Active and inactive patients',
            'deceased_only' => 'Deceased patients only',
            'all' => 'All patients',
            default => 'Active patients only',
        };

        if (!empty($filters['name_contains'])) {
            $parts[] = 'Name contains "' . trim((string) $filters['name_contains']) . '"';
        }
        if (!empty($filters['national_id'])) {
            $parts[] = 'National ID contains "' . trim((string) $filters['national_id']) . '"';
        }
        if (!empty($filters['nhis_number'])) {
            $parts[] = 'NHIS contains "' . trim((string) $filters['nhis_number']) . '"';
        }
        if (!empty($filters['active_visit_today']) && $filters['active_visit_today'] === 'yes') {
            $parts[] = 'In clinic today';
        }
        if (!empty($filters['visit_states']) && is_array($filters['visit_states'])) {
            $parts[] = 'Visit state: ' . implode(', ', $filters['visit_states']);
        }
        if (!empty($filters['visit_type_id'])) {
            $parts[] = 'Visit type id ' . (int) $filters['visit_type_id'];
        }
        if (!empty($filters['my_provider_today'])) {
            $parts[] = 'My patients in clinic today';
        }
        if (!empty($filters['visit_date_from']) || !empty($filters['visit_date_to'])) {
            $parts[] = 'Visit dates '
                . ($filters['visit_date_from'] ?? '…')
                . ' – '
                . ($filters['visit_date_to'] ?? '…');
        }
        $payment = (string) ($filters['payment_status'] ?? 'any');
        if (in_array($payment, ['paid', 'outstanding'], true)) {
            $parts[] = 'Payment: ' . $payment;
        }
        if (!empty($filters['last_visit_from']) || !empty($filters['last_visit_to'])) {
            $parts[] = 'Last visit '
                . ($filters['last_visit_from'] ?? '…')
                . ' – '
                . ($filters['last_visit_to'] ?? '…');
        }
        if (isset($filters['completion_max']) && $filters['completion_max'] !== null && $filters['completion_max'] !== '') {
            $parts[] = 'Completion ≤ ' . (int) $filters['completion_max'] . '%';
        }
        if (!empty($filters['problem_title_contains'])) {
            $parts[] = 'Problem contains "' . trim((string) $filters['problem_title_contains']) . '"';
        }
        if (!empty($filters['condition_key'])) {
            $parts[] = 'Condition: ' . trim((string) $filters['condition_key']);
        }
        if (!empty($filters['icd_prefix'])) {
            $parts[] = 'ICD prefix ' . trim((string) $filters['icd_prefix']);
        }
        if (($filters['age_at_diagnosis_min'] ?? '') !== '' && $filters['age_at_diagnosis_min'] !== null) {
            $parts[] = 'Age at diagnosis ≥ ' . (int) $filters['age_at_diagnosis_min'];
        }
        if (($filters['age_at_diagnosis_max'] ?? '') !== '' && $filters['age_at_diagnosis_max'] !== null) {
            $parts[] = 'Age at diagnosis ≤ ' . (int) $filters['age_at_diagnosis_max'];
        }
        if (!empty($filters['lab_test_contains'])) {
            $parts[] = 'Lab test contains "' . trim((string) $filters['lab_test_contains']) . '"';
        }
        $source = (string) ($filters['confirmation_source'] ?? '');
        if ($source !== '' && in_array($source, self::CONFIRMATION_SOURCES, true)) {
            $parts[] = 'Confirmation: ' . $source;
        }
        $apptToday = (string) ($filters['appointment_today'] ?? '');
        if ($apptToday === 'yes') {
            $parts[] = 'Appointment today';
        } elseif ($apptToday === 'no') {
            $parts[] = 'No appointment today';
        }
        if (!empty($filters['appointment_date_from']) || !empty($filters['appointment_date_to'])) {
            $parts[] = 'Appointment dates '
                . ($filters['appointment_date_from'] ?? '…')
                . ' – '
                . ($filters['appointment_date_to'] ?? '…');
        }
        $recallDue = (string) ($filters['recall_due'] ?? 'any');
        if (in_array($recallDue, ['overdue', 'due_soon'], true)) {
            $parts[] = 'Recall: ' . $recallDue;
        }
        if (!empty($filters['recall_date_from']) || !empty($filters['recall_date_to'])) {
            $parts[] = 'Recall dates '
                . ($filters['recall_date_from'] ?? '…')
                . ' – '
                . ($filters['recall_date_to'] ?? '…');
        }
        if (!empty($filters['last_visit_never'])) {
            $parts[] = 'Never visited';
        }
        if (!empty($filters['allergy_substance_contains'])) {
            $parts[] = 'Allergy contains "' . trim((string) $filters['allergy_substance_contains']) . '"';
        }
        if (!empty($filters['medication_contains'])) {
            $parts[] = 'Medication contains "' . trim((string) $filters['medication_contains']) . '"';
        }
        $unread = (string) ($filters['unread_staff_message'] ?? '');
        if ($unread === 'yes') {
            $parts[] = 'Unread staff message for me';
        } elseif ($unread === 'no') {
            $parts[] = 'No unread staff message for me';
        }
        $openReminder = (string) ($filters['open_dated_reminder'] ?? '');
        if ($openReminder === 'yes') {
            $parts[] = 'Open dated reminder for me';
        } elseif ($openReminder === 'no') {
            $parts[] = 'No open dated reminder for me';
        }

        return implode(' · ', $parts);
    }

    /**
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function appendFacilityFilter(array &$where, array &$bind): void
    {
        $facility = $this->facilityScope->getPatientFilterClause('pd');
        $clause = ltrim($facility['sql'], ' AND');
        if ($clause === '') {
            return;
        }

        $where[] = $clause;
        $bind = array_merge($bind, $facility['bind']);
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function applyRecordStatus(array $filters, array &$where, array &$bind): void
    {
        $status = (string) ($filters['record_status'] ?? 'active_only');
        match ($status) {
            'include_inactive' => $where[] = "(pd.deceased_date IS NULL OR pd.deceased_date = '' OR pd.deceased_date = '0000-00-00')",
            'deceased_only' => $where[] = "(pd.deceased_date IS NOT NULL AND pd.deceased_date != '' AND pd.deceased_date != '0000-00-00')",
            'all' => null,
            default => $where[] = "(pd.deceased_date IS NULL OR pd.deceased_date = '' OR pd.deceased_date = '0000-00-00')
                AND (pd.status IS NULL OR pd.status = '' OR pd.status = 'active')",
        };
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function applyDemographics(array $filters, array &$where, array &$bind): void
    {
        $sex = (string) ($filters['sex'] ?? 'any');
        if (in_array($sex, ['Male', 'Female', 'Other'], true)) {
            $where[] = 'pd.sex = ?';
            $bind[] = $sex;
        }

        if (($filters['age_today_min'] ?? '') !== '' && $filters['age_today_min'] !== null) {
            $where[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, CURDATE()) >= ?';
            $bind[] = (int) $filters['age_today_min'];
        }
        if (($filters['age_today_max'] ?? '') !== '' && $filters['age_today_max'] !== null) {
            $where[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, CURDATE()) <= ?';
            $bind[] = (int) $filters['age_today_max'];
        }

        $name = trim((string) ($filters['name_contains'] ?? ''));
        if ($name !== '') {
            $where[] = '(pd.fname LIKE ? OR pd.lname LIKE ? OR CONCAT(pd.fname, " ", pd.lname) LIKE ?)';
            $like = '%' . $name . '%';
            $bind[] = $like;
            $bind[] = $like;
            $bind[] = $like;
        }

        $mrn = trim((string) ($filters['mrn'] ?? ''));
        if ($mrn !== '') {
            $where[] = 'pd.pubpid LIKE ?';
            $bind[] = '%' . $mrn . '%';
        }

        $phone = $this->phoneNormalizer->normalize(trim((string) ($filters['phone'] ?? '')));
        if ($phone !== '') {
            $where[] = '(pd.phone_normalized LIKE ? OR pd.phone_cell LIKE ?)';
            $bind[] = '%' . $phone . '%';
            $bind[] = '%' . $phone . '%';
        }

        $nationalId = trim((string) ($filters['national_id'] ?? ''));
        if ($nationalId !== '') {
            $where[] = 'pd.ss LIKE ?';
            $bind[] = '%' . $nationalId . '%';
        }

        $nhis = trim((string) ($filters['nhis_number'] ?? ''));
        if ($nhis !== '') {
            $where[] = 'pm.nhis_number LIKE ?';
            $bind[] = '%' . $nhis . '%';
        }

        if (($filters['completion_min'] ?? '') !== '' && $filters['completion_min'] !== null) {
            $where[] = 'COALESCE(npc.completion_score, 0) >= ?';
            $bind[] = (int) $filters['completion_min'];
        }
        if (($filters['completion_max'] ?? '') !== '' && $filters['completion_max'] !== null) {
            $where[] = 'COALESCE(npc.completion_score, 0) <= ?';
            $bind[] = (int) $filters['completion_max'];
        }

        if (($filters['active_visit_today'] ?? '') === 'yes') {
            $where[] = 'EXISTS (
                SELECT 1 FROM new_visit nv
                WHERE nv.pid = pd.pid AND nv.visit_date = CURDATE()
                AND nv.state NOT IN (\'completed\', \'closed_unpaid\', \'cancelled\')
            )';
        } elseif (($filters['active_visit_today'] ?? '') === 'no') {
            $where[] = 'NOT EXISTS (
                SELECT 1 FROM new_visit nv
                WHERE nv.pid = pd.pid AND nv.visit_date = CURDATE()
                AND nv.state NOT IN (\'completed\', \'closed_unpaid\', \'cancelled\')
            )';
        }
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function applyVisitFilters(array $filters, array &$where, array &$bind): void
    {
        $states = $this->normalizeVisitStates($filters['visit_states'] ?? null);
        $dateFrom = trim((string) ($filters['visit_date_from'] ?? ''));
        $dateTo = trim((string) ($filters['visit_date_to'] ?? ''));
        $payment = (string) ($filters['payment_status'] ?? 'any');
        $lastFrom = trim((string) ($filters['last_visit_from'] ?? ''));
        $lastTo = trim((string) ($filters['last_visit_to'] ?? ''));
        $visitTypeId = (int) ($filters['visit_type_id'] ?? 0);
        $myProviderToday = !empty($filters['my_provider_today']);
        $actorUserId = (int) ($_SESSION['authUserID'] ?? 0);

        $hasVisitFilter = $states !== []
            || $dateFrom !== ''
            || $dateTo !== ''
            || in_array($payment, ['paid', 'outstanding'], true)
            || $visitTypeId > 0
            || $myProviderToday;

        if ($hasVisitFilter) {
            $sub = ['nv.pid = pd.pid'];
            $subBind = [];

            if ($states !== []) {
                $placeholders = implode(',', array_fill(0, count($states), '?'));
                $sub[] = "nv.state IN ({$placeholders})";
                foreach ($states as $state) {
                    $subBind[] = $state;
                }
            }
            if ($dateFrom !== '') {
                $sub[] = 'nv.visit_date >= ?';
                $subBind[] = $dateFrom;
            }
            if ($dateTo !== '') {
                $sub[] = 'nv.visit_date <= ?';
                $subBind[] = $dateTo;
            }
            if ($visitTypeId > 0) {
                $sub[] = 'nv.visit_type_id = ?';
                $subBind[] = $visitTypeId;
            }
            if ($myProviderToday) {
                if ($actorUserId <= 0) {
                    $where[] = '1=0';
                } else {
                    $sub[] = 'nv.visit_date = CURDATE()';
                    $sub[] = "nv.state NOT IN ('completed', 'closed_unpaid', 'cancelled')";
                    $sub[] = '(nv.assigned_provider_id = ? OR nv.routing_suggested_provider_id = ? OR nv.hard_assigned_provider_id = ?)';
                    $subBind[] = $actorUserId;
                    $subBind[] = $actorUserId;
                    $subBind[] = $actorUserId;
                }
            }
            if ($payment === 'paid') {
                $sub[] = "nv.state = 'completed' AND nv.left_unpaid_at IS NULL";
            } elseif ($payment === 'outstanding') {
                $sub[] = "(nv.state = 'closed_unpaid' OR nv.left_unpaid_at IS NOT NULL)";
            }

            $where[] = 'EXISTS (SELECT 1 FROM new_visit nv WHERE ' . implode(' AND ', $sub) . ')';
            $bind = array_merge($bind, $subBind);
        }

        if ($lastFrom !== '') {
            $where[] = '(SELECT MAX(fe.date) FROM form_encounter fe WHERE fe.pid = pd.pid) >= ?';
            $bind[] = $lastFrom;
        }
        if ($lastTo !== '') {
            $where[] = '(SELECT MAX(fe.date) FROM form_encounter fe WHERE fe.pid = pd.pid) <= ?';
            $bind[] = $lastTo;
        }
        if (!empty($filters['last_visit_never'])) {
            $where[] = '(SELECT MAX(fe.date) FROM form_encounter fe WHERE fe.pid = pd.pid) IS NULL';
        }
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function applySchedulingFilters(array $filters, array &$where, array &$bind): void
    {
        $apptToday = (string) ($filters['appointment_today'] ?? '');
        if ($apptToday === 'yes') {
            $where[] = "EXISTS (
                SELECT 1 FROM openemr_postcalendar_events pce
                WHERE pce.pc_pid = CAST(pd.pid AS CHAR)
                  AND pce.pc_eventDate = CURDATE()
                  AND pce.pc_apptstatus NOT IN ('x', 'X')
            )";
        } elseif ($apptToday === 'no') {
            $where[] = "NOT EXISTS (
                SELECT 1 FROM openemr_postcalendar_events pce
                WHERE pce.pc_pid = CAST(pd.pid AS CHAR)
                  AND pce.pc_eventDate = CURDATE()
                  AND pce.pc_apptstatus NOT IN ('x', 'X')
            )";
        }

        $apptFrom = trim((string) ($filters['appointment_date_from'] ?? ''));
        $apptTo = trim((string) ($filters['appointment_date_to'] ?? ''));
        if ($apptFrom !== '' || $apptTo !== '') {
            $sub = ['pce.pc_pid = CAST(pd.pid AS CHAR)', "pce.pc_apptstatus NOT IN ('x', 'X')"];
            $subBind = [];
            if ($apptFrom !== '') {
                $sub[] = 'pce.pc_eventDate >= ?';
                $subBind[] = $apptFrom;
            }
            if ($apptTo !== '') {
                $sub[] = 'pce.pc_eventDate <= ?';
                $subBind[] = $apptTo;
            }
            $where[] = 'EXISTS (SELECT 1 FROM openemr_postcalendar_events pce WHERE ' . implode(' AND ', $sub) . ')';
            $bind = array_merge($bind, $subBind);
        }

        $recallDue = (string) ($filters['recall_due'] ?? 'any');
        $recallFrom = trim((string) ($filters['recall_date_from'] ?? ''));
        $recallTo = trim((string) ($filters['recall_date_to'] ?? ''));
        if ($recallDue !== 'any' || $recallFrom !== '' || $recallTo !== '') {
            $sub = ['mr.r_pid = pd.pid'];
            $subBind = [];
            if ($recallDue === 'overdue') {
                $sub[] = 'mr.r_eventDate < CURDATE()';
            } elseif ($recallDue === 'due_soon') {
                $sub[] = 'mr.r_eventDate >= CURDATE()';
                $sub[] = 'mr.r_eventDate <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)';
            }
            if ($recallFrom !== '') {
                $sub[] = 'mr.r_eventDate >= ?';
                $subBind[] = $recallFrom;
            }
            if ($recallTo !== '') {
                $sub[] = 'mr.r_eventDate <= ?';
                $subBind[] = $recallTo;
            }
            $where[] = 'EXISTS (SELECT 1 FROM medex_recalls mr WHERE ' . implode(' AND ', $sub) . ')';
            $bind = array_merge($bind, $subBind);
        }
    }

    /**
     * @param mixed $raw
     * @return array<int, string>
     */
    private function normalizeVisitStates(mixed $raw): array
    {
        if (is_string($raw) && $raw !== '') {
            $raw = array_map('trim', explode(',', $raw));
        }
        if (!is_array($raw)) {
            return [];
        }

        $states = [];
        foreach ($raw as $state) {
            $state = trim((string) $state);
            if ($state !== '' && in_array($state, self::VISIT_STATE_OPTIONS, true)) {
                $states[] = $state;
            }
        }

        return array_values(array_unique($states));
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function applyClinicalFilters(array $filters, array &$where, array &$bind): void
    {
        $terms = $this->resolveClinicalTerms($filters);
        if ($terms === null) {
            return;
        }

        $clauses = [];
        $clauseBind = [];
        $ageMin = $this->nullableInt($filters['age_at_diagnosis_min'] ?? null);
        $ageMax = $this->nullableInt($filters['age_at_diagnosis_max'] ?? null);

        if (in_array($terms['source'], ['problem_active', 'problem_ever', 'any_source'], true)) {
            $problem = $this->buildProblemListExistsClause(
                $terms['title_terms'],
                $terms['icd_prefixes'],
                $terms['diag_from'],
                $terms['diag_to'],
                $terms['source'] !== 'problem_ever',
                $ageMin,
                $ageMax
            );
            if ($problem !== null) {
                $clauses[] = $problem['sql'];
                $clauseBind = array_merge($clauseBind, $problem['bind']);
            }
        }

        if (in_array($terms['source'], ['encounter_diagnosis', 'any_source'], true)) {
            $billing = $this->buildBillingDiagnosisExistsClause(
                $terms['title_terms'],
                $terms['icd_prefixes'],
                $terms['diag_from'],
                $terms['diag_to'],
                $ageMin,
                $ageMax
            );
            if ($billing !== null) {
                $clauses[] = $billing['sql'];
                $clauseBind = array_merge($clauseBind, $billing['bind']);
            }
        }

        if (in_array($terms['source'], ['lab_positive', 'any_source'], true)) {
            $lab = $this->buildLabPositiveExistsClause(
                $terms['title_terms'],
                $terms['icd_prefixes'],
                $terms['lab_test'],
                $terms['diag_from'],
                $terms['diag_to'],
                $ageMin,
                $ageMax
            );
            if ($lab !== null) {
                $clauses[] = $lab['sql'];
                $clauseBind = array_merge($clauseBind, $lab['bind']);
            }
        }

        if ($clauses === []) {
            return;
        }

        $where[] = count($clauses) === 1
            ? $clauses[0]
            : '(' . implode(' OR ', $clauses) . ')';
        $bind = array_merge($bind, $clauseBind);
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function applyAllergyMedicationFilters(array $filters, array &$where, array &$bind): void
    {
        $allergy = trim((string) ($filters['allergy_substance_contains'] ?? ''));
        if ($allergy !== '') {
            $where[] = "EXISTS (
                SELECT 1 FROM lists la
                WHERE la.pid = pd.pid
                  AND la.type = 'allergy'
                  AND la.activity = 1
                  AND la.title LIKE ?
            )";
            $bind[] = '%' . $allergy . '%';
        }

        $medication = trim((string) ($filters['medication_contains'] ?? ''));
        if ($medication !== '') {
            $where[] = "EXISTS (
                SELECT 1 FROM lists lm
                WHERE lm.pid = pd.pid
                  AND lm.type = 'medication'
                  AND lm.activity = 1
                  AND (lm.title LIKE ? OR lm.diagnosis LIKE ?)
            )";
            $bind[] = '%' . $medication . '%';
            $bind[] = '%' . $medication . '%';
        }
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, string> $where
     * @param array<int, mixed> $bind
     */
    private function applyCommunicationsFilters(array $filters, array &$where, array &$bind): void
    {
        $unread = (string) ($filters['unread_staff_message'] ?? '');
        if (in_array($unread, ['yes', 'no'], true)) {
            $authUser = trim((string) ($_SESSION['authUser'] ?? ''));
            if ($authUser === '') {
                $where[] = '1=0';
            } else {
                $exists = "EXISTS (
                    SELECT 1 FROM pnotes pn
                    WHERE pn.pid = pd.pid
                      AND pn.deleted != 1
                      AND pn.activity = 1
                      AND pn.message_status = 'New'
                      AND pn.assigned_to LIKE ?
                )";
                $where[] = $unread === 'yes' ? $exists : 'NOT ' . $exists;
                $bind[] = '%' . $authUser . '%';
            }
        }

        $openReminder = (string) ($filters['open_dated_reminder'] ?? '');
        if (in_array($openReminder, ['yes', 'no'], true)) {
            $userId = (int) ($_SESSION['authUserID'] ?? 0);
            if ($userId <= 0) {
                $where[] = '1=0';
            } else {
                $exists = "EXISTS (
                    SELECT 1 FROM dated_reminders dr
                    JOIN dated_reminders_link drl ON dr.dr_id = drl.dr_id
                    WHERE dr.pid = pd.pid
                      AND drl.to_id = ?
                      AND dr.message_processed = 0
                )";
                $where[] = $openReminder === 'yes' ? $exists : 'NOT ' . $exists;
                $bind[] = $userId;
            }
        }
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{
     *   source: string,
     *   title_terms: array<int, string>,
     *   icd_prefixes: array<int, string>,
     *   diag_from: string,
     *   diag_to: string,
     *   lab_test: string,
     *   condition_label: ?string
     * }|null
     */
    private function resolveClinicalTerms(array $filters): ?array
    {
        $titleTerms = [];
        $manualTitle = trim((string) ($filters['problem_title_contains'] ?? ''));
        if ($manualTitle !== '') {
            $titleTerms[] = $manualTitle;
        }

        $labTest = trim((string) ($filters['lab_test_contains'] ?? ''));

        $icdPrefixes = [];
        $manualIcd = trim((string) ($filters['icd_prefix'] ?? ''));
        if ($manualIcd !== '') {
            $icdPrefixes[] = $manualIcd;
        }

        $conditionLabel = null;
        $conditionKey = trim((string) ($filters['condition_key'] ?? ''));
        if ($conditionKey !== '') {
            $mapped = $this->loadConditionMap($conditionKey);
            if ($mapped !== null) {
                $conditionLabel = $mapped['display_name'];
                if ($titleTerms === []) {
                    $titleTerms = $mapped['title_terms'];
                }
                if ($icdPrefixes === []) {
                    $icdPrefixes = $mapped['icd_prefixes'];
                }
            }
        }

        if ($titleTerms === [] && $icdPrefixes === [] && $labTest === '') {
            return null;
        }

        $source = (string) ($filters['confirmation_source'] ?? 'problem_active');
        if (!in_array($source, self::CONFIRMATION_SOURCES, true)) {
            $source = 'problem_active';
        }

        return [
            'source' => $source,
            'title_terms' => $titleTerms,
            'icd_prefixes' => $icdPrefixes,
            'diag_from' => trim((string) ($filters['diagnosis_date_from'] ?? '')),
            'diag_to' => trim((string) ($filters['diagnosis_date_to'] ?? '')),
            'lab_test' => $labTest,
            'condition_label' => $conditionLabel,
        ];
    }

    /**
     * @return array<int, array{key: string, label: string}>
     */
    private function listConditionMap(): array
    {
        try {
            $rows = QueryUtils::fetchRecords(
                "SELECT condition_key, display_name
                 FROM new_condition_map
                 WHERE is_active = 1
                 ORDER BY display_name ASC"
            ) ?: [];
        } catch (\Throwable) {
            return [];
        }

        return array_map(static fn (array $row): array => [
            'key' => (string) ($row['condition_key'] ?? ''),
            'label' => (string) ($row['display_name'] ?? ''),
        ], $rows);
    }

    /**
     * @return array{display_name: string, title_terms: array<int, string>, icd_prefixes: array<int, string>}|null
     */
    private function loadConditionMap(string $conditionKey): ?array
    {
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT display_name, icd10_patterns, title_patterns
                 FROM new_condition_map
                 WHERE condition_key = ? AND is_active = 1",
                [$conditionKey]
            );
        } catch (\Throwable) {
            return null;
        }

        if (!is_array($row)) {
            return null;
        }

        return [
            'display_name' => (string) ($row['display_name'] ?? $conditionKey),
            'title_terms' => $this->splitPatterns((string) ($row['title_patterns'] ?? '')),
            'icd_prefixes' => $this->splitPatterns((string) ($row['icd10_patterns'] ?? '')),
        ];
    }

    /**
     * @return array<int, string>
     */
    private function splitPatterns(string $raw): array
    {
        if ($raw === '') {
            return [];
        }

        $parts = array_map('trim', explode(',', $raw));

        return array_values(array_filter($parts, static fn (string $part): bool => $part !== ''));
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) $value;
    }

    /**
     * @param array<int, string> $titleTerms
     * @param array<int, string> $icdPrefixes
     * @return array{sql: string, bind: array<int, mixed>}|null
     */
    private function buildProblemListExistsClause(
        array $titleTerms,
        array $icdPrefixes,
        string $diagFrom,
        string $diagTo,
        bool $activeOnly,
        ?int $ageMin,
        ?int $ageMax
    ): ?array {
        $sub = ["l.pid = pd.pid", "l.type = 'medical_problem'"];
        $subBind = [];

        if ($activeOnly) {
            $sub[] = "l.activity = '1'";
        }

        $matchParts = [];
        foreach ($titleTerms as $term) {
            $matchParts[] = 'l.title LIKE ?';
            $subBind[] = '%' . $term . '%';
        }
        foreach ($icdPrefixes as $prefix) {
            $matchParts[] = '(l.diagnosis LIKE ? OR l.diagnosis LIKE ?)';
            $subBind[] = '%ICD10:' . $prefix . '%';
            $subBind[] = '%ICD9:' . $prefix . '%';
        }
        if ($matchParts === []) {
            return null;
        }
        $sub[] = '(' . implode(' OR ', $matchParts) . ')';

        if ($diagFrom !== '') {
            $sub[] = 'l.begdate >= ?';
            $subBind[] = $diagFrom;
        }
        if ($diagTo !== '') {
            $sub[] = 'l.begdate <= ?';
            $subBind[] = $diagTo;
        }
        if ($ageMin !== null || $ageMax !== null) {
            $sub[] = "(pd.DOB IS NOT NULL AND pd.DOB != '' AND pd.DOB != '0000-00-00')";
            if ($ageMin !== null) {
                $sub[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, l.begdate) >= ?';
                $subBind[] = $ageMin;
            }
            if ($ageMax !== null) {
                $sub[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, l.begdate) <= ?';
                $subBind[] = $ageMax;
            }
        }

        return [
            'sql' => 'EXISTS (SELECT 1 FROM lists l WHERE ' . implode(' AND ', $sub) . ')',
            'bind' => $subBind,
        ];
    }

    /**
     * @param array<int, string> $titleTerms
     * @param array<int, string> $icdPrefixes
     * @return array{sql: string, bind: array<int, mixed>}|null
     */
    private function buildBillingDiagnosisExistsClause(
        array $titleTerms,
        array $icdPrefixes,
        string $diagFrom,
        string $diagTo,
        ?int $ageMin,
        ?int $ageMax
    ): ?array {
        $sub = [
            'b.pid = pd.pid',
            'b.activity = 1',
            "(b.code_type LIKE '%ICD%' OR b.code_type LIKE '%icd%')",
        ];
        $subBind = [];

        $matchParts = [];
        foreach ($icdPrefixes as $prefix) {
            $matchParts[] = 'b.code LIKE ?';
            $subBind[] = $prefix . '%';
        }
        foreach ($titleTerms as $term) {
            $matchParts[] = 'b.code_text LIKE ?';
            $subBind[] = '%' . $term . '%';
        }
        if ($matchParts === []) {
            return null;
        }
        $sub[] = '(' . implode(' OR ', $matchParts) . ')';

        if ($diagFrom !== '') {
            $sub[] = 'b.date >= ?';
            $subBind[] = $diagFrom;
        }
        if ($diagTo !== '') {
            $sub[] = 'b.date <= ?';
            $subBind[] = $diagTo;
        }
        if ($ageMin !== null || $ageMax !== null) {
            $sub[] = "(pd.DOB IS NOT NULL AND pd.DOB != '' AND pd.DOB != '0000-00-00')";
            if ($ageMin !== null) {
                $sub[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, b.date) >= ?';
                $subBind[] = $ageMin;
            }
            if ($ageMax !== null) {
                $sub[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, b.date) <= ?';
                $subBind[] = $ageMax;
            }
        }

        return [
            'sql' => 'EXISTS (SELECT 1 FROM billing b WHERE ' . implode(' AND ', $sub) . ')',
            'bind' => $subBind,
        ];
    }

    /**
     * @param array<int, string> $titleTerms
     * @param array<int, string> $icdPrefixes
     * @return array{sql: string, bind: array<int, mixed>}|null
     */
    private function buildLabPositiveExistsClause(
        array $titleTerms,
        array $icdPrefixes,
        string $labTest,
        string $diagFrom,
        string $diagTo,
        ?int $ageMin,
        ?int $ageMax
    ): ?array {
        $sub = [
            'po.patient_id = pd.pid',
            'po.activity = 1',
            "pres.result NOT IN ('DNR', 'TNP', '')",
            "(pres.abnormal IN ('yes', 'high', 'low')
              OR LOWER(pres.result) IN ('positive', 'pos', 'reactive', 'detected')
              OR LOWER(pres.result_text) LIKE '%positive%'
              OR LOWER(pres.result_text) LIKE '%reactive%')",
        ];
        $subBind = [];

        $matchParts = [];
        if ($labTest !== '') {
            $matchParts[] = 'poc.procedure_name LIKE ?';
            $subBind[] = '%' . $labTest . '%';
            $matchParts[] = 'pres.result_text LIKE ?';
            $subBind[] = '%' . $labTest . '%';
            $matchParts[] = 'poc.procedure_code LIKE ?';
            $subBind[] = '%' . $labTest . '%';
        }
        foreach ($titleTerms as $term) {
            $matchParts[] = 'poc.procedure_name LIKE ?';
            $subBind[] = '%' . $term . '%';
            $matchParts[] = 'pres.result_text LIKE ?';
            $subBind[] = '%' . $term . '%';
        }
        foreach ($icdPrefixes as $prefix) {
            $matchParts[] = 'poc.procedure_code LIKE ?';
            $subBind[] = '%' . $prefix . '%';
        }
        if ($matchParts !== []) {
            $sub[] = '(' . implode(' OR ', $matchParts) . ')';
        }

        $indexDate = 'COALESCE(pr.date_collected, pr.date_report, DATE(pres.date))';
        if ($diagFrom !== '') {
            $sub[] = $indexDate . ' >= ?';
            $subBind[] = $diagFrom;
        }
        if ($diagTo !== '') {
            $sub[] = $indexDate . ' <= ?';
            $subBind[] = $diagTo;
        }
        if ($ageMin !== null || $ageMax !== null) {
            $sub[] = "(pd.DOB IS NOT NULL AND pd.DOB != '' AND pd.DOB != '0000-00-00')";
            if ($ageMin !== null) {
                $sub[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, ' . $indexDate . ') >= ?';
                $subBind[] = $ageMin;
            }
            if ($ageMax !== null) {
                $sub[] = 'TIMESTAMPDIFF(YEAR, pd.DOB, ' . $indexDate . ') <= ?';
                $subBind[] = $ageMax;
            }
        }

        return [
            'sql' => 'EXISTS (
                SELECT 1 FROM procedure_result pres
                INNER JOIN procedure_report pr ON pr.procedure_report_id = pres.procedure_report_id
                INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
                LEFT JOIN procedure_order_code poc
                    ON poc.procedure_order_id = po.procedure_order_id
                    AND poc.procedure_order_seq = pr.procedure_order_seq
                WHERE ' . implode(' AND ', $sub) . '
            )',
            'bind' => $subBind,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function hasClinicalContext(array $filters): bool
    {
        return $this->resolveClinicalTerms($filters) !== null;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @param array<string, mixed> $filters
     * @return array<int, array<string, mixed>>
     */
    private function enrichClinicalFields(array $rows, array $filters): array
    {
        $terms = $this->resolveClinicalTerms($filters);
        if ($terms === null || $rows === []) {
            return $rows;
        }

        $pids = array_values(array_unique(array_map(static fn (array $row): int => (int) ($row['pid'] ?? 0), $rows)));
        $pids = array_values(array_filter($pids, static fn (int $pid): bool => $pid > 0));
        if ($pids === []) {
            return $rows;
        }

        $placeholders = implode(',', array_fill(0, count($pids), '?'));
        $label = $terms['condition_label'] ?? ($terms['title_terms'][0] ?? 'Condition');
        $suffix = $terms['source'] === 'lab_positive' ? ' (lab positive)' : '';

        if ($terms['source'] === 'lab_positive') {
            $clinicalRows = QueryUtils::fetchRecords(
                "SELECT po.patient_id AS pid,
                        poc.procedure_name AS title,
                        COALESCE(pr.date_collected, pr.date_report, DATE(pres.date)) AS index_date,
                        TIMESTAMPDIFF(YEAR, pd.DOB, COALESCE(pr.date_collected, pr.date_report, DATE(pres.date))) AS age_at_diagnosis
                 FROM procedure_result pres
                 INNER JOIN procedure_report pr ON pr.procedure_report_id = pres.procedure_report_id
                 INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
                 INNER JOIN patient_data pd ON pd.pid = po.patient_id
                 LEFT JOIN procedure_order_code poc
                    ON poc.procedure_order_id = po.procedure_order_id
                    AND poc.procedure_order_seq = pr.procedure_order_seq
                 WHERE po.patient_id IN ({$placeholders})
                   AND po.activity = 1
                   AND pres.result NOT IN ('DNR', 'TNP', '')
                 ORDER BY po.patient_id ASC, COALESCE(pr.date_collected, pr.date_report, DATE(pres.date)) ASC",
                $pids
            ) ?: [];
        } else {
            $clinicalRows = QueryUtils::fetchRecords(
                "SELECT l.pid, l.title, l.begdate AS index_date,
                        TIMESTAMPDIFF(YEAR, pd.DOB, l.begdate) AS age_at_diagnosis
                 FROM lists l
                 INNER JOIN patient_data pd ON pd.pid = l.pid
                 WHERE l.pid IN ({$placeholders})
                   AND l.type = 'medical_problem'
                   AND l.activity = '1'
                 ORDER BY l.pid ASC, l.begdate ASC",
                $pids
            ) ?: [];
        }

        $byPid = [];
        foreach ($clinicalRows as $clinicalRow) {
            $pid = (int) ($clinicalRow['pid'] ?? 0);
            if ($pid <= 0 || isset($byPid[$pid])) {
                continue;
            }
            $byPid[$pid] = $clinicalRow;
        }

        foreach ($rows as $index => $row) {
            $pid = (int) ($row['pid'] ?? 0);
            if (!isset($byPid[$pid])) {
                continue;
            }
            $match = $byPid[$pid];
            $rows[$index]['condition_summary'] = $label . $suffix;
            $rows[$index]['index_diagnosis_date'] = $match['index_date'] ?? null;
            if (isset($match['age_at_diagnosis'])) {
                $rows[$index]['age_at_diagnosis'] = (int) $match['age_at_diagnosis'];
            }
        }

        return $rows;
    }

    /**
     * @param array<string, mixed> $filters
     * @param array<int, mixed> $bind
     */
    private function countExcludedMissingDob(
        array $filters,
        string $joinSql,
        string $whereSql,
        array $bind
    ): int {
        $ageMin = $this->nullableInt($filters['age_at_diagnosis_min'] ?? null);
        $ageMax = $this->nullableInt($filters['age_at_diagnosis_max'] ?? null);
        $terms = $this->resolveClinicalTerms($filters);
        if (($ageMin === null && $ageMax === null) || $terms === null) {
            return 0;
        }

        $where = ['1=1'];
        $clauseBind = [];
        $this->appendFacilityFilter($where, $clauseBind);
        $this->applyRecordStatus($filters, $where, $clauseBind);
        $where[] = "(pd.DOB IS NULL OR pd.DOB = '' OR pd.DOB = '0000-00-00')";

        $problem = $this->buildProblemListExistsClause(
            $terms['title_terms'],
            $terms['icd_prefixes'],
            $terms['diag_from'],
            $terms['diag_to'],
            $terms['source'] !== 'problem_ever',
            null,
            null
        );
        if ($problem === null) {
            return 0;
        }
        $where[] = $problem['sql'];
        $clauseBind = array_merge($clauseBind, $problem['bind']);
        $whereSql = implode(' AND ', $where);

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT pd.pid) AS cnt
             FROM patient_data pd
             {$joinSql}
             WHERE {$whereSql}",
            $clauseBind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function buildJoins(array $filters): string
    {
        return 'LEFT JOIN new_patient_completion npc ON npc.pid = pd.pid
                LEFT JOIN new_patient_meta pm ON pm.pid = pd.pid';
    }

    private function normalizeSort(string $sort): string
    {
        return match ($sort) {
            'name_desc' => 'name_desc',
            'age_asc' => 'age_asc',
            'age_desc' => 'age_desc',
            'completion_asc' => 'completion_asc',
            'completion_desc' => 'completion_desc',
            'last_visit_asc' => 'last_visit_asc',
            'last_visit_desc' => 'last_visit_desc',
            'dx_date_asc' => 'dx_date_asc',
            'dx_date_desc' => 'dx_date_desc',
            default => 'name_asc',
        };
    }

    private function sortSql(string $sort): string
    {
        $lastVisitExpr = '(SELECT MAX(fe.date) FROM form_encounter fe WHERE fe.pid = pd.pid)';
        $dxDateExpr = "(SELECT MIN(l.begdate) FROM lists l
                        WHERE l.pid = pd.pid AND l.type = 'medical_problem' AND l.activity = '1')";

        return match ($sort) {
            'name_desc' => 'pd.lname DESC, pd.fname DESC',
            'age_asc' => 'pd.DOB DESC',
            'age_desc' => 'pd.DOB ASC',
            'completion_asc' => 'completion_pct ASC, pd.lname ASC',
            'completion_desc' => 'completion_pct DESC, pd.lname ASC',
            'last_visit_asc' => "{$lastVisitExpr} ASC, pd.lname ASC",
            'last_visit_desc' => "{$lastVisitExpr} DESC, pd.lname ASC",
            'dx_date_asc' => "{$dxDateExpr} ASC, pd.lname ASC",
            'dx_date_desc' => "{$dxDateExpr} DESC, pd.lname ASC",
            default => 'pd.lname ASC, pd.fname ASC',
        };
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        $pid = (int) ($row['pid'] ?? 0);
        $fname = trim((string) ($row['fname'] ?? ''));
        $lname = trim((string) ($row['lname'] ?? ''));
        $phone = (string) ($row['phone_normalized'] ?? $row['phone_cell'] ?? '');

        return [
            'pid' => $pid,
            'name' => trim($lname . ', ' . $fname, ' ,'),
            'sex' => (string) ($row['sex'] ?? ''),
            'mrn' => (string) ($row['pubpid'] ?? ''),
            'phone_masked' => $this->phoneNormalizer->mask($phone),
            'age_today' => $this->ageYears($row['DOB'] ?? null),
            'dob_estimated' => !empty($row['dob_estimated']),
            'completion_pct' => (int) ($row['completion_pct'] ?? 0),
            'last_visit_date' => $row['last_visit_date'] ?? null,
            'has_active_visit_today' => ((int) ($row['active_visit_today'] ?? 0)) > 0,
            'chart_url' => PatientCompletionService::chartUrl($pid, null),
        ];
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
}
