<?php

/**
 * M14-F02 — payment search and reversal
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Support\Sanitize;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Common\Acl\AclMain;

class BillOpsPaymentsSearchService
{
    public const PAGE_SIZE = 25;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly BillOpsAccessService $access = new BillOpsAccessService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function search(string $query, ?string $dateFrom, ?string $dateTo, int $offset = 0, int $limit = self::PAGE_SIZE): array
    {
        $this->access->assertPaymentAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);

        $dateFrom = $this->normalizeOptionalDate($dateFrom) ?? date('Y-m-d');
        $dateTo = $this->normalizeOptionalDate($dateTo) ?? $dateFrom;
        if ($dateFrom > $dateTo) {
            throw new \InvalidArgumentException('date_from cannot be after date_to');
        }

        $query = Sanitize::searchToken($query);
        $bind = [$facilityId, $dateFrom, $dateTo . ' 23:59:59'];
        $searchSql = '';

        if ($query !== '') {
            $like = '%' . $query . '%';
            if (ctype_digit($query)) {
                $searchSql = ' AND (
                    r.receipt_number LIKE ?
                    OR r.id = ?
                    OR v.queue_number = ?
                    OR pd.pubpid LIKE ?
                    OR pd.pid = ?
                )';
                $bind[] = $like;
                $bind[] = (int) $query;
                $bind[] = (int) $query;
                $bind[] = $like;
                $bind[] = (int) $query;
            } else {
                $searchSql = ' AND (
                    r.receipt_number LIKE ?
                    OR pd.fname LIKE ?
                    OR pd.lname LIKE ?
                    OR CONCAT(pd.fname, " ", pd.lname) LIKE ?
                    OR pd.pubpid LIKE ?
                )';
                $bind[] = $like;
                $bind[] = $like;
                $bind[] = $like;
                $bind[] = $like;
                $bind[] = $like;
            }
        }

        $countRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM new_receipt r
             INNER JOIN new_visit v ON v.id = r.visit_id
             INNER JOIN patient_data pd ON pd.pid = r.pid
             WHERE r.facility_id = ?
             AND r.created_at >= ? AND r.created_at <= ?
             {$searchSql}",
            $bind
        );
        $total = is_array($countRow) ? (int) ($countRow['cnt'] ?? 0) : 0;

        $listBind = $bind;
        $rows = QueryUtils::fetchRecords(
            "SELECT r.id, r.receipt_number, r.amount_paid, r.change_due, r.created_at,
                    r.reversed_at, r.reversal_reason, r.visit_id, r.pid, r.encounter,
                    r.posted_payment_id, v.queue_number, v.visit_date, v.state AS visit_state,
                    pd.fname, pd.lname, pd.pubpid,
                    u.fname AS cashier_fname, u.lname AS cashier_lname
             FROM new_receipt r
             INNER JOIN new_visit v ON v.id = r.visit_id
             INNER JOIN patient_data pd ON pd.pid = r.pid
             LEFT JOIN users u ON u.id = r.actor_user_id
             WHERE r.facility_id = ?
             AND r.created_at >= ? AND r.created_at <= ?
             {$searchSql}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $listBind
        ) ?: [];

        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');

        return [
            'currency_symbol' => $currencySymbol,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'query' => $query,
            'rows' => array_map(fn (array $row): array => $this->mapRow($row), $rows),
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($rows)) < $total,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function reverse(int $receiptId, string $reason, int $actorUserId): array
    {
        $this->access->assertPaymentAccess();
        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('Reason is required');
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $receipt = QueryUtils::querySingleRow(
            "SELECT r.*, v.state AS visit_state, v.row_version AS visit_version
             FROM new_receipt r
             INNER JOIN new_visit v ON v.id = r.visit_id
             WHERE r.id = ? AND r.facility_id = ?",
            [$receiptId, $facilityId]
        );

        if (!is_array($receipt) || empty($receipt['id'])) {
            throw new \RuntimeException('Receipt not found', 404);
        }

        if (!empty($receipt['reversed_at'])) {
            throw new \InvalidArgumentException('Payment was already reversed');
        }

        $amount = round((float) ($receipt['amount_paid'] ?? 0), 2);
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Receipt has no amount to reverse');
        }

        $pid = (int) ($receipt['pid'] ?? 0);
        $encounter = (int) ($receipt['encounter'] ?? 0);
        $visitId = (int) ($receipt['visit_id'] ?? 0);

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';
        require_once dirname(__DIR__, 6) . '/library/payment.inc.php';

        sqlBeginTrans();
        $committed = false;
        try {
            $reference = 'Bill ops reversal: ' . mb_substr($reason, 0, 200);

            $sessionId = sqlInsert(
                "INSERT INTO ar_session SET payer_id = 0, patient_id = ?, user_id = ?, closed = 0,
                 reference = ?, check_date = NOW(), deposit_date = NOW(), pay_total = ?,
                 payment_type = 'patient', description = ?, adjustment_code = 'patient_payment',
                 post_to_date = NOW(), payment_method = 'cash'",
                [$pid, $actorUserId, $reference, -$amount, $reference]
            );

            $sequence = QueryUtils::querySingleRow(
                "SELECT IFNULL(MAX(sequence_no), 0) + 1 AS seq FROM ar_activity WHERE pid = ? AND encounter = ?",
                [$pid, $encounter]
            );

            sqlInsert(
                "INSERT INTO ar_activity (pid, encounter, sequence_no, code_type, code, modifier, payer_type,
                 post_time, post_user, session_id, pay_amount, account_code)
                 VALUES (?, ?, ?, '', '', '', 0, NOW(), ?, ?, ?, 'PP')",
                [
                    $pid,
                    $encounter,
                    (int) ($sequence['seq'] ?? 1),
                    $actorUserId,
                    $sessionId,
                    -$amount,
                ]
            );

            frontPayment($pid, $encounter, 'cash', $reference, 0, -$amount, date('Y-m-d H:i:s'));

            sqlStatement(
                "UPDATE new_receipt
                 SET reversed_at = NOW(), reversal_reason = ?, reversal_actor_user_id = ?
                 WHERE id = ?",
                [mb_substr($reason, 0, 255), $actorUserId, $receiptId]
            );

            sqlCommitTrans(true);
            $committed = true;
        } catch (\Throwable $e) {
            if (!$committed) {
                sqlCommitTrans(false);
            }
            throw $e;
        }

        if ($this->config->getInt('bill_ops_reopen_on_correction', 0, $facilityId) === 1
            && ($receipt['visit_state'] ?? '') === 'completed') {
            try {
                $this->queueService->transition(
                    $visitId,
                    'ready_for_payment',
                    $actorUserId,
                    (int) ($receipt['visit_version'] ?? 0),
                    'bill_ops_payment_reversed'
                );
            } catch (\Throwable) {
                /* reopen is best-effort when version drifted */
            }
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'bill_ops.payment_reversed',
            $actorUserId,
            1,
            'receipt_id=' . $receiptId . ' visit_id=' . $visitId
        );

        return [
            'receipt_id' => $receiptId,
            'reversed' => true,
            'amount_reversed' => $amount,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        $cashier = trim(trim((string) ($row['cashier_fname'] ?? '')) . ' ' . trim((string) ($row['cashier_lname'] ?? '')));
        $patient = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));

        return [
            'id' => (int) ($row['id'] ?? 0),
            'receipt_number' => (string) ($row['receipt_number'] ?? ''),
            'amount_paid' => round((float) ($row['amount_paid'] ?? 0), 2),
            'change_due' => round((float) ($row['change_due'] ?? 0), 2),
            'paid_at' => (string) ($row['created_at'] ?? ''),
            'reversed_at' => !empty($row['reversed_at']) ? (string) $row['reversed_at'] : null,
            'reversal_reason' => !empty($row['reversal_reason']) ? (string) $row['reversal_reason'] : null,
            'visit_id' => (int) ($row['visit_id'] ?? 0),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'visit_date' => (string) ($row['visit_date'] ?? ''),
            'visit_state' => (string) ($row['visit_state'] ?? ''),
            'pid' => (int) ($row['pid'] ?? 0),
            'encounter' => (int) ($row['encounter'] ?? 0),
            'posted_payment_id' => (int) ($row['posted_payment_id'] ?? 0),
            'patient_name' => $patient,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'cashier' => $cashier !== '' ? $cashier : null,
            'can_reverse' => empty($row['reversed_at']),
            'can_reprint' => empty($row['reversed_at']) && $this->canReprintReceipt(),
        ];
    }

    private function canReprintReceipt(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_receipt_reprint')
            || AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance');
    }

    private function normalizeOptionalDate(?string $date): ?string
    {
        if ($date === null || trim($date) === '') {
            return null;
        }

        $date = trim($date);
        $parsed = \DateTime::createFromFormat('Y-m-d', $date);
        if (!$parsed || $parsed->format('Y-m-d') !== $date) {
            throw new \InvalidArgumentException('Invalid date');
        }

        return $date;
    }
}
