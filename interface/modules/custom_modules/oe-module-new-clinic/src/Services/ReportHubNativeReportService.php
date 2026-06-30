<?php

/**
 * M16 Reporting Operations Hub — native P2 report queries (immunizations, destroyed drugs)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportHubNativeReportService
{
    public const KEY_IMMUNIZATIONS = 'clinical_immunizations';

    public const KEY_DESTROYED_DRUGS = 'pharm_destroyed';

    /** @var array<int, string> */
    public const NATIVE_KEYS = [
        self::KEY_IMMUNIZATIONS,
        self::KEY_DESTROYED_DRUGS,
    ];

    public function isNativeKey(string $reportKey): bool
    {
        return in_array($reportKey, self::NATIVE_KEYS, true);
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    public function runReport(
        string $reportKey,
        ?string $dateFrom,
        ?string $dateTo,
        int $limit = 50,
        int $offset = 0,
    ): array {
        $this->assertNativeKey($reportKey);
        $dateFrom = $this->normalizeDate($dateFrom);
        $dateTo = $this->normalizeDate($dateTo);

        return match ($reportKey) {
            self::KEY_IMMUNIZATIONS => $this->runImmunizations($dateFrom, $dateTo, $limit, $offset),
            self::KEY_DESTROYED_DRUGS => $this->runDestroyedDrugs($dateFrom, $dateTo, $limit, $offset),
            default => throw new \InvalidArgumentException('Unsupported native report'),
        };
    }

    public function countRows(string $reportKey, ?string $dateFrom, ?string $dateTo): int
    {
        $this->assertNativeKey($reportKey);
        $dateFrom = $this->normalizeDate($dateFrom);
        $dateTo = $this->normalizeDate($dateTo);

        return match ($reportKey) {
            self::KEY_IMMUNIZATIONS => $this->countImmunizations($dateFrom, $dateTo),
            self::KEY_DESTROYED_DRUGS => $this->countDestroyedDrugs($dateFrom, $dateTo),
            default => 0,
        };
    }

    /**
     * @return array{filename: string, content: string, row_count: int}
     */
    public function buildCsv(string $reportKey, ?string $dateFrom, ?string $dateTo): array
    {
        $preview = $this->runReport($reportKey, $dateFrom, $dateTo, PHP_INT_MAX, 0);
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to create export buffer');
        }

        fputcsv($handle, $preview['columns']);
        foreach ($preview['rows'] as $row) {
            fputcsv($handle, $row);
        }

        rewind($handle);
        $content = stream_get_contents($handle) ?: '';
        fclose($handle);

        $slug = match ($reportKey) {
            self::KEY_IMMUNIZATIONS => 'immunizations',
            self::KEY_DESTROYED_DRUGS => 'destroyed-medicines',
            default => 'report',
        };

        return [
            'filename' => $slug . '-' . date('Ymd-His') . '.csv',
            'content' => $content,
            'row_count' => (int) $preview['total'],
        ];
    }

    private function assertNativeKey(string $reportKey): void
    {
        if (!$this->isNativeKey($reportKey)) {
            throw new \InvalidArgumentException('Report key is not a native hub report');
        }
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

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    private function runImmunizations(?string $dateFrom, ?string $dateTo, int $limit, int $offset): array
    {
        $columns = [
            'Patient',
            'MRN',
            'Visit date',
            'CVX',
            'Vaccine',
            'Lot',
            'Manufacturer',
        ];

        [$whereSql, $bind] = $this->immunizationWhere($dateFrom, $dateTo);
        $total = $this->countImmunizations($dateFrom, $dateTo);

        $sql = "SELECT CONCAT(p.fname, ' ', p.lname) AS patient_name,
                       COALESCE(p.pubpid, p.pid) AS mrn,
                       i.vis_date,
                       i.cvx_code,
                       c.code_text_short AS vaccine_name,
                       COALESCE(i.lot_number, '') AS lot_number,
                       COALESCE(i.manufacturer, '') AS manufacturer
                FROM immunizations i
                INNER JOIN patient_data p ON i.patient_id = p.pid
                INNER JOIN codes c ON i.cvx_code = c.code
                INNER JOIN code_types ct ON c.code_type = ct.ct_id AND ct.ct_key = 'CVX'
                WHERE i.added_erroneously = 0 AND {$whereSql}
                ORDER BY i.vis_date DESC, patient_name ASC
                LIMIT " . max(1, $limit) . ' OFFSET ' . max(0, $offset);

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $rows = [];
        foreach ($records as $record) {
            $rows[] = [
                (string) ($record['patient_name'] ?? ''),
                (string) ($record['mrn'] ?? ''),
                (string) ($record['vis_date'] ?? ''),
                (string) ($record['cvx_code'] ?? ''),
                (string) ($record['vaccine_name'] ?? ''),
                (string) ($record['lot_number'] ?? ''),
                (string) ($record['manufacturer'] ?? ''),
            ];
        }

        return [
            'columns' => $columns,
            'rows' => $rows,
            'total' => $total,
        ];
    }

    private function countImmunizations(?string $dateFrom, ?string $dateTo): int
    {
        [$whereSql, $bind] = $this->immunizationWhere($dateFrom, $dateTo);
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM immunizations i
             INNER JOIN patient_data p ON i.patient_id = p.pid
             INNER JOIN codes c ON i.cvx_code = c.code
             INNER JOIN code_types ct ON c.code_type = ct.ct_id AND ct.ct_key = 'CVX'
             WHERE i.added_erroneously = 0 AND {$whereSql}",
            $bind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function immunizationWhere(?string $dateFrom, ?string $dateTo): array
    {
        $parts = ['1=1'];
        $bind = [];
        if ($dateFrom !== null) {
            $parts[] = 'i.vis_date >= ?';
            $bind[] = $dateFrom;
        }
        if ($dateTo !== null) {
            $parts[] = 'i.vis_date <= ?';
            $bind[] = $dateTo;
        }

        return [implode(' AND ', $parts), $bind];
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    private function runDestroyedDrugs(?string $dateFrom, ?string $dateTo, int $limit, int $offset): array
    {
        $columns = [
            'Drug',
            'NDC',
            'Lot',
            'Quantity',
            'Destroyed date',
            'Method',
            'Witness',
            'Notes',
        ];

        [$whereSql, $bind] = $this->destroyedWhere($dateFrom, $dateTo);
        $total = $this->countDestroyedDrugs($dateFrom, $dateTo);

        $sql = "SELECT COALESCE(d.name, '') AS drug_name,
                       COALESCE(d.ndc_number, '') AS ndc_number,
                       COALESCE(i.lot_number, '') AS lot_number,
                       COALESCE(i.on_hand, '') AS on_hand,
                       i.destroy_date,
                       COALESCE(i.destroy_method, '') AS destroy_method,
                       COALESCE(i.destroy_witness, '') AS destroy_witness,
                       COALESCE(i.destroy_notes, '') AS destroy_notes
                FROM drug_inventory i
                LEFT JOIN drugs d ON d.drug_id = i.drug_id
                WHERE {$whereSql}
                ORDER BY drug_name ASC, i.destroy_date ASC, i.lot_number ASC
                LIMIT " . max(1, $limit) . ' OFFSET ' . max(0, $offset);

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $rows = [];
        foreach ($records as $record) {
            $rows[] = [
                (string) ($record['drug_name'] ?? ''),
                (string) ($record['ndc_number'] ?? ''),
                (string) ($record['lot_number'] ?? ''),
                (string) ($record['on_hand'] ?? ''),
                (string) ($record['destroy_date'] ?? ''),
                (string) ($record['destroy_method'] ?? ''),
                (string) ($record['destroy_witness'] ?? ''),
                (string) ($record['destroy_notes'] ?? ''),
            ];
        }

        return [
            'columns' => $columns,
            'rows' => $rows,
            'total' => $total,
        ];
    }

    private function countDestroyedDrugs(?string $dateFrom, ?string $dateTo): int
    {
        [$whereSql, $bind] = $this->destroyedWhere($dateFrom, $dateTo);
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM drug_inventory i
             LEFT JOIN drugs d ON d.drug_id = i.drug_id
             WHERE {$whereSql}",
            $bind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function destroyedWhere(?string $dateFrom, ?string $dateTo): array
    {
        $parts = ['i.destroy_date IS NOT NULL'];
        $bind = [];
        if ($dateFrom !== null) {
            $parts[] = 'i.destroy_date >= ?';
            $bind[] = $dateFrom;
        }
        if ($dateTo !== null) {
            $parts[] = 'i.destroy_date <= ?';
            $bind[] = $dateTo;
        }

        return [implode(' AND ', $parts), $bind];
    }
}
