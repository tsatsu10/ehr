<?php

/**
 * Chart Depth clinical export builder (M11-F05 / CDc)
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

class ClinicalExportService
{
    public const PRESET_VISIT_SUMMARY = 'visit_summary';
    public const PRESET_CLINICAL_SUMMARY = 'clinical_summary';
    public const PRESET_CUSTOM = 'custom';
    public const PRESET_FULL_CHART = 'full_chart';

    /** @var array<string, string> */
    private const PRESET_LABELS = [
        self::PRESET_VISIT_SUMMARY => 'Visit summary',
        self::PRESET_CLINICAL_SUMMARY => 'Clinical summary',
        self::PRESET_CUSTOM => 'Custom (stock report)',
        self::PRESET_FULL_CHART => 'Full chart',
    ];

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getBuilderPayload(int $pid, ?string $preset = null, ?int $encounterId = null): array
    {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertExportEnabled();

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $webroot = $GLOBALS['webroot'] ?? '';
        $patient = $this->fetchPatientBanner($pid);
        $encounters = $this->fetchEncounterOptions($pid);
        $canFull = $this->canExportFullChart();
        $presets = $this->availablePresets($canFull);
        $preset = $this->normalizePreset($preset, $presets);
        $encounterId = $this->resolveSelectedEncounterId($encounterId, $encounters);

        return [
            'patient' => $patient,
            'presets' => $presets,
            'selected_preset' => $preset,
            'encounters' => $encounters,
            'selected_encounter_id' => $encounterId,
            'include_options' => $this->defaultIncludeOptions($preset),
            'requires_encounter' => $preset === self::PRESET_VISIT_SUMMARY,
            'can_generate' => $this->canGenerate($preset, $encounterId),
            'can_export_full' => $canFull,
            'has_pat_rep_acl' => AclMain::aclCheckCore('patients', 'pat_rep'),
            'confirm_label' => $this->buildConfirmLabel($patient, $encounterId, $encounters),
            'stock_report_url' => $webroot
                . '/interface/patient_file/report/patient_report.php',
            'employer_letter_url' => $this->buildEmployerLetterUrl($webroot, $pid, $encounterId),
            'custom_report_url' => $webroot . '/interface/patient_file/report/custom_report.php',
        ];
    }

    /**
     * @param array<string, bool> $includeOptions
     * @return array<string, mixed>
     */
    public function preparePdfExport(
        int $pid,
        string $preset,
        ?int $encounterId,
        array $includeOptions,
        int $actorUserId
    ): array {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertExportEnabled();

        if (!AclMain::aclCheckCore('patients', 'pat_rep')) {
            throw new \RuntimeException('Core patient report permission is required to generate PDF', 403);
        }

        $canFull = $this->canExportFullChart();
        $preset = $this->normalizePreset($preset, $this->availablePresets($canFull));

        if ($preset === self::PRESET_CUSTOM) {
            throw new \InvalidArgumentException('Use stock patient report for custom exports');
        }

        if ($preset === self::PRESET_FULL_CHART && !$canFull) {
            throw new \RuntimeException('Full chart export requires admin permission', 403);
        }

        if ($preset === self::PRESET_VISIT_SUMMARY && ($encounterId === null || $encounterId <= 0)) {
            throw new \InvalidArgumentException('Encounter is required for visit summary export');
        }

        $fields = $this->buildCustomReportPostFields($pid, $preset, $encounterId, $includeOptions);
        $fields['pdf'] = '1';

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'chart_depth.export_generated',
            $actorUserId,
            1,
            'pid=' . $pid
            . ' preset=' . $preset
            . ' encounter_id=' . (int) ($encounterId ?? 0)
        );

        $webroot = $GLOBALS['webroot'] ?? '';

        return [
            'post_url' => $webroot . '/interface/patient_file/report/custom_report.php',
            'fields' => $fields,
            'preset' => $preset,
            'encounter_id' => $encounterId,
        ];
    }

    public function buildVisitExportUrl(int $pid, int $encounterId): ?string
    {
        if ($encounterId <= 0 || !$this->isExportFeatureEnabled()) {
            return null;
        }

        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/export.php?pid='
            . urlencode((string) $pid)
            . '&preset='
            . urlencode(self::PRESET_VISIT_SUMMARY)
            . '&encounter_id='
            . urlencode((string) $encounterId);
    }

    public function buildChartExportUrl(int $pid): ?string
    {
        if (!$this->isExportFeatureEnabled()) {
            return null;
        }

        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/export.php?pid='
            . urlencode((string) $pid);
    }

    public function isExportFeatureEnabled(): bool
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();

        return $this->config->getInt('enable_chart_depth', 0, $facilityId) === 1
            && $this->config->getInt('enable_chart_depth_export', 0, $facilityId) === 1;
    }

    private function assertExportEnabled(): void
    {
        if (!$this->isExportFeatureEnabled()) {
            throw new \RuntimeException('Chart depth export is not enabled', 403);
        }
    }

    private function canExportFullChart(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_chart_depth_export_full')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function availablePresets(bool $canFull): array
    {
        $keys = [
            self::PRESET_VISIT_SUMMARY,
            self::PRESET_CLINICAL_SUMMARY,
            self::PRESET_CUSTOM,
        ];
        if ($canFull) {
            $keys[] = self::PRESET_FULL_CHART;
        }

        $presets = [];
        foreach ($keys as $key) {
            $presets[] = [
                'key' => $key,
                'label' => self::PRESET_LABELS[$key] ?? $key,
            ];
        }

        return $presets;
    }

    /**
     * @param array<int, array<string, mixed>> $presets
     */
    private function normalizePreset(?string $preset, array $presets): string
    {
        $allowed = array_map(static fn (array $row): string => (string) ($row['key'] ?? ''), $presets);
        $preset = (string) ($preset ?? self::PRESET_VISIT_SUMMARY);

        return in_array($preset, $allowed, true) ? $preset : self::PRESET_VISIT_SUMMARY;
    }

    /**
     * @param array<int, array<string, mixed>> $encounters
     */
    private function resolveSelectedEncounterId(?int $encounterId, array $encounters): ?int
    {
        if ($encounterId !== null && $encounterId > 0) {
            return $encounterId;
        }

        return isset($encounters[0]['encounter_id']) ? (int) $encounters[0]['encounter_id'] : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchPatientBanner(int $pid): array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT pid, fname, lname, pubpid, DOB FROM patient_data WHERE pid = ?',
            [$pid]
        );

        if (!is_array($row)) {
            throw new \InvalidArgumentException('Patient not found');
        }

        $name = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));

        return [
            'pid' => $pid,
            'name' => $name !== '' ? $name : 'Patient',
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'dob' => $this->formatDate((string) ($row['DOB'] ?? '')),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchEncounterOptions(int $pid): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT v.encounter, v.visit_date, v.queue_number, vt.label AS visit_type_label,
                    fe.reason
             FROM new_visit v
             LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
             LEFT JOIN form_encounter fe ON fe.pid = v.pid AND fe.encounter = v.encounter
             WHERE v.pid = ? AND v.encounter > 0
             ORDER BY v.visit_date DESC, v.queue_number DESC, v.id DESC
             LIMIT 40",
            [$pid]
        ) ?: [];

        return array_map(function (array $row): array {
            $encounterId = (int) ($row['encounter'] ?? 0);
            $dateLabel = $this->formatDate((string) ($row['visit_date'] ?? '')) ?? '—';
            $queue = (int) ($row['queue_number'] ?? 0);
            $type = (string) ($row['visit_type_label'] ?? 'Visit');
            $reason = trim((string) ($row['reason'] ?? ''));

            $label = $dateLabel . ' · ' . $type;
            if ($queue > 0) {
                $label .= ' · #' . $queue;
            }
            if ($reason !== '') {
                $label .= ' · ' . $reason;
            }

            return [
                'encounter_id' => $encounterId,
                'visit_date' => (string) ($row['visit_date'] ?? ''),
                'queue_number' => $queue,
                'label' => $label,
            ];
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function defaultIncludeOptions(string $preset): array
    {
        $hideBilling = !empty($GLOBALS['simplified_demographics']);

        if ($preset === self::PRESET_CLINICAL_SUMMARY) {
            return [
                ['key' => 'problems', 'label' => 'Problems', 'checked' => true],
                ['key' => 'allergies', 'label' => 'Allergies', 'checked' => true],
                ['key' => 'medications', 'label' => 'Medications', 'checked' => true],
                ['key' => 'immunizations', 'label' => 'Immunizations', 'checked' => true],
                ['key' => 'history', 'label' => 'History', 'checked' => true],
            ];
        }

        if ($preset === self::PRESET_FULL_CHART) {
            return [
                ['key' => 'include_all', 'label' => 'All authorized sections', 'checked' => true],
            ];
        }

        return [
            ['key' => 'demographics', 'label' => 'Demographics', 'checked' => true],
            ['key' => 'vitals', 'label' => 'Vitals', 'checked' => true],
            ['key' => 'problems', 'label' => 'Problems', 'checked' => true],
            ['key' => 'allergies', 'label' => 'Allergies', 'checked' => true],
            ['key' => 'medications', 'label' => 'Medications', 'checked' => true],
            ['key' => 'signed_notes', 'label' => 'Signed encounter notes only', 'checked' => true],
            ['key' => 'history', 'label' => 'History', 'checked' => false],
            ['key' => 'insurance', 'label' => 'Insurance', 'checked' => false, 'hidden' => $hideBilling],
            ['key' => 'billing', 'label' => 'Billing', 'checked' => false, 'hidden' => $hideBilling],
        ];
    }

    private function canGenerate(string $preset, ?int $encounterId): bool
    {
        if ($preset === self::PRESET_CUSTOM) {
            return true;
        }

        if ($preset === self::PRESET_VISIT_SUMMARY) {
            return $encounterId !== null && $encounterId > 0;
        }

        return true;
    }

    /**
     * @param array<int, array<string, mixed>> $encounters
     */
    private function buildConfirmLabel(array $patient, ?int $encounterId, array $encounters): string
    {
        $parts = [
            $patient['name'] ?? 'Patient',
        ];
        if (!empty($patient['pubpid'])) {
            $parts[] = 'MRN ' . $patient['pubpid'];
        }

        foreach ($encounters as $encounter) {
            if ((int) ($encounter['encounter_id'] ?? 0) === (int) $encounterId) {
                $parts[] = 'Encounter ' . ($encounter['label'] ?? $encounterId);
                break;
            }
        }

        return implode(' · ', $parts);
    }

    private function buildEmployerLetterUrl(string $webroot, int $pid, ?int $encounterId): ?string
    {
        if (!AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral')
            && !AclMain::aclCheckCore('new_clinic', 'new_chart_depth_export')) {
            return null;
        }

        $url = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/referrals.php?pid='
            . urlencode((string) $pid);
        if ($encounterId !== null && $encounterId > 0) {
            $url .= '&encounter_id=' . urlencode((string) $encounterId);
        }

        return $url;
    }

    /**
     * @param array<string, bool> $includeOptions
     * @return array<string, string>
     */
    private function buildCustomReportPostFields(
        int $pid,
        string $preset,
        ?int $encounterId,
        array $includeOptions
    ): array {
        if ($preset === self::PRESET_FULL_CHART) {
            return $this->buildFullChartFields($pid);
        }

        $fields = [];
        $include = static fn (string $key): bool => !empty($includeOptions[$key]);

        if ($preset === self::PRESET_CLINICAL_SUMMARY) {
            if ($include('history')) {
                $fields['include_history'] = 'history';
            }
            if ($include('immunizations')) {
                $fields['include_immunizations'] = 'immunizations';
            }
            $this->appendIssueFields($fields, $pid, null, [
                'allergy',
                'medical_problem',
                'medication',
            ]);
            return $fields;
        }

        $fields['include_demographics'] = 'demographics';
        if ($include('history')) {
            $fields['include_history'] = 'history';
        }
        if ($include('insurance')) {
            $fields['include_insurance'] = 'insurance';
        }
        if ($include('billing')) {
            $fields['include_billing'] = 'billing';
        }

        $this->appendIssueFields($fields, $pid, $encounterId, [
            'allergy',
            'medical_problem',
            'medication',
        ]);

        if ($encounterId !== null && $encounterId > 0) {
            if ($include('vitals')) {
                $this->appendVitalsFormFields($fields, $pid, $encounterId);
            }
            $this->appendEncounterFormFields(
                $fields,
                $pid,
                $encounterId,
                $include('signed_notes'),
                ['vitals']
            );
        }

        return $fields;
    }

    /**
     * @return array<string, string>
     */
    private function buildFullChartFields(int $pid): array
    {
        $fields = [
            'include_demographics' => 'demographics',
            'include_history' => 'history',
            'include_immunizations' => 'immunizations',
            'include_notes' => 'notes',
            'include_transactions' => 'transactions',
            'include_batchcom' => 'batchcom',
            'include_recurring_days' => 'recurring_days',
        ];

        if (empty($GLOBALS['simplified_demographics'])) {
            $fields['include_insurance'] = 'insurance';
            $fields['include_billing'] = 'billing';
        }

        $this->appendIssueFields($fields, $pid, null, null);
        $this->appendEncounterFormFields($fields, $pid, null, false);

        return $fields;
    }

    /**
     * @param array<string, string> $fields
     * @param array<int, string>|null $types
     */
    private function appendIssueFields(array &$fields, int $pid, ?int $encounterId, ?array $types): void
    {
        $bind = [$pid];
        $typeFilter = '';
        if ($types !== null && $types !== []) {
            $placeholders = implode(',', array_fill(0, count($types), '?'));
            $typeFilter = " AND type IN ($placeholders)";
            $bind = array_merge($bind, $types);
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT id, type FROM lists WHERE pid = ? AND activity = 1{$typeFilter}",
            $bind
        ) ?: [];

        foreach ($rows as $row) {
            $issueId = (int) ($row['id'] ?? 0);
            if ($issueId <= 0) {
                continue;
            }

            $encounters = $this->fetchIssueEncounters($pid, $issueId);
            if ($encounterId !== null && $encounterId > 0) {
                if ($encounters !== [] && !in_array($encounterId, $encounters, true)) {
                    continue;
                }
                $encounters = [$encounterId];
            }

            $value = '/';
            foreach ($encounters as $enc) {
                $value .= $enc . '/';
            }

            $fields['issue_' . $issueId] = $value;
        }
    }

    /**
     * @return array<int, int>
     */
    private function fetchIssueEncounters(int $pid, int $issueId): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT encounter FROM issue_encounter WHERE pid = ? AND list_id = ?',
            [$pid, $issueId]
        ) ?: [];

        return array_values(array_filter(array_map(
            static fn (array $row): int => (int) ($row['encounter'] ?? 0),
            $rows
        ), static fn (int $enc): bool => $enc > 0));
    }

    /**
     * @param array<string, string> $fields
     * @param array<int, string> $excludeFormdirs
     */
    private function appendEncounterFormFields(
        array &$fields,
        int $pid,
        ?int $encounterId,
        bool $signedOnly,
        array $excludeFormdirs = []
    ): void {
        $bind = [$pid];
        $encounterFilter = '';
        if ($encounterId !== null && $encounterId > 0) {
            $encounterFilter = ' AND f.encounter = ?';
            $bind[] = $encounterId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT f.id, f.encounter, f.form_id, f.formdir
             FROM forms f
             WHERE f.pid = ? AND f.deleted = 0 AND f.formdir != 'newpatient'{$encounterFilter}
             ORDER BY f.encounter DESC, f.date DESC",
            $bind
        ) ?: [];

        $formIds = array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows);
        $signedMap = $this->batchFormSignedMap($formIds);

        foreach ($rows as $row) {
            $formRowId = (int) ($row['id'] ?? 0);
            $formTableId = (int) ($row['form_id'] ?? 0);
            $formdir = trim((string) ($row['formdir'] ?? ''));
            $enc = (int) ($row['encounter'] ?? 0);
            if ($formRowId <= 0 || $formTableId <= 0 || $formdir === '' || $enc <= 0) {
                continue;
            }
            if ($excludeFormdirs !== [] && in_array($formdir, $excludeFormdirs, true)) {
                continue;
            }
            if ($signedOnly && empty($signedMap[$formRowId])) {
                continue;
            }

            $fields[$formdir . '_' . $formTableId] = (string) $enc;
        }
    }

    /**
     * @param array<string, string> $fields
     */
    private function appendVitalsFormFields(array &$fields, int $pid, int $encounterId): void
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT f.form_id, f.formdir
             FROM forms f
             WHERE f.pid = ? AND f.encounter = ? AND f.deleted = 0 AND f.formdir = 'vitals'
             ORDER BY f.date DESC, f.id DESC",
            [$pid, $encounterId]
        ) ?: [];

        foreach ($rows as $row) {
            $formTableId = (int) ($row['form_id'] ?? 0);
            $formdir = trim((string) ($row['formdir'] ?? ''));
            if ($formTableId <= 0 || $formdir === '') {
                continue;
            }
            $fields[$formdir . '_' . $formTableId] = (string) $encounterId;
        }
    }

    /**
     * @param array<int, int> $formIds
     * @return array<int, bool>
     */
    private function batchFormSignedMap(array $formIds): array
    {
        $formIds = array_values(array_unique(array_filter(
            array_map('intval', $formIds),
            static fn (int $id): bool => $id > 0
        )));

        if ($formIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($formIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT tid AS form_row_id FROM esign_signatures
             WHERE `table` = 'forms' AND is_lock = 1 AND tid IN ($placeholders)",
            $formIds
        ) ?: [];

        $signed = [];
        foreach ($rows as $row) {
            $signed[(int) ($row['form_row_id'] ?? 0)] = true;
        }

        return $signed;
    }

    private function formatDate(string $date): ?string
    {
        if ($date === '' || str_starts_with($date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }
}
