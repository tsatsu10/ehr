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

    public const KEY_INVENTORY_TRANSACTIONS = ReportHubPharmacyNativeReportService::KEY_INVENTORY_TRANSACTIONS;

    public const KEY_INVENTORY_ACTIVITY = ReportHubPharmacyNativeReportService::KEY_INVENTORY_ACTIVITY;

    public const KEY_OPD_ATTENDANCE = ReportHubPublicHealthNativeReportService::KEY_OPD_ATTENDANCE;

    public const KEY_MALARIA_SURVEILLANCE = ReportHubPublicHealthNativeReportService::KEY_MALARIA_SURVEILLANCE;

    private const EXPORT_CHUNK_SIZE = 500;

    /** @var array<int, string> */
    public const NATIVE_KEYS = [
        self::KEY_IMMUNIZATIONS,
        self::KEY_DESTROYED_DRUGS,
        self::KEY_INVENTORY_TRANSACTIONS,
        self::KEY_INVENTORY_ACTIVITY,
        self::KEY_OPD_ATTENDANCE,
        self::KEY_MALARIA_SURVEILLANCE,
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ReportHubPharmacyNativeReportService $pharmacyReports = new ReportHubPharmacyNativeReportService(),
        private readonly ReportHubPublicHealthNativeReportService $publicHealthReports = new ReportHubPublicHealthNativeReportService(),
    ) {
    }

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
        int $facilityId = 0,
    ): array {
        $this->assertNativeKey($reportKey);
        $dateFrom = $this->normalizeDate($dateFrom);
        $dateTo = $this->normalizeDate($dateTo);

        return match ($reportKey) {
            self::KEY_IMMUNIZATIONS => $this->runImmunizations($dateFrom, $dateTo, $limit, $offset, $facilityId),
            self::KEY_DESTROYED_DRUGS => $this->runDestroyedDrugs($dateFrom, $dateTo, $limit, $offset, $facilityId),
            self::KEY_INVENTORY_TRANSACTIONS, self::KEY_INVENTORY_ACTIVITY => $this->pharmacyReports->runReport(
                $reportKey,
                $dateFrom,
                $dateTo,
                $limit,
                $offset,
                $facilityId
            ),
            self::KEY_OPD_ATTENDANCE, self::KEY_MALARIA_SURVEILLANCE => $this->publicHealthReports->runReport(
                $reportKey,
                $dateFrom,
                $dateTo,
                $limit,
                $offset,
                $facilityId
            ),
            default => throw new \InvalidArgumentException('Unsupported native report'),
        };
    }

    public function countRows(string $reportKey, ?string $dateFrom, ?string $dateTo, int $facilityId = 0): int
    {
        $this->assertNativeKey($reportKey);
        $dateFrom = $this->normalizeDate($dateFrom);
        $dateTo = $this->normalizeDate($dateTo);

        return match ($reportKey) {
            self::KEY_IMMUNIZATIONS => $this->countImmunizations($dateFrom, $dateTo, $facilityId),
            self::KEY_DESTROYED_DRUGS => $this->countDestroyedDrugs($dateFrom, $dateTo, $facilityId),
            self::KEY_INVENTORY_TRANSACTIONS, self::KEY_INVENTORY_ACTIVITY => $this->pharmacyReports->countRows(
                $reportKey,
                $dateFrom,
                $dateTo,
                $facilityId
            ),
            self::KEY_OPD_ATTENDANCE, self::KEY_MALARIA_SURVEILLANCE => $this->publicHealthReports->countRows(
                $reportKey,
                $dateFrom,
                $dateTo,
                $facilityId
            ),
            default => 0,
        };
    }

    /**
     * @return array{filename: string, content: string, row_count: int}
     */
    public function buildCsv(string $reportKey, ?string $dateFrom, ?string $dateTo, int $facilityId = 0): array
    {
        $preview = $this->runReport($reportKey, $dateFrom, $dateTo, 1, 0, $facilityId);
        $columns = $preview['columns'];
        $total = $this->countRows($reportKey, $dateFrom, $dateTo, $facilityId);

        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to create export buffer');
        }

        fputcsv($handle, $columns);

        $offset = 0;
        $written = 0;
        while ($offset < $total) {
            $chunk = $this->runReport(
                $reportKey,
                $dateFrom,
                $dateTo,
                self::EXPORT_CHUNK_SIZE,
                $offset,
                $facilityId
            );
            if ($chunk['rows'] === []) {
                break;
            }
            foreach ($chunk['rows'] as $row) {
                fputcsv($handle, $row);
            }
            $written += count($chunk['rows']);
            $offset += self::EXPORT_CHUNK_SIZE;
        }

        rewind($handle);
        $content = stream_get_contents($handle) ?: '';
        fclose($handle);

        $slug = match ($reportKey) {
            self::KEY_IMMUNIZATIONS => 'immunizations',
            self::KEY_DESTROYED_DRUGS => 'destroyed-medicines',
            self::KEY_INVENTORY_TRANSACTIONS => 'inventory-transactions',
            self::KEY_INVENTORY_ACTIVITY => 'inventory-activity',
            self::KEY_OPD_ATTENDANCE => 'opd-attendance',
            self::KEY_MALARIA_SURVEILLANCE => 'malaria-surveillance',
            default => 'report',
        };

        return [
            'filename' => $slug . '-' . date('Ymd-His') . '.csv',
            'content' => $content,
            'row_count' => $written,
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
    private function runImmunizations(
        ?string $dateFrom,
        ?string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
        $columns = [
            'Patient',
            'MRN',
            'Visit date',
            'CVX',
            'Vaccine',
            'Dose #',
            'Lot',
            'Manufacturer',
        ];

        [$whereSql, $bind] = $this->immunizationWhere($dateFrom, $dateTo, $facilityId);
        $total = $this->countImmunizations($dateFrom, $dateTo, $facilityId);

        $sql = "SELECT CONCAT(p.fname, ' ', p.lname) AS patient_name,
                       COALESCE(p.pubpid, p.pid) AS mrn,
                       i.vis_date,
                       i.cvx_code,
                       c.code_text_short AS vaccine_name,
                       (SELECT COUNT(*)
                        FROM immunizations i2
                        WHERE i2.patient_id = i.patient_id
                          AND i2.cvx_code = i.cvx_code
                          AND i2.added_erroneously = 0
                          AND (
                            COALESCE(i2.administered_date, i2.create_date) < COALESCE(i.administered_date, i.create_date)
                            OR (
                              COALESCE(i2.administered_date, i2.create_date) = COALESCE(i.administered_date, i.create_date)
                              AND i2.id <= i.id
                            )
                          )
                       ) AS dose_number,
                       COALESCE(i.lot_number, '') AS lot_number,
                       COALESCE(i.manufacturer, '') AS manufacturer
                FROM immunizations i
                INNER JOIN patient_data p ON i.patient_id = p.pid
                INNER JOIN codes c ON i.cvx_code = c.code
                INNER JOIN code_types ct ON c.code_type = ct.ct_id AND ct.ct_key = 'CVX'
                LEFT JOIN form_encounter fe ON fe.encounter = i.encounter_id AND fe.pid = i.patient_id
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
                (string) ((int) ($record['dose_number'] ?? 0)),
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

    private function countImmunizations(?string $dateFrom, ?string $dateTo, int $facilityId): int
    {
        [$whereSql, $bind] = $this->immunizationWhere($dateFrom, $dateTo, $facilityId);
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM immunizations i
             INNER JOIN patient_data p ON i.patient_id = p.pid
             INNER JOIN codes c ON i.cvx_code = c.code
             INNER JOIN code_types ct ON c.code_type = ct.ct_id AND ct.ct_key = 'CVX'
             LEFT JOIN form_encounter fe ON fe.encounter = i.encounter_id AND fe.pid = i.patient_id
             WHERE i.added_erroneously = 0 AND {$whereSql}",
            $bind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function immunizationWhere(?string $dateFrom, ?string $dateTo, int $facilityId): array
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
        if ($facilityId > 0) {
            $parts[] = '(fe.facility_id = ? OR (i.encounter_id IS NULL AND EXISTS (
                SELECT 1 FROM form_encounter fe2
                WHERE fe2.pid = i.patient_id AND fe2.facility_id = ?
                LIMIT 1
            )))';
            $bind[] = $facilityId;
            $bind[] = $facilityId;
        }

        return [implode(' AND ', $parts), $bind];
    }

    /**
     * @return array{columns: list<string>, rows: list<list<string>>, total: int}
     */
    private function runDestroyedDrugs(
        ?string $dateFrom,
        ?string $dateTo,
        int $limit,
        int $offset,
        int $facilityId,
    ): array {
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

        [$whereSql, $bind] = $this->destroyedWhere($dateFrom, $dateTo, $facilityId);
        $total = $this->countDestroyedDrugs($dateFrom, $dateTo, $facilityId);

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

    private function countDestroyedDrugs(?string $dateFrom, ?string $dateTo, int $facilityId): int
    {
        [$whereSql, $bind] = $this->destroyedWhere($dateFrom, $dateTo, $facilityId);
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
    private function destroyedWhere(?string $dateFrom, ?string $dateTo, int $facilityId): array
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
        $warehouseId = $this->resolveFacilityWarehouseId($facilityId);
        if ($warehouseId !== null) {
            $parts[] = 'i.warehouse_id = ?';
            $bind[] = $warehouseId;
        }

        return [implode(' AND ', $parts), $bind];
    }

    private function resolveFacilityWarehouseId(int $facilityId): ?string
    {
        if ($facilityId <= 0) {
            return null;
        }

        $warehouseId = trim((string) ($this->config->get('pharm_default_warehouse_id', '', $facilityId) ?? ''));
        if ($warehouseId === '') {
            $warehouseId = trim((string) ($GLOBALS['gbl_warehouse_id'] ?? ''));
        }

        return $warehouseId !== '' ? $warehouseId : null;
    }
}
