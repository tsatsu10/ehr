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

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class PaymentHistoryService
{
    public const PAGE_SIZE = 20;

    private const TIMELINE_CAP = 500;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly BillOpsAccessService $billOpsAccess = new BillOpsAccessService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getPaymentsList(
        int $pid,
        int $offset = 0,
        int $limit = self::PAGE_SIZE,
        ?int $visitId = null,
        string $filter = 'all_visits',
        ?string $dateFrom = null,
        ?string $dateTo = null,
    ): array {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertFinanceEnabled();

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $filter = $this->normalizeFilter($filter, $visitId);
        $dateFrom = $this->normalizeDate($dateFrom);
        $dateTo = $this->normalizeDate($dateTo);
        $scope = $this->resolveScope($pid, $visitId, $filter);

        $timeline = $this->buildTimeline($pid, $scope);
        if ($filter === 'date_range') {
            $timeline = $this->filterTimelineByDate($timeline, $dateFrom, $dateTo);
        }
        $total = count($timeline);
        $page = array_slice($timeline, $offset, $limit);

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');
        $addCorrection = $this->billOpsAccess->addCorrectionLink(
            $scope['visit_id'],
            $facilityId
        );
        $canReprint = $this->canReprintReceipt();
        $patient = $this->fetchPatientIdentity($pid);

        return [
            'pid' => $pid,
            'visit_id' => $scope['visit_id'],
            'filter' => $filter,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'currency_symbol' => $currencySymbol,
            'patient' => $patient,
            'can_reprint' => $canReprint,
            'summary' => $scope['scoped'] ? $this->buildSummary($pid, $scope) : null,
            'add_correction_visible' => $addCorrection['visible'],
            'add_correction_url' => $addCorrection['url'],
            'add_correction_label' => $addCorrection['label'],
            'rows' => array_map(fn (array $row) => $this->mapTimelineRow($row, $canReprint), $page),
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($page)) < $total,
            'next_offset' => $offset + count($page),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getReceiptReprintPayload(int $receiptId, int $pid, int $actorUserId): array
    {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertFinanceEnabled();
        if (!$this->canReprintReceipt()) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $receipt = $this->loadReceiptRow($receiptId, $pid);
        $patient = $this->fetchPatientIdentity($pid);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'chart_depth',
            $actorUserId,
            1,
            'chart_depth.receipt_reprinted receipt_id=' . $receiptId . ' pid=' . $pid
        );

        return [
            'receipt' => [
                'receipt_number' => (string) ($receipt['receipt_number'] ?? ''),
                'queue_number' => (int) ($receipt['queue_number'] ?? 0),
                'amount_paid' => round((float) ($receipt['amount_paid'] ?? 0), 2),
                'change_due' => round((float) ($receipt['change_due'] ?? 0), 2),
                'paid_at_label' => $this->formatDateTime((string) ($receipt['created_at'] ?? '')),
            ],
            'patient' => $patient,
        ];
    }

    /**
     * D-FIN-8 — active-visit charge totals for `new_chart_depth_finance_summary`.
     * Charges only: no payment rows, no receipt numbers, no payment methods.
     *
     * @return array<string, mixed>
     */
    public function getVisitChargesSummary(int $pid, ?int $encounterId): array
    {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertFinanceEnabled();

        $charges = 0.0;
        if ($encounterId !== null && $encounterId > 0) {
            $chargesRow = QueryUtils::querySingleRow(
                'SELECT COALESCE(SUM(fee * GREATEST(units, 1)), 0) AS total
                 FROM billing WHERE pid = ? AND encounter = ? AND activity = 1',
                [$pid, $encounterId]
            );
            $charges = is_array($chargesRow) ? (float) ($chargesRow['total'] ?? 0) : 0.0;
        }

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        return [
            'pid' => $pid,
            'encounter_id' => $encounterId !== null && $encounterId > 0 ? $encounterId : null,
            'charges_amount' => round($charges, 2),
            'currency_symbol' => $currencySymbol,
        ];
    }

    /**
     * M14 — receipt reprint from Billing back office (no chart-depth finance gate).
     *
     * @return array<string, mixed>
     */
    public function getReceiptReprintForBillOps(int $receiptId, int $pid, int $actorUserId): array
    {
        (new BillOpsAccessService())->assertPaymentAccess();
        $this->facilityScope->assertPatientAccessible($pid);
        if (!$this->canReprintReceipt()) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $receipt = $this->loadReceiptRow($receiptId, $pid);
        $patient = $this->fetchPatientIdentity($pid);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'bill_ops',
            $actorUserId,
            1,
            'bill_ops.receipt_reprinted receipt_id=' . $receiptId . ' pid=' . $pid
        );

        return [
            'receipt' => [
                'receipt_number' => (string) ($receipt['receipt_number'] ?? ''),
                'queue_number' => (int) ($receipt['queue_number'] ?? 0),
                'amount_paid' => round((float) ($receipt['amount_paid'] ?? 0), 2),
                'change_due' => round((float) ($receipt['change_due'] ?? 0), 2),
                'paid_at_label' => $this->formatDateTime((string) ($receipt['created_at'] ?? '')),
            ],
            'patient' => $patient,
        ];
    }

    private function normalizeFilter(string $filter, ?int $visitId): string
    {
        if ($filter === 'this_visit' && ($visitId === null || $visitId <= 0)) {
            return 'all_visits';
        }

        if ($filter === 'date_range') {
            return 'date_range';
        }

        return $filter === 'this_visit' ? 'this_visit' : 'all_visits';
    }

    private function normalizeDate(?string $date): ?string
    {
        $date = trim((string) $date);
        if ($date === '') {
            return null;
        }

        try {
            $parsed = new \DateTime($date);
        } catch (\Exception) {
            return null;
        }

        return $parsed->format('Y-m-d');
    }

    /**
     * @param array<int, array<string, mixed>> $timeline
     *
     * @return array<int, array<string, mixed>>
     */
    private function filterTimelineByDate(array $timeline, ?string $dateFrom, ?string $dateTo): array
    {
        if ($dateFrom === null && $dateTo === null) {
            return $timeline;
        }

        $fromTs = $dateFrom !== null ? strtotime($dateFrom . ' 00:00:00') : null;
        $toTs = $dateTo !== null ? strtotime($dateTo . ' 23:59:59') : null;

        return array_values(array_filter($timeline, static function (array $row) use ($fromTs, $toTs): bool {
            $ts = strtotime((string) ($row['occurred_at'] ?? '')) ?: 0;
            if ($fromTs !== false && $fromTs !== null && $ts < $fromTs) {
                return false;
            }
            if ($toTs !== false && $toTs !== null && $ts > $toTs) {
                return false;
            }

            return true;
        }));
    }

    /**
     * @return array{visit_id: ?int, encounter_id: ?int, queue_number: ?int, visit_date: ?string, scoped: bool}
     */
    private function resolveScope(int $pid, ?int $visitId, string $filter): array
    {
        if ($filter !== 'this_visit' || $visitId === null || $visitId <= 0) {
            return [
                'visit_id' => null,
                'encounter_id' => null,
                'queue_number' => null,
                'visit_date' => null,
                'scoped' => false,
            ];
        }

        $visit = QueryUtils::querySingleRow(
            'SELECT id, encounter, queue_number, visit_date FROM new_visit WHERE id = ? AND pid = ? LIMIT 1',
            [$visitId, $pid]
        );
        if (!is_array($visit)) {
            throw new \RuntimeException('Visit not found', 404);
        }

        $encounterId = (int) ($visit['encounter'] ?? 0);

        return [
            'visit_id' => (int) ($visit['id'] ?? 0),
            'encounter_id' => $encounterId > 0 ? $encounterId : null,
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'visit_date' => (string) ($visit['visit_date'] ?? ''),
            'scoped' => true,
        ];
    }

    /**
     * @param array{visit_id: ?int, encounter_id: ?int, queue_number: ?int, visit_date: ?string, scoped: bool} $scope
     * @return array<int, array<string, mixed>>
     */
    private function buildTimeline(int $pid, array $scope): array
    {
        $encounterId = $scope['encounter_id'];
        $visitId = $scope['visit_id'];

        $charges = $this->fetchChargeEvents($pid, $encounterId);
        $payments = $this->fetchPaymentEvents($pid, $visitId, $encounterId);
        $adjustments = $this->fetchAdjustmentEvents($pid, $encounterId);
        $merged = array_merge($charges, $payments, $adjustments);

        usort($merged, function (array $a, array $b): int {
            $at = strtotime((string) ($a['occurred_at'] ?? '')) ?: 0;
            $bt = strtotime((string) ($b['occurred_at'] ?? '')) ?: 0;
            if ($at === $bt) {
                return ((int) ($b['sort_id'] ?? 0)) <=> ((int) ($a['sort_id'] ?? 0));
            }

            return $bt <=> $at;
        });

        if (count($merged) > self::TIMELINE_CAP) {
            $merged = array_slice($merged, 0, self::TIMELINE_CAP);
        }

        return $merged;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchChargeEvents(int $pid, ?int $encounterId): array
    {
        $bind = [$pid];
        $encounterFilter = '';
        if ($encounterId !== null && $encounterId > 0) {
            $encounterFilter = ' AND b.encounter = ?';
            $bind[] = $encounterId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT b.id, b.date, b.fee, b.units, b.code_text, b.code, b.encounter,
                    v.id AS visit_id, v.queue_number, v.visit_date
             FROM billing b
             LEFT JOIN new_visit v ON v.pid = b.pid AND v.encounter = b.encounter
             WHERE b.pid = ? AND b.activity = 1{$encounterFilter}
             ORDER BY b.date DESC, b.id DESC
             LIMIT " . self::TIMELINE_CAP,
            $bind
        ) ?: [];

        $events = [];
        foreach ($rows as $row) {
            $units = max(1, (int) ($row['units'] ?? 1));
            $amount = round((float) ($row['fee'] ?? 0) * $units, 2);
            $label = trim((string) ($row['code_text'] ?? ''));
            if ($label === '') {
                $label = trim((string) ($row['code'] ?? '')) ?: 'Charge';
            }

            $events[] = [
                'type' => 'charge',
                'occurred_at' => (string) ($row['date'] ?? ''),
                'label' => $label,
                'amount' => $amount,
                'receipt_id' => null,
                'receipt_number' => null,
                'visit_id' => (int) ($row['visit_id'] ?? 0) ?: null,
                'encounter_id' => (int) ($row['encounter'] ?? 0) ?: null,
                'queue_number' => (int) ($row['queue_number'] ?? 0) ?: null,
                'visit_date' => (string) ($row['visit_date'] ?? ''),
                'cashier' => null,
                'sort_id' => (int) ($row['id'] ?? 0),
            ];
        }

        return $events;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchPaymentEvents(int $pid, ?int $visitId, ?int $encounterId): array
    {
        $bind = [$pid];
        $filters = '';
        if ($visitId !== null && $visitId > 0) {
            $filters .= ' AND r.visit_id = ?';
            $bind[] = $visitId;
        } elseif ($encounterId !== null && $encounterId > 0) {
            $filters .= ' AND r.encounter = ?';
            $bind[] = $encounterId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT r.id, r.receipt_number, r.amount_paid, r.change_due, r.created_at, r.receipt_note,
                    r.visit_id, r.encounter, v.queue_number, v.visit_date,
                    u.fname, u.lname, s.payment_method, s.reference
             FROM new_receipt r
             LEFT JOIN new_visit v ON v.id = r.visit_id
             LEFT JOIN users u ON u.id = r.actor_user_id
             LEFT JOIN ar_session s ON s.session_id = r.posted_payment_id
             WHERE r.pid = ?{$filters}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT " . self::TIMELINE_CAP,
            $bind
        ) ?: [];

        $events = [];
        foreach ($rows as $row) {
            $cashier = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));
            $paymentMethod = trim((string) ($row['payment_method'] ?? 'cash'));
            $reference = trim((string) ($row['reference'] ?? ''));
            $receiptNote = trim((string) ($row['receipt_note'] ?? ''));

            $events[] = [
                'type' => 'payment',
                'occurred_at' => (string) ($row['created_at'] ?? ''),
                'label' => $this->buildPaymentLabel($paymentMethod, $reference, $receiptNote),
                'amount' => round((float) ($row['amount_paid'] ?? 0), 2),
                'receipt_id' => (int) ($row['id'] ?? 0),
                'receipt_number' => (string) ($row['receipt_number'] ?? ''),
                'visit_id' => (int) ($row['visit_id'] ?? 0) ?: null,
                'encounter_id' => (int) ($row['encounter'] ?? 0) ?: null,
                'queue_number' => (int) ($row['queue_number'] ?? 0) ?: null,
                'visit_date' => (string) ($row['visit_date'] ?? ''),
                'cashier' => $cashier !== '' ? $cashier : null,
                'payment_method' => $paymentMethod,
                'sort_id' => (int) ($row['id'] ?? 0),
            ];
        }

        return $events;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchAdjustmentEvents(int $pid, ?int $encounterId): array
    {
        if (!$this->canViewAdjustments()) {
            return [];
        }

        $bind = [$pid];
        $encounterFilter = '';
        if ($encounterId !== null && $encounterId > 0) {
            $encounterFilter = ' AND aa.encounter = ?';
            $bind[] = $encounterId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT aa.post_time, aa.adj_amount, aa.memo, aa.account_code, aa.encounter,
                    v.id AS visit_id, v.queue_number, v.visit_date,
                    u.fname, u.lname
             FROM ar_activity aa
             LEFT JOIN new_visit v ON v.pid = aa.pid AND v.encounter = aa.encounter
             LEFT JOIN users u ON u.id = aa.post_user
             WHERE aa.pid = ? AND aa.deleted IS NULL AND aa.adj_amount <> 0{$encounterFilter}
             ORDER BY aa.post_time DESC
             LIMIT " . self::TIMELINE_CAP,
            $bind
        ) ?: [];

        $events = [];
        foreach ($rows as $row) {
            $actor = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));
            $memo = trim((string) ($row['memo'] ?? ''));
            $label = $memo !== '' ? $memo : 'Adjustment';

            $events[] = [
                'type' => 'adjustment',
                'occurred_at' => (string) ($row['post_time'] ?? ''),
                'label' => $label,
                'amount' => round((float) ($row['adj_amount'] ?? 0), 2),
                'receipt_id' => null,
                'receipt_number' => null,
                'visit_id' => (int) ($row['visit_id'] ?? 0) ?: null,
                'encounter_id' => (int) ($row['encounter'] ?? 0) ?: null,
                'queue_number' => (int) ($row['queue_number'] ?? 0) ?: null,
                'visit_date' => (string) ($row['visit_date'] ?? ''),
                'cashier' => $actor !== '' ? $actor : null,
                'sort_id' => (int) strtotime((string) ($row['post_time'] ?? '')),
            ];
        }

        return $events;
    }

    private function buildPaymentLabel(string $paymentMethod, string $reference, string $receiptNote): string
    {
        $method = strtolower(trim($paymentMethod));
        if ($method === 'momo' || str_contains($method, 'mobile')) {
            $ref = $reference !== '' ? $reference : $receiptNote;

            return $ref !== '' ? 'MoMo · Ref: ' . $ref : 'MoMo';
        }

        if ($method !== '' && $method !== 'cash') {
            return ucfirst($method) . ' payment';
        }

        return 'Cash payment';
    }

    private function canViewAdjustments(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_cashier_lead')
            || AclMain::aclCheckCore('new_clinic', 'new_admin')
            || AclMain::aclCheckCore('acct', 'rep')
            || AclMain::aclCheckCore('acct', 'bill');
    }

    /**
     * @param array{visit_id: ?int, encounter_id: ?int, queue_number: ?int, visit_date: ?string, scoped: bool} $scope
     * @return array<string, mixed>
     */
    private function buildSummary(int $pid, array $scope): array
    {
        $encounterId = $scope['encounter_id'];
        $charges = 0.0;
        $paid = 0.0;

        if ($encounterId !== null && $encounterId > 0) {
            $chargesRow = QueryUtils::querySingleRow(
                'SELECT COALESCE(SUM(fee * GREATEST(units, 1)), 0) AS total
                 FROM billing WHERE pid = ? AND encounter = ? AND activity = 1',
                [$pid, $encounterId]
            );
            $charges = is_array($chargesRow) ? (float) ($chargesRow['total'] ?? 0) : 0.0;

            $paidRow = QueryUtils::querySingleRow(
                "SELECT COALESCE(SUM(pay_amount), 0) AS paid
                 FROM ar_activity
                 WHERE pid = ? AND encounter = ? AND account_code = 'PP'",
                [$pid, $encounterId]
            );
            $paid = is_array($paidRow) ? (float) ($paidRow['paid'] ?? 0) : 0.0;
        }

        $lastReceipt = null;
        if ($scope['visit_id'] !== null && $scope['visit_id'] > 0) {
            $receiptRow = QueryUtils::querySingleRow(
                "SELECT r.id, r.receipt_number, r.created_at, u.fname, u.lname
                 FROM new_receipt r
                 LEFT JOIN users u ON u.id = r.actor_user_id
                 WHERE r.pid = ? AND r.visit_id = ?
                 ORDER BY r.created_at DESC, r.id DESC
                 LIMIT 1",
                [$pid, $scope['visit_id']]
            );
            if (is_array($receiptRow)) {
                $cashier = trim(trim((string) ($receiptRow['fname'] ?? '')) . ' ' . trim((string) ($receiptRow['lname'] ?? '')));
                $lastReceipt = [
                    'id' => (int) ($receiptRow['id'] ?? 0),
                    'receipt_number' => (string) ($receiptRow['receipt_number'] ?? ''),
                    'at' => (string) ($receiptRow['created_at'] ?? ''),
                    'at_label' => $this->formatDateTime((string) ($receiptRow['created_at'] ?? '')),
                    'cashier' => $cashier !== '' ? $cashier : null,
                ];
            }
        }

        $balance = max(0.0, round($charges - $paid, 2));

        return [
            'charges_amount' => round($charges, 2),
            'paid_amount' => round($paid, 2),
            'balance_amount' => $balance,
            'last_receipt' => $lastReceipt,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapTimelineRow(array $row, bool $canReprint): array
    {
        $type = (string) ($row['type'] ?? '');
        $isPayment = $type === 'payment';
        $isAdjustment = $type === 'adjustment';

        return [
            'type' => $type,
            'occurred_at' => (string) ($row['occurred_at'] ?? ''),
            'occurred_at_label' => $this->formatDateTime((string) ($row['occurred_at'] ?? '')),
            'label' => (string) ($row['label'] ?? ''),
            'amount' => round((float) ($row['amount'] ?? 0), 2),
            'receipt_id' => $isPayment ? (int) ($row['receipt_id'] ?? 0) : null,
            'receipt_number' => $isPayment ? (string) ($row['receipt_number'] ?? '') : null,
            'visit_id' => $row['visit_id'] ?? null,
            'encounter_id' => $row['encounter_id'] ?? null,
            'queue_number' => $row['queue_number'] ?? null,
            'visit_date' => $row['visit_date'] ?? null,
            'cashier' => $row['cashier'] ?? null,
            'payment_method' => $isPayment ? (string) ($row['payment_method'] ?? 'cash') : null,
            'can_reprint' => $isPayment && $canReprint && (int) ($row['receipt_id'] ?? 0) > 0,
            // Legacy receipt-table fields for older clients
            'amount_paid' => $isPayment ? round((float) ($row['amount'] ?? 0), 2) : null,
            'paid_at_label' => $isPayment ? $this->formatDateTime((string) ($row['occurred_at'] ?? '')) : null,
            'is_adjustment' => $isAdjustment,
        ];
    }

    /**
     * @return array{display_name: string, pubpid: string}
     */
    private function fetchPatientIdentity(int $pid): array
    {
        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid FROM patient_data WHERE pid = ? LIMIT 1',
            [$pid]
        );
        if (!is_array($row)) {
            return ['display_name' => '', 'pubpid' => ''];
        }

        $name = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));

        return [
            'display_name' => $name,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadReceiptRow(int $receiptId, int $pid): array
    {
        if ($receiptId <= 0) {
            throw new \InvalidArgumentException('Receipt id is required');
        }

        $row = QueryUtils::querySingleRow(
            "SELECT r.*, v.queue_number
             FROM new_receipt r
             LEFT JOIN new_visit v ON v.id = r.visit_id
             WHERE r.id = ? AND r.pid = ?
             LIMIT 1",
            [$receiptId, $pid]
        );
        if (!is_array($row)) {
            throw new \RuntimeException('Receipt not found', 404);
        }

        return $row;
    }

    private function canReprintReceipt(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_receipt_reprint')
            || AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance');
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
