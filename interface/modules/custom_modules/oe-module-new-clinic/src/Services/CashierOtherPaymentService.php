<?php

/**
 * CP-2 — deposits and other payments outside the checkout queue.
 *
 * Replaces the stock front_payment.php escape for the two money shapes the
 * native cashier could not record:
 *   - deposit / prepayment: no visit, posted exactly like the stock prepayment
 *     (ar_session + payments via frontPayment; deliberately NO ar_activity —
 *     stock parity, and the daily reconciliation joins receipts to visits on
 *     both sides so deposits stay out of BOTH totals symmetrically);
 *   - payment against a past visit (completed/closed_unpaid with money owed):
 *     posted like checkout (ar_session + ar_activity 'PP' + payments). The
 *     bill-ops outstanding list computes owed from receipts, so a settled
 *     visit drops off it without any queue-state transition.
 *
 * Both shapes issue a normal new_receipt row (deposits with visit_id NULL) so
 * they appear in payment history / bill-ops search and can be reversed there.
 * Everything is gated by `enable_cashier_other_payments` (default OFF) plus
 * the `new_cashier_other_payment` ACL (granted to cashier leads + admin).
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

class CashierOtherPaymentService
{
    private const MAX_AMOUNT = 999999.99;
    private const PAYABLE_VISITS_LIMIT = 10;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
    ) {
    }

    /**
     * Modal context: patient label, that patient's payable past visits, and
     * the clinic's payment options.
     *
     * @return array<string, mixed>
     */
    public function getContext(int $pid): array
    {
        $facilityId = $this->assertEnabledAndAllowed();
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
        $this->facilityScope->assertPatientAccessible($pid);

        $patient = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid FROM patient_data WHERE pid = ? LIMIT 1',
            [$pid]
        ) ?: [];
        $label = trim(trim((string) ($patient['lname'] ?? '') . ', ' . (string) ($patient['fname'] ?? '')), ', ');
        $pubpid = (string) ($patient['pubpid'] ?? '');

        return [
            'pid' => $pid,
            'patient_label' => $label . ($pubpid !== '' ? ' · MRN ' . $pubpid : ''),
            'payable_visits' => $this->listPayableVisits($pid, $facilityId),
            'momo_enabled' => $this->config->getInt('enable_momo_payment', 0, $facilityId) === 1,
            'currency_symbol' => (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵'),
        ];
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function post(array $body, int $actorUserId): array
    {
        $facilityId = $this->assertEnabledAndAllowed();

        $pid = (int) ($body['pid'] ?? 0);
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
        $this->facilityScope->assertPatientAccessible($pid);

        $type = (string) ($body['type'] ?? '');
        if (!in_array($type, ['deposit', 'visit'], true)) {
            throw new \InvalidArgumentException('Unknown payment type');
        }

        $amount = self::validateAmount($body['amount'] ?? null);
        [$method, $reference] = $this->resolveMethod(
            (string) ($body['method'] ?? 'cash'),
            (string) ($body['reference'] ?? ''),
            $facilityId
        );
        $note = mb_substr(trim((string) ($body['note'] ?? '')), 0, 255);

        $visitId = null;
        $encounter = 0;
        if ($type === 'visit') {
            $visit = $this->loadPayableVisit($pid, (int) ($body['visit_id'] ?? 0), $facilityId);
            $visitId = (int) $visit['visit_id'];
            $encounter = (int) $visit['encounter'];
            if ($amount > ((float) $visit['owed']) + 0.001) {
                throw new \InvalidArgumentException(
                    'Amount is more than what this visit still owes — record the extra as a deposit instead'
                );
            }
        }

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';
        require_once dirname(__DIR__, 6) . '/library/payment.inc.php';

        sqlBeginTrans();
        $committed = false;
        try {
            $descriptionPrefix = $type === 'deposit' ? 'New Clinic deposit' : 'New Clinic balance payment';
            $description = $method === 'momo'
                ? $descriptionPrefix . ' · MoMo · Ref: ' . $reference
                : $descriptionPrefix;

            $sessionId = sqlInsert(
                "INSERT INTO ar_session SET payer_id = 0, patient_id = ?, user_id = ?, closed = 0,
                 reference = ?, check_date = NOW(), deposit_date = NOW(), pay_total = ?,
                 payment_type = 'patient', description = ?, adjustment_code = 'patient_payment',
                 post_to_date = NOW(), payment_method = ?",
                [$pid, $actorUserId, $reference, $amount, $description, $method]
            );

            if ($type === 'visit') {
                // Same 3-table shape as checkout so the encounter's paid total
                // (ar_activity 'PP') and the outstanding list stay truthful.
                $sequence = QueryUtils::querySingleRow(
                    'SELECT IFNULL(MAX(sequence_no), 0) + 1 AS seq FROM ar_activity WHERE pid = ? AND encounter = ?',
                    [$pid, $encounter]
                );
                sqlInsert(
                    "INSERT INTO ar_activity (pid, encounter, sequence_no, code_type, code, modifier, payer_type,
                     post_time, post_user, session_id, pay_amount, account_code)
                     VALUES (?, ?, ?, '', '', '', 0, NOW(), ?, ?, ?, 'PP')",
                    [$pid, $encounter, (int) ($sequence['seq'] ?? 1), $actorUserId, $sessionId, $amount]
                );
            }
            // Deposit shape: stock front_payment prepayment parity — ar_session +
            // payments only, no ar_activity (there is no encounter to post against).

            $paymentId = (int) frontPayment(
                $pid,
                $encounter,
                $method,
                $reference,
                $type === 'deposit' ? $amount : 0,
                $type === 'deposit' ? 0 : $amount,
                date('Y-m-d H:i:s')
            );

            $receiptNumber = (new ReceiptNumberService($this->visitScope))->allocate($facilityId);
            QueryUtils::sqlInsert(
                "INSERT INTO new_receipt
                 (facility_id, receipt_number, visit_id, pid, encounter, amount_paid, change_due, receipt_note, actor_user_id, posted_payment_id)
                 VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?)",
                [
                    $facilityId,
                    $receiptNumber,
                    $visitId,
                    $pid,
                    $encounter,
                    $amount,
                    $note !== ''
                        ? $note
                        : ($type === 'deposit' ? 'Deposit' : 'Balance payment'),
                    $actorUserId,
                    $paymentId > 0 ? $paymentId : null,
                ]
            );

            sqlCommitTrans(true);
            $committed = true;
        } catch (\Throwable $e) {
            if (!$committed) {
                sqlCommitTrans(false);
            }
            throw $e;
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'cashier',
            $actorUserId,
            1,
            'cashier.other_payment type=' . $type
                . ' pid=' . $pid
                . ($visitId !== null ? ' visit_id=' . $visitId : '')
                . ' amount=' . $amount
                . ' method=' . $method
        );

        return [
            'receipt_number' => $receiptNumber,
            'type' => $type,
            'visit_id' => $visitId,
            'amount' => $amount,
            'method' => $method,
            'paid_at' => date('c'),
        ];
    }

    /**
     * Amount validation — pure and unit-testable.
     */
    public static function validateAmount(mixed $raw): float
    {
        if (!is_numeric($raw)) {
            throw new \InvalidArgumentException('Amount is required');
        }
        $amount = round((float) $raw, 2);
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Amount must be more than zero');
        }
        if ($amount > self::MAX_AMOUNT) {
            throw new \InvalidArgumentException('Amount is too large');
        }

        return $amount;
    }

    /**
     * @return array{0: string, 1: string} [method, reference]
     */
    private function resolveMethod(string $method, string $reference, int $facilityId): array
    {
        $method = strtolower(trim($method)) === 'momo' ? 'momo' : 'cash';
        $reference = mb_substr(trim($reference), 0, 255);

        if ($method === 'momo') {
            if ($this->config->getInt('enable_momo_payment', 0, $facilityId) !== 1) {
                throw new \InvalidArgumentException('MoMo payments are not enabled for this clinic');
            }
            if ($reference === '') {
                throw new \InvalidArgumentException('MoMo reference is required');
            }
        } elseif ($reference === '') {
            $reference = 'New Clinic cashier';
        }

        return [$method, $reference];
    }

    /**
     * The patient's past visits that still owe money (bounded).
     *
     * @return array<int, array<string, mixed>>
     */
    private function listPayableVisits(int $pid, int $facilityId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, v.encounter, v.visit_date, v.queue_number, v.state,
                    COALESCE(charges.total, 0) AS charges_total,
                    COALESCE(paid.total, 0) AS paid_total
             FROM new_visit v
             LEFT JOIN (
                 SELECT b.pid, b.encounter, SUM(b.fee) AS total
                 FROM billing b
                 WHERE b.pid = ? AND b.activity = 1
                 GROUP BY b.pid, b.encounter
             ) charges ON charges.pid = v.pid AND charges.encounter = v.encounter
             LEFT JOIN (
                 SELECT r.visit_id, SUM(CASE WHEN r.reversed_at IS NULL THEN r.amount_paid ELSE 0 END) AS total
                 FROM new_receipt r
                 WHERE r.pid = ?
                 GROUP BY r.visit_id
             ) paid ON paid.visit_id = v.id
             WHERE v.pid = ? AND v.facility_id = ?
             AND v.state IN ('completed', 'closed_unpaid')
             AND COALESCE(charges.total, 0) > COALESCE(paid.total, 0) + 0.001
             ORDER BY v.visit_date DESC, v.id DESC
             LIMIT " . self::PAYABLE_VISITS_LIMIT,
            [$pid, $pid, $pid, $facilityId]
        ) ?: [];

        return array_map(static fn (array $row): array => [
            'visit_id' => (int) ($row['visit_id'] ?? 0),
            'encounter' => (int) ($row['encounter'] ?? 0),
            'visit_date' => (string) ($row['visit_date'] ?? ''),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'state' => (string) ($row['state'] ?? ''),
            'owed' => round(max((float) ($row['charges_total'] ?? 0) - (float) ($row['paid_total'] ?? 0), 0), 2),
        ], $rows);
    }

    /**
     * @return array<string, mixed>
     */
    private function loadPayableVisit(int $pid, int $visitId, int $facilityId): array
    {
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('Visit is required');
        }
        foreach ($this->listPayableVisits($pid, $facilityId) as $visit) {
            if ((int) $visit['visit_id'] === $visitId) {
                return $visit;
            }
        }

        throw new \InvalidArgumentException('Visit not found or has nothing owing');
    }

    /**
     * Protected (not private) as a test seam — same pattern as the referral
     * service's assertCanManage.
     *
     * @return int resolved facility id
     */
    protected function assertEnabledAndAllowed(): int
    {
        $facilityId = $this->visitScope->resolveActorFacilityId(null);
        if ($this->config->getInt('enable_cashier_other_payments', 0, $facilityId) !== 1) {
            throw new \RuntimeException('Deposits / other payments are not enabled for this clinic', 403);
        }
        if (
            !AclMain::aclCheckCore('new_clinic', 'new_cashier_other_payment')
            && !AclMain::aclCheckCore('new_clinic', 'new_admin')
        ) {
            throw new \RuntimeException('Forbidden', 403);
        }

        return $facilityId;
    }
}
