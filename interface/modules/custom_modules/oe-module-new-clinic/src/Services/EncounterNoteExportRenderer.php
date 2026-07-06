<?php

/**
 * V1.2-DOC-HLF-6 — native consult note PDF / custom_report rendering
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class EncounterNoteExportRenderer
{
    public function __construct(
        private readonly EncounterNoteService $encounterNote = new EncounterNoteService(),
    ) {
    }

    public function renderReport(int $pid, int $encounter, int $noteId): void
    {
        if ($noteId <= 0 || $pid <= 0 || $encounter <= 0) {
            echo '<p class="text">' . xlt('Consult note not found') . '</p>';

            return;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id, visit_id, encounter, pid, variant, payload, updated_at
             FROM nc_encounter_note
             WHERE id = ? AND pid = ? AND encounter = ?
             LIMIT 1',
            [$noteId, $pid, $encounter]
        );

        if (!is_array($row)) {
            echo '<p class="text">' . xlt('Consult note not found') . '</p>';

            return;
        }

        $variant = (string) ($row['variant'] ?? EncounterNoteService::DEFAULT_VARIANT);
        $sections = $this->encounterNote->decodeSectionsForExport($row['payload'] ?? null);
        $visible = $this->encounterNote->visibleSectionsForExport($variant);

        echo '<table class="table table-sm">';
        echo '<tr><td class="bold">' . xlt('Note type') . ':</td><td class="text">'
            . text($this->encounterNote->variantDisplayLabel($variant)) . '</td></tr>';
        if (!empty($row['updated_at'])) {
            echo '<tr><td class="bold">' . xlt('Last saved') . ':</td><td class="text">'
                . text(oeFormatDateTime((string) $row['updated_at'])) . '</td></tr>';
        }
        echo '</table>';

        if (in_array('referral', $visible, true)) {
            $this->renderReferralSection($sections['referral'] ?? []);
        }
        if (in_array('source', $visible, true)) {
            $this->renderSourceSection($sections['source'] ?? []);
        }
        if (in_array('cc', $visible, true)) {
            $this->renderFieldBlock(xl('Chief complaint'), (string) ($sections['cc']['chief_complaint'] ?? ''));
        }
        if (in_array('hpi', $visible, true)) {
            $this->renderHpiSection($sections['hpi'] ?? []);
        }
        if (in_array('ros', $visible, true)) {
            $this->renderRosSection($sections['ros'] ?? []);
        }
        if (in_array('pe', $visible, true)) {
            $this->renderPeSection($sections['pe'] ?? []);
        }
        if (in_array('data_reviewed', $visible, true)) {
            $this->renderDataReviewedSection($sections['data_reviewed'] ?? []);
        }
        if (in_array('problems', $visible, true)) {
            $this->renderProblemsSection($sections['problems'] ?? []);
        }
        if (in_array('attestation', $visible, true)) {
            $this->renderAttestationSection($sections['attestation'] ?? []);
        }
    }

    /**
     * @param array<string, mixed> $referral
     */
    private function renderReferralSection(array $referral): void
    {
        echo '<h5>' . xlt('Referral') . '</h5>';
        echo '<table class="table table-sm">';
        $this->renderTableRow(xl('Requesting clinician'), (string) ($referral['requesting_clinician'] ?? ''));
        $this->renderTableRow(xl('Requesting service'), (string) ($referral['requesting_service'] ?? ''));
        $this->renderTableRow(xl('Clinical question'), (string) ($referral['clinical_question'] ?? ''));
        $urgency = trim((string) ($referral['urgency'] ?? ''));
        if ($urgency !== '') {
            $this->renderTableRow(xl('Urgency'), ucfirst($urgency));
        }
        echo '</table>';
    }

    /**
     * @param array<string, mixed> $source
     */
    private function renderSourceSection(array $source): void
    {
        $sources = is_array($source['sources'] ?? null) ? $source['sources'] : [];
        $narrative = trim((string) ($source['narrative'] ?? ''));
        if ($sources === [] && $narrative === '') {
            return;
        }

        echo '<h5>' . xlt('Source of information') . '</h5>';
        echo '<table class="table table-sm">';
        if ($sources !== []) {
            $this->renderTableRow(xl('Sources'), implode(', ', array_map('strval', $sources)));
        }
        if ($narrative !== '') {
            $this->renderTableRow(xl('Notes'), $narrative);
        }
        echo '</table>';
    }

    /**
     * @param array<string, mixed> $hpi
     */
    private function renderHpiSection(array $hpi): void
    {
        echo '<h5>' . xlt('History of present illness') . '</h5>';
        echo '<table class="table table-sm">';
        $this->renderTableRow(xl('Narrative'), (string) ($hpi['narrative'] ?? ''));
        foreach ([
            'onset' => xl('Onset'),
            'duration' => xl('Duration'),
            'severity' => xl('Severity'),
            'aggravating' => xl('Aggravating factors'),
            'relieving' => xl('Relieving factors'),
        ] as $key => $label) {
            $value = trim((string) ($hpi[$key] ?? ''));
            if ($value !== '') {
                $this->renderTableRow($label, $value);
            }
        }
        echo '</table>';
    }

    /**
     * @param array<string, mixed> $ros
     */
    private function renderRosSection(array $ros): void
    {
        $systems = is_array($ros['systems'] ?? null) ? $ros['systems'] : [];
        $narrative = trim((string) ($ros['narrative'] ?? ''));
        if ($systems === [] && $narrative === '') {
            return;
        }

        echo '<h5>' . xlt('Review of systems') . '</h5>';
        echo '<table class="table table-sm">';
        foreach ($systems as $system) {
            if (!is_array($system)) {
                continue;
            }
            $label = trim((string) ($system['system'] ?? ''));
            $status = trim((string) ($system['status'] ?? ''));
            $notes = trim((string) ($system['notes'] ?? ''));
            if ($label === '') {
                continue;
            }
            $value = $status !== '' ? ucfirst(str_replace('_', ' ', $status)) : '';
            if ($notes !== '') {
                $value = $value !== '' ? $value . ' — ' . $notes : $notes;
            }
            $this->renderTableRow($label, $value);
        }
        if ($narrative !== '') {
            $this->renderTableRow(xl('Additional ROS'), $narrative);
        }
        echo '</table>';
    }

    /**
     * @param array<string, mixed> $pe
     */
    private function renderPeSection(array $pe): void
    {
        $general = trim((string) ($pe['general'] ?? ''));
        $specialty = is_array($pe['specialty'] ?? null) ? $pe['specialty'] : [];
        if ($general === '' && $specialty === []) {
            return;
        }

        echo '<h5>' . xlt('Physical examination') . '</h5>';
        echo '<table class="table table-sm">';
        if ($general !== '') {
            $this->renderTableRow(xl('General'), $general);
        }
        foreach ($specialty as $key => $value) {
            $text = trim((string) $value);
            if ($text === '') {
                continue;
            }
            $this->renderTableRow(ucwords(str_replace('_', ' ', (string) $key)), $text);
        }
        echo '</table>';
    }

    /**
     * @param array<string, mixed> $dataReviewed
     */
    private function renderDataReviewedSection(array $dataReviewed): void
    {
        $imaging = trim((string) ($dataReviewed['imaging_narrative'] ?? ''));
        $outside = trim((string) ($dataReviewed['outside_records'] ?? ''));
        $narrative = trim((string) ($dataReviewed['narrative'] ?? ''));
        $labIds = is_array($dataReviewed['lab_ids'] ?? null) ? $dataReviewed['lab_ids'] : [];
        if ($imaging === '' && $outside === '' && $narrative === '' && $labIds === []) {
            return;
        }

        echo '<h5>' . xlt('Data reviewed') . '</h5>';
        echo '<table class="table table-sm">';
        if ($labIds !== []) {
            $this->renderTableRow(xl('Labs reviewed'), implode(', ', array_map('strval', $labIds)));
        }
        if ($imaging !== '') {
            $this->renderTableRow(xl('Imaging'), $imaging);
        }
        if ($outside !== '') {
            $this->renderTableRow(xl('Outside records'), $outside);
        }
        if ($narrative !== '') {
            $this->renderTableRow(xl('Notes'), $narrative);
        }
        echo '</table>';
    }

    /**
     * @param array<string, mixed> $problems
     */
    private function renderProblemsSection(array $problems): void
    {
        $items = is_array($problems['items'] ?? null) ? $problems['items'] : [];
        if ($items === []) {
            return;
        }

        echo '<h5>' . xlt('Assessment and plan') . '</h5>';
        $index = 1;
        foreach ($items as $problem) {
            if (!is_array($problem)) {
                continue;
            }
            $label = trim((string) ($problem['problem_label'] ?? ''));
            if ($label === '') {
                continue;
            }

            echo '<p class="bold">' . text($index . '. ' . $label) . '</p>';
            echo '<table class="table table-sm">';
            $icd = trim((string) ($problem['icd10_code'] ?? ''));
            if ($icd !== '') {
                $icdLabel = trim((string) ($problem['icd10_label'] ?? ''));
                $this->renderTableRow(xl('ICD-10'), $icd . ($icdLabel !== '' ? ' — ' . $icdLabel : ''));
            }
            $this->renderTableRow(xl('Assessment'), (string) ($problem['assessment_narrative'] ?? ''));
            $differential = trim((string) ($problem['differential'] ?? ''));
            if ($differential !== '') {
                $this->renderTableRow(xl('Differential'), $differential);
            }
            $planItems = is_array($problem['plan_items'] ?? null) ? $problem['plan_items'] : [];
            if ($planItems !== []) {
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
                    $planLines[] = $type !== '' ? ucfirst(str_replace('_', ' ', $type)) . ': ' . $text : $text;
                }
                if ($planLines !== []) {
                    $this->renderTableRow(xl('Plan'), implode("\n", $planLines));
                }
            }
            echo '</table>';
            $index++;
        }
    }

    /**
     * @param array<string, mixed> $attestation
     */
    private function renderAttestationSection(array $attestation): void
    {
        if (empty($attestation['supervisor_attested'])) {
            return;
        }

        echo '<h5>' . xlt('Supervisor attestation') . '</h5>';
        echo '<p class="text">' . xlt('Supervising provider attestation recorded') . '</p>';
    }

    private function renderFieldBlock(string $title, string $value): void
    {
        $value = trim($value);
        if ($value === '') {
            return;
        }

        echo '<h5>' . text($title) . '</h5>';
        echo '<p class="text">' . nl2br(text($value)) . '</p>';
    }

    private function renderTableRow(string $label, string $value): void
    {
        $value = trim($value);
        if ($value === '') {
            return;
        }

        echo '<tr><td class="bold">' . text($label) . ':</td><td class="text">' . nl2br(text($value)) . '</td></tr>';
    }
}
