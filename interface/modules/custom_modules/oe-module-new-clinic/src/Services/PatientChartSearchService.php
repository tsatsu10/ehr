<?php

/**
 * In-chart informational search (NG15 / V1.1-OPS)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PatientChartSearchService
{
    public const MIN_QUERY_LENGTH = 2;

    public const DEFAULT_LIMIT = 20;

    private const PER_SOURCE_LIMIT = 8;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function search(int $pid, string $query, int $limit = self::DEFAULT_LIMIT): array
    {
        $query = $this->normalizeQuery($query);
        $limit = min(max($limit, 1), self::DEFAULT_LIMIT);

        if (strlen($query) < self::MIN_QUERY_LENGTH) {
            return [
                'query' => $query,
                'items' => [],
                'truncated' => false,
                'min_query_length' => self::MIN_QUERY_LENGTH,
            ];
        }

        $this->facilityScope->assertPatientAccessible($pid);

        $like = '%' . $query . '%';
        $items = array_merge(
            $this->searchLists($pid, $like),
            $this->searchHistory($pid, $like),
            $this->searchPrescriptions($pid, $like),
            $this->searchImmunizations($pid, $like),
            $this->searchLabOrders($pid, $like),
            $this->searchEncounterForms($pid, $like),
            $this->searchMessages($pid, $like)
        );

        usort($items, static function (array $a, array $b): int {
            $titleCmp = strcasecmp((string) ($a['title'] ?? ''), (string) ($b['title'] ?? ''));
            if ($titleCmp !== 0) {
                return $titleCmp;
            }

            return strcasecmp((string) ($a['category'] ?? ''), (string) ($b['category'] ?? ''));
        });

        $truncated = count($items) > $limit;
        if ($truncated) {
            $items = array_slice($items, 0, $limit);
        }

        return [
            'query' => $query,
            'items' => $items,
            'truncated' => $truncated,
            'min_query_length' => self::MIN_QUERY_LENGTH,
        ];
    }

    private function normalizeQuery(string $query): string
    {
        $query = trim(preg_replace('/\s+/u', ' ', $query) ?? '');

        return mb_strlen($query) > 80 ? mb_substr($query, 0, 80) : $query;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchLists(int $pid, string $like): array
    {
        $typeMap = [
            'allergy' => ['category' => 'Allergies', 'anchor' => 'clinical-allergies'],
            'medical_problem' => ['category' => 'Problems', 'anchor' => 'clinical-problems'],
            'medication' => ['category' => 'Medications', 'anchor' => 'clinical-meds'],
        ];

        $items = [];
        foreach ($typeMap as $type => $meta) {
            $rows = QueryUtils::fetchRecords(
                "SELECT id, title, reaction, diagnosis, comments, begdate
                 FROM lists
                 WHERE pid = ? AND type = ? AND activity = 1
                   AND (title LIKE ? OR reaction LIKE ? OR diagnosis LIKE ? OR comments LIKE ?)
                 ORDER BY begdate DESC, id DESC
                 LIMIT " . self::PER_SOURCE_LIMIT,
                [$pid, $type, $like, $like, $like, $like]
            ) ?: [];

            foreach ($rows as $row) {
                $title = trim((string) ($row['title'] ?? ''));
                if ($title === '') {
                    continue;
                }

                $items[] = $this->makeResult(
                    (int) ($row['id'] ?? 0),
                    $meta['category'],
                    $title,
                    $this->joinDetail([
                        $this->formatDate($row['begdate'] ?? null),
                        $row['reaction'] ?? null,
                        $row['diagnosis'] ?? null,
                        $row['comments'] ?? null,
                    ]),
                    'clinical',
                    $meta['anchor']
                );
            }
        }

        return $items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchHistory(int $pid, string $like): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT tobacco, alcohol, recreational_drugs, exercise_patterns,
                    history_mother, history_father, history_siblings,
                    relatives_diabetes, relatives_high_blood_pressure, additional_history, date
             FROM history_data
             WHERE pid = ?
               AND (
                    tobacco LIKE ? OR alcohol LIKE ? OR recreational_drugs LIKE ?
                    OR exercise_patterns LIKE ? OR history_mother LIKE ? OR history_father LIKE ?
                    OR history_siblings LIKE ? OR relatives_diabetes LIKE ?
                    OR relatives_high_blood_pressure LIKE ? OR additional_history LIKE ?
               )
             ORDER BY id DESC
             LIMIT 1",
            [
                $pid,
                $like,
                $like,
                $like,
                $like,
                $like,
                $like,
                $like,
                $like,
                $like,
                $like,
            ]
        );

        if (!is_array($row)) {
            return [];
        }

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

        $items = [];
        foreach ($fieldLabels as $field => $label) {
            $value = trim((string) ($row[$field] ?? ''));
            if ($value === '' || stripos($value, trim($like, '%')) === false) {
                continue;
            }

            $items[] = $this->makeResult(
                0,
                'Background',
                $label,
                $this->clipText($value, 120),
                'clinical',
                'clinical-background'
            );
        }

        if ($items !== [] && !empty($row['date'])) {
            $items[0]['detail'] = $this->joinDetail([
                $items[0]['detail'] ?? null,
                $this->formatDate((string) $row['date']),
            ]);
        }

        return array_slice($items, 0, self::PER_SOURCE_LIMIT);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchPrescriptions(int $pid, string $like): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, drug, dosage, quantity, note, start_date, filled_date
             FROM prescriptions
             WHERE patient_id = ? AND active = 1
               AND (drug LIKE ? OR dosage LIKE ? OR note LIKE ?)
             ORDER BY COALESCE(NULLIF(filled_date, '0000-00-00'), start_date) DESC, id DESC
             LIMIT " . self::PER_SOURCE_LIMIT,
            [$pid, $like, $like, $like]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['drug'] ?? ''));
            if ($title === '') {
                continue;
            }

            $items[] = $this->makeResult(
                (int) ($row['id'] ?? 0),
                'Prescriptions',
                $title,
                $this->joinDetail([
                    $row['dosage'] ?? null,
                    $row['quantity'] ?? null,
                    $this->formatDate((string) ($row['filled_date'] ?? $row['start_date'] ?? '')),
                    $row['note'] ?? null,
                ]),
                'clinical',
                'clinical-meds'
            );
        }

        return $items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchImmunizations(int $pid, string $like): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT i.id, i.note, i.administered_date, i.lot_number, c.code_text_short AS cvx_text
             FROM immunizations i
             LEFT JOIN code_types ct ON ct.ct_key = 'CVX'
             LEFT JOIN codes c ON c.code_type = ct.ct_id AND i.cvx_code = c.code
             WHERE i.patient_id = ? AND i.added_erroneously = 0
               AND (i.note LIKE ? OR c.code_text_short LIKE ? OR i.lot_number LIKE ?)
             ORDER BY i.administered_date DESC, i.id DESC
             LIMIT " . self::PER_SOURCE_LIMIT,
            [$pid, $like, $like, $like]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['cvx_text'] ?? ''));
            if ($title === '') {
                $title = trim((string) ($row['note'] ?? ''));
            }
            if ($title === '') {
                $title = 'Immunization';
            }

            $items[] = $this->makeResult(
                (int) ($row['id'] ?? 0),
                'Immunizations',
                $title,
                $this->joinDetail([
                    $this->formatDate((string) ($row['administered_date'] ?? '')),
                    $row['lot_number'] ?? null,
                    $row['note'] ?? null,
                ]),
                'clinical',
                'clinical-immunizations'
            );
        }

        return $items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchLabOrders(int $pid, string $like): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT po.procedure_order_id, po.date_ordered, po.order_status,
                    poc.procedure_name, poc.procedure_code
             FROM procedure_order po
             LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id
             WHERE po.patient_id = ? AND po.activity = 1
               AND (poc.procedure_name LIKE ? OR poc.procedure_code LIKE ?)
             ORDER BY po.date_ordered DESC, po.procedure_order_id DESC
             LIMIT " . self::PER_SOURCE_LIMIT,
            [$pid, $like, $like]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['procedure_name'] ?? ''));
            if ($title === '' && !empty($row['procedure_code'])) {
                $title = (string) $row['procedure_code'];
            }
            if ($title === '') {
                continue;
            }

            $items[] = $this->makeResult(
                (int) ($row['procedure_order_id'] ?? 0),
                'Labs',
                $title,
                $this->joinDetail([
                    $this->formatDate((string) ($row['date_ordered'] ?? '')),
                    $row['order_status'] ?? null,
                ]),
                'clinical',
                'clinical-labs'
            );
        }

        return $items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchEncounterForms(int $pid, string $like): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT f.id, f.form_name, f.formdir, f.date, f.encounter
             FROM forms f
             WHERE f.pid = ? AND f.deleted = 0
               AND (f.form_name LIKE ? OR f.formdir LIKE ?)
             ORDER BY f.date DESC, f.id DESC
             LIMIT " . self::PER_SOURCE_LIMIT,
            [$pid, $like, $like]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $formdir = trim((string) ($row['formdir'] ?? ''));
            $title = trim((string) ($row['form_name'] ?? ''));
            if ($formdir === 'newpatient') {
                $title = 'Visit Summary';
            } elseif ($title === '') {
                $title = $formdir !== '' ? $formdir : 'Encounter form';
            }

            $items[] = $this->makeResult(
                (int) ($row['id'] ?? 0),
                'Encounter forms',
                $title,
                $this->joinDetail([
                    $this->formatDateTime((string) ($row['date'] ?? '')),
                    $formdir !== '' ? $formdir : null,
                ]),
                'clinical',
                'clinical-encounter-forms'
            );
        }

        return $items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function searchMessages(int $pid, string $like): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, title, body, date, user
             FROM pnotes
             WHERE pid = ? AND deleted != 1
               AND (title LIKE ? OR body LIKE ?)
             ORDER BY date DESC, id DESC
             LIMIT " . self::PER_SOURCE_LIMIT,
            [$pid, $like, $like]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $title = trim((string) ($row['title'] ?? '')) ?: 'Message';
            $items[] = $this->makeResult(
                (int) ($row['id'] ?? 0),
                'Messages',
                $title,
                $this->joinDetail([
                    $this->clipText(trim((string) ($row['body'] ?? '')), 120),
                    trim((string) ($row['user'] ?? '')),
                    $this->formatDateTime((string) ($row['date'] ?? '')),
                ]),
                'messages',
                null
            );
        }

        return $items;
    }

    /**
     * @return array<string, mixed>
     */
    private function makeResult(
        int $id,
        string $category,
        string $title,
        ?string $detail,
        string $tab,
        ?string $anchor
    ): array {
        $result = [
            'id' => $id > 0 ? $id : null,
            'category' => $category,
            'title' => $title,
            'detail' => $detail,
            'tab' => $tab,
        ];

        if ($anchor !== null && $anchor !== '') {
            $result['anchor'] = $anchor;
        }

        return $result;
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

    private function formatDate(string $date): ?string
    {
        if ($date === '' || $date === '0000-00-00' || str_starts_with($date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }

    private function formatDateTime(string $date): ?string
    {
        if ($date === '' || str_starts_with($date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y g:i A');
        } catch (\Exception) {
            return null;
        }
    }
}
