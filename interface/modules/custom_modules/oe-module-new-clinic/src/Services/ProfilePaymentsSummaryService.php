<?php

/**
 * MRD Profile payments strip (M11-F07 / MRD §8.10.1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class ProfilePaymentsSummaryService
{
    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getSummary(int $pid, ?int $visitId = null): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $webroot = $GLOBALS['webroot'] ?? '';
        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        if (!$this->isFinanceStripEnabled($facilityId)) {
            return [
                'hidden' => true,
                'balance_due_amount' => null,
                'balance_warning' => false,
                'last_receipt' => null,
                'payments_strip_label' => null,
                'can_view_history' => false,
                'payment_history_url' => null,
                'ledger_url' => $webroot . '/interface/reports/pat_ledger.php?form_pid=' . urlencode((string) $pid),
                'currency_symbol' => $currencySymbol,
            ];
        }

        $balanceDue = $this->resolveBalanceDue($pid, $visitId);
        $lastReceipt = $this->resolveLastReceipt($pid);
        $canViewHistory = AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance');

        $historyUrl = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/payments.php?pid='
            . urlencode((string) $pid);
        if ($visitId !== null && $visitId > 0) {
            $historyUrl .= '&visit_id=' . urlencode((string) $visitId);
        }

        return [
            'hidden' => false,
            'balance_due_amount' => $balanceDue > 0 ? round($balanceDue, 2) : null,
            'balance_warning' => $balanceDue > 0,
            'last_receipt' => $lastReceipt,
            'payments_strip_label' => $this->buildStripLabel($balanceDue, $lastReceipt, $currencySymbol),
            'can_view_history' => $canViewHistory,
            'payment_history_url' => $canViewHistory ? $historyUrl : null,
            'ledger_url' => $webroot . '/interface/reports/pat_ledger.php?form_pid=' . urlencode((string) $pid),
            'currency_symbol' => $currencySymbol,
        ];
    }

    private function isFinanceStripEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_chart_depth', 0, $facilityId) === 1
            && $this->config->getInt('enable_chart_depth_finance', 0, $facilityId) === 1;
    }

    private function resolveBalanceDue(int $pid, ?int $visitId): float
    {
        $bind = [$pid];
        $visitFilter = '';
        if ($visitId !== null && $visitId > 0) {
            $visitFilter = ' AND v.id = ?';
            $bind[] = $visitId;
        }

        $visit = QueryUtils::querySingleRow(
            "SELECT v.encounter FROM new_visit v
             WHERE v.pid = ? AND v.state = 'ready_for_payment'{$visitFilter}
             ORDER BY v.visit_date DESC, v.id DESC
             LIMIT 1",
            $bind
        );

        if (!is_array($visit)) {
            return 0.0;
        }

        $encounter = (int) ($visit['encounter'] ?? 0);
        if ($encounter <= 0) {
            return 0.0;
        }

        $chargesRow = QueryUtils::querySingleRow(
            "SELECT COALESCE(SUM(fee), 0) AS total
             FROM billing
             WHERE pid = ? AND encounter = ? AND activity = 1",
            [$pid, $encounter]
        );
        $charges = is_array($chargesRow) ? (float) ($chargesRow['total'] ?? 0) : 0.0;

        $paidRow = QueryUtils::querySingleRow(
            "SELECT COALESCE(SUM(pay_amount), 0) AS paid
             FROM ar_activity
             WHERE pid = ? AND encounter = ? AND account_code = 'PP'",
            [$pid, $encounter]
        );
        $paid = is_array($paidRow) ? (float) ($paidRow['paid'] ?? 0) : 0.0;

        return max(0.0, round($charges - $paid, 2));
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveLastReceipt(int $pid): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT r.id, r.receipt_number, r.amount_paid, r.created_at, r.visit_id,
                    u.fname, u.lname
             FROM new_receipt r
             LEFT JOIN users u ON u.id = r.actor_user_id
             WHERE r.pid = ?
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT 1",
            [$pid]
        );

        if (!is_array($row)) {
            return null;
        }

        $cashier = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));

        return [
            'id' => (int) ($row['id'] ?? 0),
            'receipt_number' => (string) ($row['receipt_number'] ?? ''),
            'amount_paid' => round((float) ($row['amount_paid'] ?? 0), 2),
            'at' => $this->formatDate((string) ($row['created_at'] ?? '')),
            'cashier' => $cashier !== '' ? $cashier : null,
            'visit_id' => (int) ($row['visit_id'] ?? 0),
        ];
    }

    /**
     * @param array<string, mixed>|null $lastReceipt
     */
    private function buildStripLabel(float $balanceDue, ?array $lastReceipt, string $currencySymbol): string
    {
        $parts = [];

        if ($balanceDue > 0) {
            $parts[] = 'Balance due: ' . $currencySymbol . number_format($balanceDue, 2);
        } else {
            $parts[] = 'Balance due: ' . $currencySymbol . '0.00';
        }

        if ($lastReceipt !== null && ($lastReceipt['receipt_number'] ?? '') !== '') {
            $receiptPart = 'Last receipt #' . $lastReceipt['receipt_number'];
            if (!empty($lastReceipt['at'])) {
                $receiptPart .= ' · ' . $lastReceipt['at'];
            }
            $parts[] = $receiptPart;
        } elseif ($balanceDue <= 0) {
            $parts[] = 'No payments on file';
        }

        return implode(' · ', $parts);
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
