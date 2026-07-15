<?php

/**
 * M14-F04 — simplified outstanding balances list
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class BillOpsOutstandingService
{
    public const PAGE_SIZE = 25;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly BillOpsAccessService $access = new BillOpsAccessService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function listOutstanding(?string $bucket = null, int $offset = 0, int $limit = self::PAGE_SIZE): array
    {
        $this->access->assertOutstandingAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $bucket = $this->normalizeBucket($bucket);

        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        $baseSql = "FROM (
            SELECT v.id AS visit_id, v.pid, v.queue_number, v.visit_date, v.state,
                   pd.fname, pd.lname, pd.pubpid, pd.phone_cell, pd.phone_home,
                   (COALESCE(charges.total, 0) + COALESCE(drugcharges.total, 0)) AS charges_total,
                   COALESCE(paid.total, 0) AS paid_total,
                   GREATEST((COALESCE(charges.total, 0) + COALESCE(drugcharges.total, 0)) - COALESCE(paid.total, 0), 0) AS owed,
                   DATEDIFF(CURDATE(), v.visit_date) AS age_days
            FROM new_visit v
            INNER JOIN patient_data pd ON pd.pid = v.pid
            LEFT JOIN (
                SELECT b.pid, b.encounter, SUM(b.fee) AS total
                FROM billing b
                WHERE b.activity = 1
                AND EXISTS (
                    SELECT 1 FROM new_visit vb
                    WHERE vb.pid = b.pid AND vb.encounter = b.encounter AND vb.facility_id = ?
                )
                GROUP BY b.pid, b.encounter
            ) charges ON charges.pid = v.pid AND charges.encounter = v.encounter
            LEFT JOIN (
                -- CBILL-1/2 — medicines collected at the cashier live in drug_sales (billed = 1),
                -- not billing. Without this a partial-paid visit's owed understates by the
                -- medicine amount. billed = 0 (separate pharmacy-counter sales) stays excluded.
                SELECT ds.pid, ds.encounter, SUM(ds.fee) AS total
                FROM drug_sales ds
                WHERE ds.billed = 1
                AND EXISTS (
                    SELECT 1 FROM new_visit vd
                    WHERE vd.pid = ds.pid AND vd.encounter = ds.encounter AND vd.facility_id = ?
                )
                GROUP BY ds.pid, ds.encounter
            ) drugcharges ON drugcharges.pid = v.pid AND drugcharges.encounter = v.encounter
            LEFT JOIN (
                SELECT r.visit_id, SUM(CASE WHEN r.reversed_at IS NULL THEN r.amount_paid ELSE 0 END) AS total
                FROM new_receipt r
                WHERE r.facility_id = ?
                GROUP BY r.visit_id
            ) paid ON paid.visit_id = v.id
            WHERE v.facility_id = ?
            AND (
                v.state = 'closed_unpaid'
                OR (v.state = 'completed'
                    AND (COALESCE(charges.total, 0) + COALESCE(drugcharges.total, 0)) > COALESCE(paid.total, 0) + 0.001)
            )
        ) outstanding
        WHERE owed > 0";

        // One bind per '?' in order: charges-subquery facility, drug-charges-subquery
        // facility, paid-subquery facility, then the outer visit facility filter.
        $bind = [$facilityId, $facilityId, $facilityId, $facilityId];
        $bucketSql = '';
        if ($bucket === '0_7') {
            $bucketSql = ' AND age_days <= 7';
        } elseif ($bucket === '8_30') {
            $bucketSql = ' AND age_days BETWEEN 8 AND 30';
        } elseif ($bucket === '31_plus') {
            $bucketSql = ' AND age_days >= 31';
        }

        $countRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(owed), 0) AS total_owed {$baseSql}{$bucketSql}",
            $bind
        ) ?: [];

        $rows = QueryUtils::fetchRecords(
            "SELECT outstanding.* {$baseSql}{$bucketSql}
             ORDER BY owed DESC, visit_date ASC
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $bind
        ) ?: [];

        $total = (int) ($countRow['cnt'] ?? 0);

        return [
            'currency_symbol' => $currencySymbol,
            'bucket' => $bucket,
            'total_owed' => round((float) ($countRow['total_owed'] ?? 0), 2),
            'rows' => array_map(static function (array $row): array {
                $phone = (string) ($row['phone_cell'] ?? '');
                if ($phone === '') {
                    $phone = (string) ($row['phone_home'] ?? '');
                }
                $name = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));
                $ageDays = (int) ($row['age_days'] ?? 0);

                return [
                    'visit_id' => (int) ($row['visit_id'] ?? 0),
                    'pid' => (int) ($row['pid'] ?? 0),
                    'queue_number' => (int) ($row['queue_number'] ?? 0),
                    'visit_date' => (string) ($row['visit_date'] ?? ''),
                    'patient_name' => $name,
                    'pubpid' => (string) ($row['pubpid'] ?? ''),
                    'phone' => $phone !== '' ? $phone : null,
                    'owed' => round((float) ($row['owed'] ?? 0), 2),
                    'age_days' => $ageDays,
                    'age_bucket' => self::bucketLabel($ageDays),
                    'state' => (string) ($row['state'] ?? ''),
                ];
            }, $rows),
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($rows)) < $total,
        ];
    }

    private function normalizeBucket(?string $bucket): ?string
    {
        if ($bucket === null || $bucket === '' || $bucket === 'all') {
            return null;
        }

        if (!in_array($bucket, ['0_7', '8_30', '31_plus'], true)) {
            throw new \InvalidArgumentException('Invalid bucket');
        }

        return $bucket;
    }

    private static function bucketLabel(int $ageDays): string
    {
        if ($ageDays <= 7) {
            return '0_7';
        }
        if ($ageDays <= 30) {
            return '8_30';
        }

        return '31_plus';
    }
}
