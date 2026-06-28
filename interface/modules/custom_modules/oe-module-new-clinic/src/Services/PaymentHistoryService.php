<?php

/**
 * Chart Depth payment history read models (M11-F01 / F02)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PaymentHistoryService
{
    public const PAGE_SIZE = 20;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getPaymentsList(int $pid, int $offset = 0, int $limit = self::PAGE_SIZE, ?int $visitId = null): array
    {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertFinanceEnabled();

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);

        $bind = [$pid];
        $visitFilter = '';
        if ($visitId !== null && $visitId > 0) {
            $visitFilter = ' AND r.visit_id = ?';
            $bind[] = $visitId;
        }

        $countRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM new_receipt r WHERE r.pid = ?{$visitFilter}",
            $bind
        );
        $total = is_array($countRow) ? (int) ($countRow['cnt'] ?? 0) : 0;

        $listBind = $bind;
        $rows = QueryUtils::fetchRecords(
            "SELECT r.id, r.receipt_number, r.amount_paid, r.change_due, r.created_at,
                    r.visit_id, r.encounter, v.queue_number, v.visit_date,
                    u.fname, u.lname
             FROM new_receipt r
             LEFT JOIN new_visit v ON v.id = r.visit_id
             LEFT JOIN users u ON u.id = r.actor_user_id
             WHERE r.pid = ?{$visitFilter}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $listBind
        ) ?: [];

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        return [
            'pid' => $pid,
            'visit_id' => $visitId,
            'currency_symbol' => $currencySymbol,
            'rows' => array_map(function (array $row): array {
                $cashier = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));

                return [
                    'id' => (int) ($row['id'] ?? 0),
                    'receipt_number' => (string) ($row['receipt_number'] ?? ''),
                    'amount_paid' => round((float) ($row['amount_paid'] ?? 0), 2),
                    'change_due' => round((float) ($row['change_due'] ?? 0), 2),
                    'paid_at' => (string) ($row['created_at'] ?? ''),
                    'paid_at_label' => $this->formatDateTime((string) ($row['created_at'] ?? '')),
                    'visit_id' => (int) ($row['visit_id'] ?? 0),
                    'queue_number' => (int) ($row['queue_number'] ?? 0),
                    'visit_date' => (string) ($row['visit_date'] ?? ''),
                    'cashier' => $cashier !== '' ? $cashier : null,
                ];
            }, $rows),
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($rows)) < $total,
        ];
    }

    private function assertFinanceEnabled(): void
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if ($this->config->getInt('enable_chart_depth', 0, $facilityId) !== 1
            || $this->config->getInt('enable_chart_depth_finance', 0, $facilityId) !== 1) {
            throw new \RuntimeException('Chart depth finance is not enabled', 403);
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
