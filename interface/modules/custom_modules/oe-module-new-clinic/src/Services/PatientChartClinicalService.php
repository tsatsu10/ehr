<?php

/**
 * Patient chart Clinical tab read models (B7 / T1-F16)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class PatientChartClinicalService
{
    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly VitalsPreviewBuilder $vitalsPreview = new VitalsPreviewBuilder(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly ProcedureOrderDeepLinkService $procedureOrderLinks = new ProcedureOrderDeepLinkService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicalDocHubLinkService $docHubLinks = new ClinicalDocHubLinkService(),
        private readonly HistoryEditorWrapService $historyEditorWrap = new HistoryEditorWrapService(),
        private readonly EncounterNoteService $encounterNote = new EncounterNoteService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getClinicalPayload(int $pid): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $encounterId = $this->visitScope->resolveActiveEncounterId($pid);
        $webroot = $GLOBALS['webroot'] ?? '';
        $facilityId = $this->resolveEncounterFacilityId($pid, $encounterId);

        return [
            'active_encounter_id' => $encounterId > 0 ? $encounterId : null,
            'background' => $this->buildBackgroundSection($pid, $webroot),
            'problems' => $this->buildListSection($pid, 'medical_problem', $webroot, 'clinical-problems'),
            'allergies' => $this->buildAllergySection($pid, $webroot),
            'medications' => $this->buildListSection($pid, 'medication', $webroot, 'clinical-meds'),
            'immunizations' => $this->buildImmunizationsSection($pid, $webroot),
            'labs' => $this->buildLabsSection($pid, $webroot, $encounterId),
            'vitals' => $this->buildVitalsSection($pid, $encounterId),
            'this_visit' => $this->buildThisVisitSection($pid, $encounterId, $webroot, $facilityId),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildBackgroundSection(int $pid, string $webroot): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT tobacco, alcohol, recreational_drugs, exercise_patterns,
                    history_mother, history_father, history_siblings,
                    relatives_diabetes, relatives_high_blood_pressure,
                    additional_history, date
             FROM history_data WHERE pid = ? ORDER BY id DESC LIMIT 1",
            [$pid]
        );

        $lines = [];
        if (is_array($row)) {
            $fieldLabels = [
                'history_mother' => 'Mother',
                'history_father' => 'Father',
                'history_siblings' => 'Siblings',
                'tobacco' => 'Tobacco',
                'alcohol' => 'Alcohol',
                'recreational_drugs' => 'Substance use',
                'exercise_patterns' => 'Exercise',
                'relatives_diabetes' => 'Family — diabetes',
                'relatives_high_blood_pressure' => 'Family — hypertension',
                'additional_history' => 'General history',
            ];
            foreach ($fieldLabels as $field => $label) {
                $value = trim((string) ($row[$field] ?? ''));
                if ($value !== '') {
                    $lines[] = [
                        'label' => $label,
                        'value' => $this->clipText($value, 200),
                    ];
                }
            }
        }

        $sdoh = $this->buildSdohChips($pid);

        return [
            'anchor' => 'clinical-background',
            'lines' => $lines,
            'empty' => $lines === [] && $sdoh['chips'] === [],
            'sdoh_chips' => $sdoh['chips'],
            'sdoh_more' => $sdoh['more'],
            'editor_url' => $this->historyEditorWrap->appendReturnParam(
                $webroot
                . '/interface/patient_file/history/history_full.php?set_pid='
                . urlencode((string) $pid),
                $pid
            ),
            'last_updated' => is_array($row) ? ($row['date'] ?? null) : null,
        ];
    }

    /**
     * T1-F20 — SDOH summary chips on Background (max 4 + "+N") from the
     * latest screening row. Empty when the SDOH feature is unused.
     *
     * @return array{chips: array<int, string>, more: int}
     */
    private function buildSdohChips(int $pid): array
    {
        try {
            $row = QueryUtils::querySingleRow(
                'SELECT food_insecurity, housing_instability, transportation_insecurity,
                        utilities_insecurity, interpersonal_safety, financial_strain,
                        social_isolation
                 FROM form_history_sdoh WHERE pid = ?
                 ORDER BY assessment_date DESC, id DESC LIMIT 1',
                [$pid]
            );
        } catch (\Throwable) {
            // Table absent on installs without the SDOH feature.
            return ['chips' => [], 'more' => 0];
        }

        if (!is_array($row)) {
            return ['chips' => [], 'more' => 0];
        }

        $domainLabels = [
            'food_insecurity' => 'Food',
            'housing_instability' => 'Housing',
            'transportation_insecurity' => 'Transport',
            'utilities_insecurity' => 'Utilities',
            'interpersonal_safety' => 'Safety',
            'financial_strain' => 'Finances',
            'social_isolation' => 'Social',
        ];

        $chips = [];
        foreach ($domainLabels as $field => $label) {
            $value = trim((string) ($row[$field] ?? ''));
            if ($value === '') {
                continue;
            }
            $chips[] = $label . ': ' . ucfirst(str_replace('_', ' ', $value));
        }

        $more = max(0, count($chips) - 4);

        return ['chips' => array_slice($chips, 0, 4), 'more' => $more];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildAllergySection(int $pid, string $webroot): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, title, reaction, verification, comments
             FROM lists WHERE pid = ? AND type = 'allergy' AND activity = 1
             ORDER BY id DESC LIMIT 25",
            [$pid]
        ) ?: [];

        $items = [];
        $noneKnown = false;
        foreach ($rows as $row) {
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            if (PatientCompletionService::isNkdaOnlyTitle($title)) {
                $noneKnown = true;
                continue;
            }
            $items[] = [
                'id' => (int) ($row['id'] ?? 0),
                'title' => $title,
                'detail' => $this->joinDetail([
                    $row['reaction'] ?? null,
                    $row['verification'] ?? null,
                    $row['comments'] ?? null,
                ]),
            ];
        }

        $undocumented = !$this->completionService->hasAllergyDocumentationForPatient($pid);

        return [
            'anchor' => 'clinical-allergies',
            'items' => $items,
            'none_known' => $noneKnown && $items === [],
            'undocumented' => $undocumented,
            'empty' => $items === [] && !$noneKnown && $undocumented,
            'editor_url' => $webroot
                . '/interface/patient_file/summary/add_edit_issue.php?issue=0&type=allergy&set_pid='
                . urlencode((string) $pid),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildListSection(int $pid, string $type, string $webroot, string $anchor): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, title, begdate, enddate, diagnosis, comments
             FROM lists WHERE pid = ? AND type = ? AND activity = 1
             ORDER BY begdate DESC, id DESC LIMIT 25",
            [$pid, $type]
        ) ?: [];

        $items = array_values(array_filter(array_map(function (array $row): ?array {
            $title = trim((string) ($row['title'] ?? ''));
            if ($title === '') {
                return null;
            }

            return [
                'id' => (int) ($row['id'] ?? 0),
                'title' => $title,
                'detail' => $this->joinDetail([
                    $this->formatListDate($row['begdate'] ?? null),
                    $row['diagnosis'] ?? null,
                    $row['comments'] ?? null,
                ]),
            ];
        }, $rows)));

        return [
            'anchor' => $anchor,
            'items' => $items,
            'empty' => $items === [],
            'editor_url' => $webroot
                . '/interface/patient_file/summary/add_edit_issue.php?issue=0&type='
                . urlencode($type)
                . '&set_pid='
                . urlencode((string) $pid),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildImmunizationsSection(int $pid, string $webroot): array
    {
        if (!$this->immunizationsEnabled()) {
            return [
                'anchor' => 'clinical-immunizations',
                'hidden' => true,
                'items' => [],
                'empty' => true,
                'editor_url' => null,
            ];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT i.id, i.immunization_id, i.cvx_code, i.administered_date, i.note, i.lot_number,
                    c.code_text_short AS cvx_text
             FROM immunizations i
             LEFT JOIN code_types ct ON ct.ct_key = 'CVX'
             LEFT JOIN codes c ON c.code_type = ct.ct_id AND i.cvx_code = c.code
             WHERE i.patient_id = ? AND i.added_erroneously = 0
             ORDER BY i.administered_date DESC, i.id DESC
             LIMIT 25",
            [$pid]
        ) ?: [];

        $useCustomList = !empty($GLOBALS['use_custom_immun_list']);
        $customTitles = $this->batchImmunizationListTitles($rows);

        $items = [];
        foreach ($rows as $row) {
            $title = $this->resolveImmunizationTitle($row, $useCustomList, $customTitles);
            if ($title === '') {
                continue;
            }

            $items[] = [
                'id' => (int) ($row['id'] ?? 0),
                'title' => $title,
                'detail' => $this->joinDetail([
                    $this->formatListDate($row['administered_date'] ?? null),
                    !empty($row['lot_number']) ? 'Lot ' . trim((string) $row['lot_number']) : null,
                ]),
            ];
        }

        return [
            'anchor' => 'clinical-immunizations',
            'hidden' => false,
            'items' => $items,
            'empty' => $items === [],
            'editor_url' => $webroot
                . '/interface/patient_file/summary/immunizations.php?set_pid='
                . urlencode((string) $pid),
        ];
    }

    private function immunizationsEnabled(): bool
    {
        return empty($GLOBALS['disable_immunizations']) && empty($GLOBALS['weight_loss_clinic']);
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, string> $customTitles
     */
    private function resolveImmunizationTitle(array $row, bool $useCustomList, array $customTitles): string
    {
        $immunizationId = trim((string) ($row['immunization_id'] ?? ''));
        if ($useCustomList && $immunizationId !== '') {
            $custom = trim((string) ($customTitles[$immunizationId] ?? ''));
            if ($custom !== '') {
                return $custom;
            }
        }

        $cvxText = trim((string) ($row['cvx_text'] ?? ''));
        if ($cvxText !== '') {
            return $cvxText;
        }

        $note = trim((string) ($row['note'] ?? ''));
        if ($note !== '') {
            return $this->clipText($note, 80);
        }

        if ($immunizationId !== '') {
            return trim((string) ($customTitles[$immunizationId] ?? '')) ?: $immunizationId;
        }

        $cvxCode = trim((string) ($row['cvx_code'] ?? ''));

        return $cvxCode !== '' ? 'CVX ' . $cvxCode : '';
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, string>
     */
    private function batchImmunizationListTitles(array $rows): array
    {
        $optionIds = array_values(array_unique(array_filter(array_map(
            static fn (array $row): string => trim((string) ($row['immunization_id'] ?? '')),
            $rows
        ), static fn (string $id): bool => $id !== '')));

        if ($optionIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($optionIds), '?'));
        $listRows = QueryUtils::fetchRecords(
            "SELECT option_id, title FROM list_options
             WHERE list_id = 'immunizations' AND option_id IN ($placeholders)",
            $optionIds
        ) ?: [];

        $titles = [];
        foreach ($listRows as $listRow) {
            $optionId = trim((string) ($listRow['option_id'] ?? ''));
            $title = trim((string) ($listRow['title'] ?? ''));
            if ($optionId !== '' && $title !== '') {
                $titles[$optionId] = $title;
            }
        }

        return $titles;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildLabsSection(int $pid, string $webroot, int $encounterId = 0): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT po.procedure_order_id, po.date_ordered, po.order_status,
                    poc.procedure_name, poc.procedure_code, poc.procedure_order_seq
             FROM procedure_order po
             LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id
             WHERE po.patient_id = ? AND po.activity = 1
             ORDER BY po.date_ordered DESC, po.procedure_order_id DESC, poc.procedure_order_seq ASC
             LIMIT 40",
            [$pid]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $orderId = (int) ($row['procedure_order_id'] ?? 0);
            $label = trim((string) ($row['procedure_name'] ?? ''));
            if ($label === '' && !empty($row['procedure_code'])) {
                $label = (string) $row['procedure_code'];
            }
            if ($label === '') {
                $label = 'Lab order #' . $orderId;
            }
            $items[] = [
                'id' => $orderId,
                'title' => $label,
                'detail' => $this->joinDetail([
                    $this->formatListDate($row['date_ordered'] ?? null),
                    $row['order_status'] ?? null,
                ]),
            ];
        }

        $items = array_slice($items, 0, 20);

        $placeOrderUrl = null;
        if ($encounterId > 0) {
            try {
                $placeOrderUrl = $this->procedureOrderLinks->buildNewOrderUrl(
                    $pid,
                    $encounterId,
                    $this->procedureOrderLinks->buildPatientChartReturnUrl($pid)
                );
            } catch (\InvalidArgumentException) {
                $placeOrderUrl = null;
            }
        }

        return [
            'anchor' => 'clinical-labs',
            'items' => $items,
            'empty' => $items === [],
            'encounter_id' => $encounterId > 0 ? $encounterId : null,
            'editor_url' => $placeOrderUrl,
            'place_order_url' => $placeOrderUrl,
            'pending_orders_url' => $this->procedureOrderLinks->buildPendingOrdersUrl($pid),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildThisVisitSection(int $pid, int $encounterId, string $webroot, int $facilityId = 0): array
    {
        if ($encounterId <= 0) {
            return [
                'anchor' => 'clinical-encounter-forms',
                'hidden' => true,
                'encounter_id' => null,
                'open_encounter_url' => null,
                'forms' => [],
                'empty' => true,
            ];
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT id, form_id, form_name, formdir, date, user
             FROM forms
             WHERE encounter = ? AND pid = ? AND deleted = 0
             ORDER BY FIND_IN_SET(formdir, 'vitals') DESC, form_name ASC, date DESC",
            [$encounterId, $pid]
        ) ?: [];

        $formIds = array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows);
        $signedMap = $this->batchFormSignedMap($formIds);

        $forms = [];
        foreach ($rows as $row) {
            $formdir = trim((string) ($row['formdir'] ?? ''));
            $formTableId = (int) ($row['form_id'] ?? 0);
            if ($formdir === '' || $formTableId <= 0) {
                continue;
            }

            $title = trim((string) ($row['form_name'] ?? ''));
            if ($formdir === 'newpatient') {
                $title = 'Visit Summary';
            } elseif ($title === '') {
                $title = $formdir;
            }

            $forms[] = [
                'id' => (int) ($row['id'] ?? 0),
                'title' => $title,
                'author' => trim((string) ($row['user'] ?? '')),
                'date' => $this->formatFormDate($row['date'] ?? null),
                'signed' => !empty($signedMap[(int) ($row['id'] ?? 0)]),
                'form_url' => $webroot
                    . '/interface/patient_file/encounter/view_form.php?id='
                    . urlencode((string) $formTableId)
                    . '&formname='
                    . urlencode($formdir),
            ];
        }

        $visitRow = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit
             WHERE pid = ? AND encounter = ?
             AND state NOT IN (\'completed\', \'closed_unpaid\', \'cancelled\')
             ORDER BY id DESC LIMIT 1',
            [$pid, $encounterId]
        );
        $visitId = is_array($visitRow) ? (int) ($visitRow['id'] ?? 0) : 0;
        $encounterNote = null;
        if ($visitId > 0) {
            $preview = $this->encounterNote->buildNotePreview($visitId, $facilityId);
            if (!empty($preview['native_enabled'])) {
                $encounterNote = $preview;
            }
        }

        return [
            'anchor' => 'clinical-encounter-forms',
            'hidden' => false,
            'encounter_id' => $encounterId,
            'visit_id' => $visitId > 0 ? $visitId : null,
            'open_encounter_url' => $this->docHubLinks->buildDocumentationUrl($pid, $encounterId, $facilityId),
            'encounter_note' => $encounterNote,
            'charges_total_label' => $this->buildChargesTotalLabel($pid, $encounterId, $visitId),
            'forms' => $forms,
            'empty' => $forms === [] && $encounterNote === null,
        ];
    }

    /**
     * D-FIN-8 — active-visit charge total for `new_chart_depth_finance_summary`.
     * Label only: no receipt #, no payment method, active visit required.
     */
    private function buildChargesTotalLabel(int $pid, int $encounterId, int $visitId): ?string
    {
        if ($visitId <= 0 || $encounterId <= 0) {
            return null;
        }

        if (
            !AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance_summary')
            && !AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance')
        ) {
            return null;
        }

        try {
            $summary = (new PaymentHistoryService())->getVisitChargesSummary($pid, $encounterId);
        } catch (\RuntimeException) {
            // Chart Depth finance flags are OFF — no charge summary on the chart.
            return null;
        }

        return 'Charges total: '
            . (string) ($summary['currency_symbol'] ?? '')
            . number_format((float) ($summary['charges_amount'] ?? 0), 2);
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

    /**
     * @return array<string, mixed>
     */
    private function buildVitalsSection(int $pid, int $encounterId): array
    {
        if ($encounterId <= 0) {
            return [
                'anchor' => 'clinical-vitals',
                'summary' => null,
                'abnormal' => false,
                'warnings' => [],
                'empty' => true,
            ];
        }

        $vitalsRows = $this->vitalsPreview->getEncounterVitals($pid, $encounterId);
        $warnings = $this->vitalsPreview->evaluateWarnings($vitalsRows);
        $merged = $this->vitalsPreview->mergeIntoPreview(
            ['vitals_today' => ['summary' => null]],
            $vitalsRows,
            $warnings,
            true
        );
        $vitals = $merged['vitals_today'] ?? [];

        return [
            'anchor' => 'clinical-vitals',
            'summary' => $vitals['summary'] ?? null,
            'pain_score' => $vitals['pain_score'] ?? null,
            'abnormal' => !empty($vitals['vitals_abnormal_today']),
            'warnings' => $vitals['vitals_breach_list'] ?? [],
            'empty' => empty($vitals['summary']),
            'encounter_id' => $encounterId,
        ];
    }

    /**
     * @param array<int, mixed> $parts
     */
    private function joinDetail(array $parts): ?string
    {
        $filtered = array_values(array_filter(array_map(
            static fn ($part) => trim((string) ($part ?? '')),
            $parts
        ), static fn (string $part): bool => $part !== ''));

        return $filtered === [] ? null : implode(' · ', $filtered);
    }

    private function clipText(string $value, int $max): string
    {
        if (strlen($value) <= $max) {
            return $value;
        }

        return substr($value, 0, $max - 1) . '…';
    }

    private function formatListDate(?string $date): ?string
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

    private function formatFormDate(?string $date): ?string
    {
        if (empty($date) || str_starts_with((string) $date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y g:i A');
        } catch (\Exception) {
            return null;
        }
    }

    private function resolveEncounterFacilityId(int $pid, int $encounterId): int
    {
        if ($encounterId <= 0) {
            return 0;
        }

        $visitRow = QueryUtils::querySingleRow(
            'SELECT facility_id FROM new_visit WHERE pid = ? AND encounter = ? ORDER BY id DESC LIMIT 1',
            [$pid, $encounterId]
        );
        if (is_array($visitRow)) {
            return (int) ($visitRow['facility_id'] ?? 0);
        }

        $encounterRow = QueryUtils::querySingleRow(
            'SELECT facility_id FROM form_encounter WHERE pid = ? AND encounter = ? LIMIT 1',
            [$pid, $encounterId]
        );

        return is_array($encounterRow) ? (int) ($encounterRow['facility_id'] ?? 0) : 0;
    }
}
