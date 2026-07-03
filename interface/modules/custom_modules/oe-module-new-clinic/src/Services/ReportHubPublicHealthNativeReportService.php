<?php

/**
 * M16 native public health reports — OPD attendance + malaria surveillance (Ghana v1 MOH pack)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportHubPublicHealthNativeReportService
{
    public const KEY_OPD_ATTENDANCE = 'ph_opd_attendance';

    public const KEY_MALARIA_SURVEILLANCE = 'ph_malaria_surveillance';

    /** @var array<int, string> */
    public const PUBLIC_HEALTH_KEYS = [
        self::KEY_OPD_ATTENDANCE,
        self::KEY_MALARIA_SURVEILLANCE,
    ];

    /** @var list<string> */
    private const LAB_TEST_TERMS = ['malaria', 'rdt', 'mps', 'thick smear', 'thin smear'];

    /** @var list<string> */
    private const AGE_BANDS = ['<1', '1-4', '5-9', '10-14', '15-19', '20-49', '50+', 'Unknown'];

    /** @var list<string> */
    private const SEX_VALUES = ['Male', 'Female', 'Unknown'];

    /** @var list<string> */
    private const VISIT_CLASSES = ['New', 'Follow-up'];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isPublicHealthKey(string $reportKey): bool
    {
        return in_array($reportKey, self::PUBLIC_HEALTH_KEYS, true);
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    public function runReport(
        string $reportKey,
        ?string $dateFrom,
        ?string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
        if (!$this->isPublicHealthKey($reportKey)) {
            throw new \InvalidArgumentException('Unsupported public health native report');
        }

        [$dateFrom, $dateTo] = $this->requireDateRange($dateFrom, $dateTo);

        return match ($reportKey) {
            self::KEY_OPD_ATTENDANCE => $this->runOpdAttendance($dateFrom, $dateTo, $limit, $offset, $facilityId),
            self::KEY_MALARIA_SURVEILLANCE => $this->runMalariaSurveillance($dateFrom, $dateTo, $limit, $offset, $facilityId),
            default => throw new \InvalidArgumentException('Unsupported public health native report'),
        };
    }

    public function countRows(
        string $reportKey,
        ?string $dateFrom,
        ?string $dateTo,
        int $facilityId,
    ): int {
        if (!$this->isPublicHealthKey($reportKey)) {
            return 0;
        }

        [$dateFrom, $dateTo] = $this->requireDateRange($dateFrom, $dateTo);

        return match ($reportKey) {
            self::KEY_OPD_ATTENDANCE => count($this->fetchOpdSummaryRows($dateFrom, $dateTo, $facilityId)),
            self::KEY_MALARIA_SURVEILLANCE => count($this->fetchMalariaSummaryRows($dateFrom, $dateTo, $facilityId)),
            default => 0,
        };
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    private function runOpdAttendance(
        string $dateFrom,
        string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
        $columns = ['Age band', 'Sex', 'Visit class', 'Attendances'];
        $allRows = $this->fetchOpdSummaryRows($dateFrom, $dateTo, $facilityId);
        $total = count($allRows);

        return [
            'columns' => $columns,
            'rows' => array_slice($allRows, max(0, $offset), max(1, $limit)),
            'total' => $total,
        ];
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    private function runMalariaSurveillance(
        string $dateFrom,
        string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
        $columns = ['Indicator', 'Distinct patients'];
        $allRows = $this->fetchMalariaSummaryRows($dateFrom, $dateTo, $facilityId);
        $total = count($allRows);

        return [
            'columns' => $columns,
            'rows' => array_slice($allRows, max(0, $offset), max(1, $limit)),
            'total' => $total,
        ];
    }

    /**
     * @return list<list<string>>
     */
    private function fetchOpdSummaryRows(string $dateFrom, string $dateTo, int $facilityId): array
    {
        [$whereSql, $bind] = $this->visitWhere($dateFrom, $dateTo, $facilityId);
        $records = QueryUtils::fetchRecords(
            "SELECT
                CASE
                    WHEN pd.DOB IS NULL OR pd.DOB = '' OR pd.DOB = '0000-00-00' THEN 'Unknown'
                    WHEN TIMESTAMPDIFF(YEAR, pd.DOB, v.visit_date) < 1 THEN '<1'
                    WHEN TIMESTAMPDIFF(YEAR, pd.DOB, v.visit_date) BETWEEN 1 AND 4 THEN '1-4'
                    WHEN TIMESTAMPDIFF(YEAR, pd.DOB, v.visit_date) BETWEEN 5 AND 9 THEN '5-9'
                    WHEN TIMESTAMPDIFF(YEAR, pd.DOB, v.visit_date) BETWEEN 10 AND 14 THEN '10-14'
                    WHEN TIMESTAMPDIFF(YEAR, pd.DOB, v.visit_date) BETWEEN 15 AND 19 THEN '15-19'
                    WHEN TIMESTAMPDIFF(YEAR, pd.DOB, v.visit_date) BETWEEN 20 AND 49 THEN '20-49'
                    WHEN TIMESTAMPDIFF(YEAR, pd.DOB, v.visit_date) >= 50 THEN '50+'
                    ELSE 'Unknown'
                END AS age_band,
                CASE
                    WHEN pd.sex = 'Male' THEN 'Male'
                    WHEN pd.sex = 'Female' THEN 'Female'
                    ELSE 'Unknown'
                END AS sex,
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM new_visit v2
                        WHERE v2.pid = v.pid
                          AND v2.facility_id = v.facility_id
                          AND v2.state NOT IN ('cancelled')
                          AND (
                            v2.visit_date < v.visit_date
                            OR (v2.visit_date = v.visit_date AND v2.id < v.id)
                          )
                    ) THEN 'Follow-up'
                    ELSE 'New'
                END AS visit_class,
                COUNT(*) AS attendance_count
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             WHERE {$whereSql}
             GROUP BY age_band, sex, visit_class",
            $bind
        ) ?: [];

        $counts = [];
        foreach ($records as $record) {
            $key = implode('|', [
                (string) ($record['age_band'] ?? 'Unknown'),
                (string) ($record['sex'] ?? 'Unknown'),
                (string) ($record['visit_class'] ?? 'New'),
            ]);
            $counts[$key] = (int) ($record['attendance_count'] ?? 0);
        }

        $rows = [];
        foreach (self::AGE_BANDS as $ageBand) {
            foreach (self::SEX_VALUES as $sex) {
                foreach (self::VISIT_CLASSES as $visitClass) {
                    $key = $ageBand . '|' . $sex . '|' . $visitClass;
                    $count = $counts[$key] ?? 0;
                    if ($count <= 0) {
                        continue;
                    }
                    $rows[] = [$ageBand, $sex, $visitClass, (string) $count];
                }
            }
        }

        return $rows;
    }

    /**
     * @return list<list<string>>
     */
    private function fetchMalariaSummaryRows(string $dateFrom, string $dateTo, int $facilityId): array
    {
        $terms = $this->loadMalariaTerms();
        $indicators = [
            [
                'label' => 'Suspected — active problem list',
                'exists' => $this->buildProblemExistsSql($terms, $dateFrom, $dateTo, true),
            ],
            [
                'label' => 'Suspected — billing diagnosis',
                'exists' => $this->buildBillingExistsSql($terms, $dateFrom, $dateTo),
            ],
            [
                'label' => 'Lab tested',
                'exists' => $this->buildLabTestedExistsSql($terms, $dateFrom, $dateTo),
            ],
            [
                'label' => 'Lab positive',
                'exists' => $this->buildLabPositiveExistsSql($terms, $dateFrom, $dateTo),
            ],
        ];

        $rows = [];
        foreach ($indicators as $indicator) {
            $count = $this->countVisitedPatientsMatching(
                $facilityId,
                $dateFrom,
                $dateTo,
                $indicator['exists']['sql'],
                $indicator['exists']['bind']
            );
            $rows[] = [$indicator['label'], (string) $count];
        }

        return $rows;
    }

    /**
     * @return array{title_terms: list<string>, icd_prefixes: list<string>}
     */
    private function loadMalariaTerms(): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT display_name, icd10_patterns, title_patterns
             FROM new_condition_map
             WHERE condition_key = 'malaria'
             LIMIT 1"
        );

        $titleTerms = ['malaria'];
        $icdPrefixes = ['B50', 'B51', 'B52', 'B53', 'B54'];
        if (is_array($row)) {
            $mappedTitles = $this->splitCsv((string) ($row['title_patterns'] ?? ''));
            if ($mappedTitles !== []) {
                $titleTerms = $mappedTitles;
            }
            $mappedIcd = $this->splitCsv((string) ($row['icd10_patterns'] ?? ''));
            if ($mappedIcd !== []) {
                $icdPrefixes = $mappedIcd;
            }
        }

        return [
            'title_terms' => $titleTerms,
            'icd_prefixes' => $icdPrefixes,
        ];
    }

    /**
     * @param array{title_terms: list<string>, icd_prefixes: list<string>} $terms
     * @return array{sql: string, bind: list<mixed>}
     */
    private function buildProblemExistsSql(array $terms, string $dateFrom, string $dateTo, bool $activeOnly): array
    {
        $sub = ['l.pid = v.pid', "l.type = 'medical_problem'"];
        $bind = [];
        if ($activeOnly) {
            $sub[] = "l.activity = '1'";
        }
        $sub[] = 'l.begdate >= ?';
        $bind[] = $dateFrom;
        $sub[] = 'l.begdate <= ?';
        $bind[] = $dateTo;
        $sub[] = '(' . $this->titleIcdMatchSql('l.title', 'l.diagnosis', $terms, $bind) . ')';

        return [
            'sql' => 'EXISTS (SELECT 1 FROM lists l WHERE ' . implode(' AND ', $sub) . ')',
            'bind' => $bind,
        ];
    }

    /**
     * @param array{title_terms: list<string>, icd_prefixes: list<string>} $terms
     * @return array{sql: string, bind: list<mixed>}
     */
    private function buildBillingExistsSql(array $terms, string $dateFrom, string $dateTo): array
    {
        $bind = [];
        $sub = [
            'b.pid = v.pid',
            'b.activity = 1',
            "(b.code_type LIKE '%ICD%' OR b.code_type LIKE '%icd%')",
            'b.date >= ?',
            'b.date <= ?',
            '(' . $this->billingMatchSql($terms, $bind) . ')',
        ];
        array_unshift($bind, $dateFrom, $dateTo);

        return [
            'sql' => 'EXISTS (SELECT 1 FROM billing b WHERE ' . implode(' AND ', $sub) . ')',
            'bind' => $bind,
        ];
    }

    /**
     * @param array{title_terms: list<string>, icd_prefixes: list<string>} $terms
     * @return array{sql: string, bind: list<mixed>}
     */
    private function buildLabTestedExistsSql(array $terms, string $dateFrom, string $dateTo): array
    {
        $bind = [$dateFrom, $dateTo];
        $match = $this->labOrderMatchSql($terms, $bind);

        return [
            'sql' => "EXISTS (
                SELECT 1 FROM procedure_order po
                INNER JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id
                WHERE po.patient_id = v.pid
                  AND po.activity = 1
                  AND DATE(po.date_ordered) >= ?
                  AND DATE(po.date_ordered) <= ?
                  AND ({$match})
            )",
            'bind' => $bind,
        ];
    }

    /**
     * @param array{title_terms: list<string>, icd_prefixes: list<string>} $terms
     * @return array{sql: string, bind: list<mixed>}
     */
    private function buildLabPositiveExistsSql(array $terms, string $dateFrom, string $dateTo): array
    {
        $bind = [];
        $match = $this->labOrderMatchSql($terms, $bind);
        $indexDate = 'COALESCE(pr.date_collected, pr.date_report, DATE(pres.date))';

        return [
            'sql' => "EXISTS (
                SELECT 1 FROM procedure_result pres
                INNER JOIN procedure_report pr ON pr.procedure_report_id = pres.procedure_report_id
                INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
                LEFT JOIN procedure_order_code poc
                    ON poc.procedure_order_id = po.procedure_order_id
                    AND poc.procedure_order_seq = pr.procedure_order_seq
                WHERE po.patient_id = v.pid
                  AND po.activity = 1
                  AND pres.result NOT IN ('DNR', 'TNP', '')
                  AND (
                    pres.abnormal IN ('yes', 'high', 'low')
                    OR LOWER(pres.result) IN ('positive', 'pos', 'reactive', 'detected')
                    OR LOWER(pres.result_text) LIKE '%positive%'
                    OR LOWER(pres.result_text) LIKE '%reactive%'
                  )
                  AND {$indexDate} >= ?
                  AND {$indexDate} <= ?
                  AND ({$match})
            )",
            'bind' => array_merge([$dateFrom, $dateTo], $bind),
        ];
    }

    /**
     * @param array{title_terms: list<string>, icd_prefixes: list<string>} $terms
     * @param list<mixed> $bind
     */
    private function titleIcdMatchSql(string $titleCol, string $diagCol, array $terms, array &$bind): string
    {
        $parts = [];
        foreach ($terms['title_terms'] as $term) {
            $parts[] = "{$titleCol} LIKE ?";
            $bind[] = '%' . $term . '%';
        }
        foreach ($terms['icd_prefixes'] as $prefix) {
            $parts[] = "({$diagCol} LIKE ? OR {$diagCol} LIKE ?)";
            $bind[] = '%ICD10:' . $prefix . '%';
            $bind[] = '%ICD9:' . $prefix . '%';
        }

        return implode(' OR ', $parts);
    }

    /**
     * @param array{title_terms: list<string>, icd_prefixes: list<string>} $terms
     * @param list<mixed> $bind
     */
    private function billingMatchSql(array $terms, array &$bind): string
    {
        $parts = [];
        foreach ($terms['icd_prefixes'] as $prefix) {
            $parts[] = 'b.code LIKE ?';
            $bind[] = $prefix . '%';
        }
        foreach ($terms['title_terms'] as $term) {
            $parts[] = 'b.code_text LIKE ?';
            $bind[] = '%' . $term . '%';
        }

        return implode(' OR ', $parts);
    }

    /**
     * @param array{title_terms: list<string>, icd_prefixes: list<string>} $terms
     * @param list<mixed> $bind
     */
    private function labOrderMatchSql(array $terms, array &$bind): string
    {
        $parts = [];
        foreach (self::LAB_TEST_TERMS as $term) {
            $parts[] = 'poc.procedure_name LIKE ?';
            $bind[] = '%' . $term . '%';
            $parts[] = 'poc.procedure_code LIKE ?';
            $bind[] = '%' . $term . '%';
        }
        foreach ($terms['title_terms'] as $term) {
            $parts[] = 'poc.procedure_name LIKE ?';
            $bind[] = '%' . $term . '%';
        }

        return implode(' OR ', $parts);
    }

    /**
     * @param list<mixed> $existsBind
     */
    private function countVisitedPatientsMatching(
        int $facilityId,
        string $dateFrom,
        string $dateTo,
        string $existsSql,
        array $existsBind,
    ): int {
        [$whereSql, $bind] = $this->visitWhere($dateFrom, $dateTo, $facilityId);
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT v.pid) AS cnt
             FROM new_visit v
             WHERE {$whereSql}
               AND {$existsSql}",
            array_merge($bind, $existsBind)
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return list<string>
     */
    private function splitCsv(string $raw): array
    {
        if ($raw === '') {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', explode(',', $raw)),
            static fn (string $part): bool => $part !== ''
        ));
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function visitWhere(string $dateFrom, string $dateTo, int $facilityId): array
    {
        $parts = ["v.state NOT IN ('cancelled')", 'v.visit_date >= ?', 'v.visit_date <= ?'];
        $bind = [$dateFrom, $dateTo];
        if ($facilityId > 0) {
            $parts[] = 'v.facility_id = ?';
            $bind[] = $facilityId;
        }

        return [implode(' AND ', $parts), $bind];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function requireDateRange(?string $dateFrom, ?string $dateTo): array
    {
        $from = $this->normalizeDate($dateFrom);
        $to = $this->normalizeDate($dateTo);
        if ($from === null || $to === null) {
            throw new \InvalidArgumentException('date_from and date_to are required for public health reports');
        }

        return [$from, $to];
    }

    private function normalizeDate(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $str = trim($value);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $str)) {
            throw new \InvalidArgumentException('date_from and date_to must be YYYY-MM-DD');
        }

        return $str;
    }

    public function mohPackLabel(int $facilityId = 0): string
    {
        $pack = trim((string) ($this->config->get('report_hub_moh_pack', 'ghana_v1', $facilityId) ?? 'ghana_v1'));

        return match ($pack) {
            'ghana_v1' => 'Ghana MOH v1',
            default => $pack,
        };
    }
}
