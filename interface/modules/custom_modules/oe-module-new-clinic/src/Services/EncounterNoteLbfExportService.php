<?php

/**
 * V1.2-DOC — optional on-save export of native consult note to LBF for stock reporting
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\FormService;

class EncounterNoteLbfExportService
{
    public const CONFIG_ON_SAVE = 'encounter_note_lbf_export_on_save';
    public const CONFIG_FORMDIR = 'encounter_note_lbf_export_formdir';

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
    ) {
    }

    public function isExportEnabled(int $facilityId): bool
    {
        return $this->config->getInt(self::CONFIG_ON_SAVE, 0, $facilityId) === 1;
    }

    public function resolveExportFormId(int $facilityId): ?string
    {
        $explicit = strtolower(trim((string) ($this->config->get(self::CONFIG_FORMDIR, '', $facilityId) ?? '')));
        if ($explicit !== '') {
            return $this->normalizeLbfFormId($explicit);
        }

        $bundle = strtolower(trim((string) ($this->config->get(
            'clinical_doc_bundle',
            ClinicalDocCatalogService::DEFAULT_BUNDLE_KEY,
            $facilityId
        ) ?? ClinicalDocCatalogService::DEFAULT_BUNDLE_KEY)));

        $formId = match ($bundle) {
            ClinicalDocCatalogService::REFERRAL_HOSPITAL_BUNDLE_KEY =>
                ClinicalDocReferralHospitalLbfWizardService::LBF_FORM_ID,
            default => ClinicalDocLbfWizardService::LBF_FORM_ID,
        };

        return $this->isLayoutInstalled($formId) ? $formId : null;
    }

    /**
     * @param array<string, mixed> $visit
     * @param array<string, mixed> $sections
     * @param array<string, mixed> $prefill
     * @return array<string, mixed>|null
     */
    public function syncFromSave(
        array $visit,
        array $sections,
        string $variant,
        array $prefill,
        int $actorUserId,
        int $nativeFormsRowId = 0
    ): ?array {
        if ($nativeFormsRowId > 0 && $this->isFormsRowSigned($nativeFormsRowId)) {
            return [
                'skipped' => true,
                'reason' => 'note_signed',
            ];
        }

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        if (!$this->isExportEnabled($facilityId)) {
            return null;
        }

        $encounter = (int) ($visit['encounter'] ?? 0);
        $pid = (int) ($visit['pid'] ?? 0);
        if ($encounter <= 0 || $pid <= 0) {
            return null;
        }

        $lbfFormId = $this->resolveExportFormId($facilityId);
        if ($lbfFormId === null || !$this->isLayoutInstalled($lbfFormId)) {
            return [
                'skipped' => true,
                'reason' => 'layout_not_installed',
            ];
        }

        $fieldMap = $this->buildFieldMap($lbfFormId, $sections, $prefill, $variant);
        if ($fieldMap === []) {
            return [
                'skipped' => true,
                'reason' => 'empty_payload',
            ];
        }

        $result = $this->upsertLbfForm($encounter, $pid, $lbfFormId, $fieldMap, $actorUserId);
        if (!empty($result['skipped_signed'])) {
            return [
                'skipped' => true,
                'reason' => 'lbf_signed',
            ];
        }

        return [
            'exported' => true,
            'lbf_form_id' => $lbfFormId,
            'forms_row_id' => $result['forms_row_id'],
            'created' => $result['created'],
            'field_count' => count($fieldMap),
        ];
    }

    /**
     * @param array<string, mixed> $sections
     * @param array<string, mixed> $prefill
     * @return array<string, string>
     */
    public function buildFieldMap(string $lbfFormId, array $sections, array $prefill, string $variant): array
    {
        return match ($lbfFormId) {
            ClinicalDocReferralHospitalLbfWizardService::LBF_FORM_ID =>
                $this->mapReferralHospitalFields($sections, $prefill),
            ClinicalDocLbfWizardService::LBF_FORM_ID =>
                $this->mapGhanaOpdFields($sections, $prefill),
            default => [],
        };
    }

    /**
     * @param array<string, mixed> $sections
     * @param array<string, mixed> $prefill
     * @return array<string, string>
     */
    private function mapReferralHospitalFields(array $sections, array $prefill): array
    {
        $referral = is_array($sections['referral'] ?? null) ? $sections['referral'] : [];
        $source = is_array($sections['source'] ?? null) ? $sections['source'] : [];
        $cc = is_array($sections['cc'] ?? null) ? $sections['cc'] : [];
        $hpi = is_array($sections['hpi'] ?? null) ? $sections['hpi'] : [];
        $ros = is_array($sections['ros'] ?? null) ? $sections['ros'] : [];
        $pe = is_array($sections['pe'] ?? null) ? $sections['pe'] : [];
        $dataReviewed = is_array($sections['data_reviewed'] ?? null) ? $sections['data_reviewed'] : [];
        $problems = is_array($sections['problems'] ?? null) ? $sections['problems'] : [];
        $followUp = is_array($sections['follow_up'] ?? null) ? $sections['follow_up'] : [];
        $attestation = is_array($sections['attestation'] ?? null) ? $sections['attestation'] : [];

        $problemsText = $this->formatProblemsAssessment($problems);
        $planText = $this->formatPlanItems($problems);
        $differential = $this->formatDifferentials($problems);

        return $this->filterEmptyFields([
            'requesting_clinician' => (string) ($referral['requesting_clinician'] ?? ''),
            'requesting_service' => (string) ($referral['requesting_service'] ?? ''),
            'clinical_question' => (string) ($referral['clinical_question'] ?? ''),
            'urgency' => (string) ($referral['urgency'] ?? ''),
            'source_of_information' => $this->formatSource($source),
            'chief_complaint' => (string) ($cc['chief_complaint'] ?? ''),
            'hpi_narrative' => (string) ($hpi['narrative'] ?? ''),
            'hpi_onset' => $this->formatHpiOnset($hpi),
            'ros_pertinent' => $this->formatRos($ros),
            'pe_general' => trim((string) ($pe['general'] ?? '')),
            'vitals_summary' => $this->formatVitalsSummary($prefill),
            'pe_specialty' => $this->formatSpecialtyPe($pe),
            'labs_reviewed' => $this->formatLabsReviewed($dataReviewed, $prefill),
            'imaging_reviewed' => $this->formatImagingReviewed($dataReviewed),
            'problems_assessment' => $problemsText,
            'differential' => $differential,
            'plan_items' => $planText,
            'follow_up_instructions' => $this->formatFollowUp($followUp),
            'attestation_note' => !empty($attestation['supervisor_attested'])
                ? 'Supervising provider attestation recorded'
                : '',
        ]);
    }

    /**
     * @param array<string, mixed> $sections
     * @param array<string, mixed> $prefill
     * @return array<string, string>
     */
    private function mapGhanaOpdFields(array $sections, array $prefill): array
    {
        $cc = is_array($sections['cc'] ?? null) ? $sections['cc'] : [];
        $hpi = is_array($sections['hpi'] ?? null) ? $sections['hpi'] : [];
        $pe = is_array($sections['pe'] ?? null) ? $sections['pe'] : [];
        $problems = is_array($sections['problems'] ?? null) ? $sections['problems'] : [];
        $followUp = is_array($sections['follow_up'] ?? null) ? $sections['follow_up'] : [];

        $assessment = $this->formatProblemsAssessment($problems);
        if ($assessment === '') {
            $assessment = trim((string) ($sections['assessment']['narrative'] ?? ''));
        }
        $plan = $this->formatPlanItems($problems);
        if ($plan === '') {
            $plan = trim((string) ($sections['plan']['narrative'] ?? ''));
        }

        return $this->filterEmptyFields([
            'presenting_complaint' => (string) ($cc['chief_complaint'] ?? ''),
            'history' => (string) ($hpi['narrative'] ?? ''),
            'past_history' => $this->formatBackground($prefill),
            'examination' => $this->formatGhanaExamination($pe, $prefill),
            'vitals_summary' => $this->formatVitalsSummary($prefill),
            'assessment' => $assessment,
            'plan' => $plan,
            'follow_up' => $this->formatFollowUp($followUp),
        ]);
    }

    /**
     * @param array<string, string> $fields
     * @return array<string, string>
     */
    private function filterEmptyFields(array $fields): array
    {
        $filtered = [];
        foreach ($fields as $fieldId => $value) {
            $value = trim($value);
            if ($value !== '') {
                $filtered[$fieldId] = $value;
            }
        }

        return $filtered;
    }

    /**
     * @param array<string, mixed> $source
     */
    private function formatSource(array $source): string
    {
        $sources = is_array($source['sources'] ?? null) ? $source['sources'] : [];
        $parts = [];
        if ($sources !== []) {
            $parts[] = implode(', ', array_map('strval', $sources));
        }
        $narrative = trim((string) ($source['narrative'] ?? ''));
        if ($narrative !== '') {
            $parts[] = $narrative;
        }

        return implode("\n", $parts);
    }

    /**
     * @param array<string, mixed> $hpi
     */
    private function formatHpiOnset(array $hpi): string
    {
        $parts = [];
        foreach (['onset' => 'Onset', 'duration' => 'Duration', 'severity' => 'Severity'] as $key => $label) {
            $value = trim((string) ($hpi[$key] ?? ''));
            if ($value !== '') {
                $parts[] = $label . ': ' . $value;
            }
        }

        return implode("\n", $parts);
    }

    /**
     * @param array<string, mixed> $ros
     */
    private function formatRos(array $ros): string
    {
        $lines = [];
        $systems = is_array($ros['systems'] ?? null) ? $ros['systems'] : [];
        foreach ($systems as $system) {
            if (!is_array($system)) {
                continue;
            }
            $label = trim((string) ($system['system'] ?? ''));
            if ($label === '') {
                continue;
            }
            $status = trim((string) ($system['status'] ?? ''));
            $notes = trim((string) ($system['notes'] ?? ''));
            $line = $label;
            if ($status !== '') {
                $line .= ': ' . ucfirst(str_replace('_', ' ', $status));
            }
            if ($notes !== '') {
                $line .= $status !== '' ? ' — ' . $notes : ': ' . $notes;
            }
            $lines[] = $line;
        }
        $narrative = trim((string) ($ros['narrative'] ?? ''));
        if ($narrative !== '') {
            $lines[] = 'Additional: ' . $narrative;
        }

        return implode("\n", $lines);
    }

    /**
     * @param array<string, mixed> $prefill
     */
    private function formatVitalsSummary(array $prefill): string
    {
        $vitals = is_array($prefill['vitals'] ?? null) ? $prefill['vitals'] : [];
        $summary = trim((string) ($vitals['summary'] ?? ''));
        if ($summary !== '') {
            return $summary;
        }

        $latest = is_array($vitals['latest'] ?? null) ? $vitals['latest'] : [];
        $parts = [];
        foreach ($latest as $key => $value) {
            $text = trim((string) $value);
            if ($text !== '') {
                $parts[] = ucwords(str_replace('_', ' ', (string) $key)) . ': ' . $text;
            }
        }

        return implode('; ', $parts);
    }

    /**
     * @param array<string, mixed> $pe
     */
    private function formatSpecialtyPe(array $pe): string
    {
        $specialty = is_array($pe['specialty'] ?? null) ? $pe['specialty'] : [];
        $lines = [];
        foreach ($specialty as $key => $value) {
            $text = trim((string) $value);
            if ($text === '') {
                continue;
            }
            $lines[] = ucwords(str_replace('_', ' ', (string) $key)) . ': ' . $text;
        }

        return implode("\n", $lines);
    }

    /**
     * @param array<string, mixed> $pe
     * @param array<string, mixed> $prefill
     */
    private function formatGhanaExamination(array $pe, array $prefill): string
    {
        $general = trim((string) ($pe['general'] ?? ''));
        $specialty = $this->formatSpecialtyPe($pe);
        $parts = array_filter([$general, $specialty]);

        return implode("\n\n", $parts);
    }

    /**
     * @param array<string, mixed> $dataReviewed
     * @param array<string, mixed> $prefill
     */
    private function formatLabsReviewed(array $dataReviewed, array $prefill): string
    {
        $labIds = is_array($dataReviewed['lab_ids'] ?? null) ? $dataReviewed['lab_ids'] : [];
        $parts = [];
        if ($labIds !== []) {
            $parts[] = 'Selected: ' . implode(', ', array_map('strval', $labIds));
        }
        $narrative = trim((string) ($dataReviewed['narrative'] ?? ''));
        if ($narrative !== '') {
            $parts[] = $narrative;
        }
        $outside = trim((string) ($dataReviewed['outside_records'] ?? ''));
        if ($outside !== '') {
            $parts[] = 'Outside records: ' . $outside;
        }

        return implode("\n", $parts);
    }

    /**
     * @param array<string, mixed> $dataReviewed
     */
    private function formatImagingReviewed(array $dataReviewed): string
    {
        return trim((string) ($dataReviewed['imaging_narrative'] ?? ''));
    }

    /**
     * @param array<string, mixed> $problems
     */
    private function formatProblemsAssessment(array $problems): string
    {
        $items = is_array($problems['items'] ?? null) ? $problems['items'] : [];
        $lines = [];
        $index = 1;
        foreach ($items as $problem) {
            if (!is_array($problem)) {
                continue;
            }
            $label = trim((string) ($problem['problem_label'] ?? ''));
            if ($label === '') {
                continue;
            }
            $entry = $index . '. ' . $label;
            $assessment = trim((string) ($problem['assessment_narrative'] ?? ''));
            if ($assessment !== '') {
                $entry .= "\nAssessment: " . $assessment;
            }
            $icd = trim((string) ($problem['icd10_code'] ?? ''));
            if ($icd !== '') {
                $icdLabel = trim((string) ($problem['icd10_label'] ?? ''));
                $entry .= "\nICD-10: " . $icd . ($icdLabel !== '' ? ' — ' . $icdLabel : '');
            }
            $lines[] = $entry;
            $index++;
        }

        return implode("\n\n", $lines);
    }

    /**
     * @param array<string, mixed> $problems
     */
    private function formatDifferentials(array $problems): string
    {
        $items = is_array($problems['items'] ?? null) ? $problems['items'] : [];
        $lines = [];
        foreach ($items as $problem) {
            if (!is_array($problem)) {
                continue;
            }
            $label = trim((string) ($problem['problem_label'] ?? ''));
            $differential = trim((string) ($problem['differential'] ?? ''));
            if ($label === '' || $differential === '') {
                continue;
            }
            $lines[] = $label . ': ' . $differential;
        }

        return implode("\n", $lines);
    }

    /**
     * @param array<string, mixed> $problems
     */
    private function formatPlanItems(array $problems): string
    {
        $items = is_array($problems['items'] ?? null) ? $problems['items'] : [];
        $lines = [];
        $problemIndex = 1;
        foreach ($items as $problem) {
            if (!is_array($problem)) {
                continue;
            }
            $label = trim((string) ($problem['problem_label'] ?? ''));
            $planItems = is_array($problem['plan_items'] ?? null) ? $problem['plan_items'] : [];
            if ($label === '' || $planItems === []) {
                $problemIndex++;
                continue;
            }
            $planLines = [];
            foreach ($planItems as $planItem) {
                if (!is_array($planItem)) {
                    continue;
                }
                $text = trim((string) ($planItem['text'] ?? ''));
                if ($text === '') {
                    continue;
                }
                $type = trim((string) ($planItem['type'] ?? ''));
                $planLines[] = $type !== ''
                    ? ucfirst(str_replace('_', ' ', $type)) . ': ' . $text
                    : $text;
            }
            if ($planLines !== []) {
                $lines[] = $problemIndex . '. ' . $label . "\n" . implode("\n", $planLines);
            }
            $problemIndex++;
        }

        return implode("\n\n", $lines);
    }

    /**
     * @param array<string, mixed> $followUp
     */
    private function formatFollowUp(array $followUp): string
    {
        $parts = [];
        foreach ([
            'return_visit' => 'Return visit',
            'callback_contact' => 'Who calls whom',
            'availability' => 'Availability for questions',
            'instructions' => 'Instructions',
        ] as $key => $label) {
            $value = trim((string) ($followUp[$key] ?? ''));
            if ($value !== '') {
                $parts[] = $label . ': ' . $value;
            }
        }

        return implode("\n", $parts);
    }

    /**
     * @param array<string, mixed> $prefill
     */
    private function formatBackground(array $prefill): string
    {
        $background = is_array($prefill['background'] ?? null) ? $prefill['background'] : [];
        $parts = [];
        foreach ([
            'pmh' => 'PMH',
            'medications' => 'Medications',
            'allergies' => 'Allergies',
            'social' => 'Social',
        ] as $key => $label) {
            $value = trim((string) ($background[$key] ?? ''));
            if ($value !== '') {
                $parts[] = $label . ': ' . $value;
            }
        }

        return implode("\n", $parts);
    }

    /**
     * @param array<string, string> $fieldValues
     * @return array{forms_row_id: int, created: bool}
     */
    private function upsertLbfForm(
        int $encounter,
        int $pid,
        string $lbfFormId,
        array $fieldValues,
        int $actorUserId
    ): array {
        $formdir = strtolower($this->catalog->resolveRegistryDirectory($lbfFormId));
        $existing = QueryUtils::querySingleRow(
            'SELECT f.id, f.form_id FROM forms f
             WHERE f.encounter = ? AND f.pid = ? AND f.deleted = 0 AND LOWER(f.formdir) = ?
             ORDER BY f.date DESC LIMIT 1',
            [$encounter, $pid, $formdir]
        );

        if (is_array($existing)) {
            $existingFormsRowId = (int) ($existing['id'] ?? 0);
            if ($this->isFormsRowSigned($existingFormsRowId)) {
                return [
                    'forms_row_id' => $existingFormsRowId,
                    'created' => false,
                    'skipped_signed' => true,
                ];
            }

            $lbfDataFormId = (int) ($existing['form_id'] ?? 0);
            $this->writeLbfData($lbfDataFormId, $fieldValues);
            QueryUtils::sqlStatementThrowException(
                'UPDATE forms SET date = NOW(), user = ? WHERE id = ? AND deleted = 0',
                [$_SESSION['authUser'] ?? 'system', (int) ($existing['id'] ?? 0)]
            );

            return [
                'forms_row_id' => (int) ($existing['id'] ?? 0),
                'created' => false,
            ];
        }

        $lbfDataFormId = (int) QueryUtils::sqlInsert(
            "INSERT INTO lbf_data (field_id, field_value) VALUES ('', '')"
        );
        QueryUtils::sqlStatementThrowException(
            "DELETE FROM lbf_data WHERE form_id = ? AND field_id = ''",
            [$lbfDataFormId]
        );
        $this->writeLbfData($lbfDataFormId, $fieldValues);

        $formsRowId = (int) (new FormService())->addForm(
            $encounter,
            $this->resolveFormTitle($lbfFormId),
            $lbfDataFormId,
            $formdir,
            $pid,
            '1'
        );

        return [
            'forms_row_id' => $formsRowId,
            'created' => true,
        ];
    }

    /**
     * @param array<string, string> $fieldValues
     */
    private function writeLbfData(int $lbfDataFormId, array $fieldValues): void
    {
        if ($lbfDataFormId <= 0) {
            return;
        }

        $existingRows = QueryUtils::fetchRecords(
            'SELECT field_id FROM lbf_data WHERE form_id = ?',
            [$lbfDataFormId]
        ) ?: [];
        $existingIds = array_map(
            static fn (array $row): string => (string) ($row['field_id'] ?? ''),
            $existingRows
        );

        foreach ($fieldValues as $fieldId => $value) {
            if ($fieldId === '') {
                continue;
            }
            QueryUtils::sqlStatementThrowException(
                'REPLACE INTO lbf_data SET field_value = ?, form_id = ?, field_id = ?',
                [$value, $lbfDataFormId, $fieldId]
            );
        }

        $removeIds = array_diff($existingIds, array_keys($fieldValues), ['']);
        foreach ($removeIds as $fieldId) {
            QueryUtils::sqlStatementThrowException(
                'DELETE FROM lbf_data WHERE form_id = ? AND field_id = ?',
                [$lbfDataFormId, $fieldId]
            );
        }
    }

    private function resolveFormTitle(string $lbfFormId): string
    {
        $row = QueryUtils::querySingleRow(
            "SELECT grp_title FROM layout_group_properties
             WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
            [$lbfFormId]
        );
        if (is_array($row)) {
            $title = trim((string) ($row['grp_title'] ?? ''));
            if ($title !== '') {
                return xl($title);
            }
        }

        return xl('Consult note export');
    }

    private function normalizeLbfFormId(string $formdir): string
    {
        $formdir = trim($formdir);
        if ($formdir === '') {
            return '';
        }

        if (stripos($formdir, 'lbf') === 0) {
            return $formdir;
        }

        return 'LBF' . $formdir;
    }

    private function isLayoutInstalled(string $lbfFormId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT grp_form_id FROM layout_group_properties
             WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
            [$lbfFormId]
        );

        return is_array($row);
    }

    private function isFormsRowSigned(int $formsRowId): bool
    {
        if ($formsRowId <= 0) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT id FROM esign_signatures
             WHERE tid = ? AND `table` = 'forms' AND is_lock = 1
             LIMIT 1",
            [$formsRowId]
        );

        return is_array($row);
    }
}
