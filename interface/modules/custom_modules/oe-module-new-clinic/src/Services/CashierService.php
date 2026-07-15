<?php

/**
 * Cashier desk payment queue and checkout (M5)
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

class CashierService
{
    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly VisitBoardService $boardService = new VisitBoardService(),
        private readonly PatientContextService $patientContextService = new PatientContextService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly ClinicConfigService $configService = new ClinicConfigService(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly RevisitCompletionGateService $revisitGate = new RevisitCompletionGateService(),
        private readonly CashierChargeService $chargeService = new CashierChargeService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly BillOpsAccessService $billOpsAccess = new BillOpsAccessService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getCashierQueue(int $facilityId, ?string $visitDate, int $actorUserId): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $visitDate = $visitDate ?? $this->clinicDate->today();
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $drugChargeExpr = $this->drugChargeSubquery($facilityId);
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label,
                       ((SELECT COALESCE(SUM(b.fee), 0)
                        FROM billing b
                        WHERE b.pid = v.pid AND b.encounter = v.encounter AND b.activity = 1)"
                        . $drugChargeExpr . ") AS charges_total
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ?
                AND v.state = 'ready_for_payment'
                ORDER BY v.is_urgent DESC, v.visit_date ASC, v.queue_number ASC, v.started_at ASC"
                . QueueLimits::limitClause(QueueLimits::QUEUE_HARD_CAP);

        $rows = QueryUtils::fetchRecords($sql, [$facilityId]) ?: [];
        [$rows, $queueTruncated] = QueueLimits::applyCap($rows, QueueLimits::QUEUE_HARD_CAP);
        $visits = array_map(function (array $row): array {
            $enriched = $row;
            $enriched['charges_total'] = round((float) ($row['charges_total'] ?? 0), 2);

            return $enriched;
        }, $this->rowEnricher->enrichVisitRows($rows));

        $doneToday = $this->fetchPaidToday($facilityId, $visitDate);
        $unpaidToday = $this->fetchClosedUnpaidToday($facilityId, $visitDate);

        return [
            'visits' => $visits,
            'queue_truncated' => $queueTruncated,
            'queue_cap' => QueueLimits::QUEUE_HARD_CAP,
            'counts' => [
                'waiting' => count($visits),
                'paid_today' => count($doneToday),
                'closed_unpaid' => count($unpaidToday),
            ],
            'visit_date' => $visitDate,
            'last_updated' => date('c'),
            'paid_today' => $doneToday,
            'closed_unpaid' => $unpaidToday,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function selectVisit(int $visitId, int $actorUserId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_payment') {
            throw new \InvalidArgumentException('Visit is not ready for payment');
        }

        $detail = $this->boardService->getVisitDetail($visitId, $actorUserId);
        $preview = $this->patientContextService->previewPayload(
            (int) $visit['pid'],
            $actorUserId,
            'cashier'
        );

        $charges = $this->getEncounterCharges((int) $visit['pid'], (int) $visit['encounter']);
        $completionGate = $this->assessCompletionGate((int) $visit['pid'], false);
        $picker = $this->chargeService->buildPickerPayload($visitId);
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        // CBILL-1 — fold dispensed medicines into the bill when pharmacy auto-bill is on.
        $drugCharges = $this->pharmacyAutoBillEnabled($facilityId)
            ? $this->getEncounterDrugCharges((int) $visit['pid'], (int) $visit['encounter'])
            : [];
        $advancedBilling = $this->billOpsAccess->advancedBillingLink(
            $visitId,
            (int) $visit['encounter'],
            $facilityId > 0 ? $facilityId : null
        );

        return [
            'visit' => $detail['visit'],
            'preview' => $preview,
            'charges' => $charges,
            'drug_charges' => $drugCharges,
            'charges_total' => round($this->sumCharges($charges) + $this->sumDrugCharges($drugCharges), 2),
            'fee_schedule' => $picker['fee_schedule'] ?? [],
            'suggested_fees' => $picker['suggested_fees'] ?? [],
            'completion_blocked' => $completionGate['blocked'],
            'can_skip_completion' => $completionGate['can_skip'],
            'can_close_without_charge' => $this->canCloseWithoutCharge(),
            'fee_sheet_url' => $this->feeSheetUrl((int) $visit['pid'], (int) $visit['encounter']),
            'advanced_billing_url' => $advancedBilling['url'],
            'advanced_billing_label' => $advancedBilling['label'],
            'advanced_billing_external' => $advancedBilling['external'],
            'front_payment_url' => $this->frontPaymentUrl((int) $visit['pid']),
            'encounter_signed' => $this->signService->isProfileSigned($visitId),
            'unsigned_message' => $this->signService->getProfileUnsignedReason($visitId),
            // Native consult page when the native engine is on (stock fallback inside).
            'encounter_url' => $this->signService->buildOpenUrlForVisit($visit),
            'can_apply_discount' => AclMain::aclCheckCore('new_clinic', 'new_discount'),
            'can_esign_override' => AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete'),
            'enable_momo_payment' => $this->configService->getInt('enable_momo_payment', 0, $facilityId) === 1,
        ];
    }

    /**
     * M1a-F15 — resolve payment-queue visits for a patient (never checkout by pid alone).
     *
     * @return array<string, mixed>
     */
    public function resolvePatientCheckout(int $pid, int $facilityId, int $actorUserId): array
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }

        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->visitScope->assertPatientAccessible($pid);

        $readySql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                            vt.label AS visit_type_label,
                            ((SELECT COALESCE(SUM(b.fee), 0)
                             FROM billing b
                             WHERE b.pid = v.pid AND b.encounter = v.encounter AND b.activity = 1)"
                             . $this->drugChargeSubquery($facilityId) . ") AS charges_total
                     FROM new_visit v
                     INNER JOIN patient_data pd ON pd.pid = v.pid
                     LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                     WHERE v.pid = ? AND v.facility_id = ?
                     AND v.state = 'ready_for_payment'
                     ORDER BY v.visit_date ASC, v.queue_number ASC";

        $readyRows = QueryUtils::fetchRecords($readySql, [$pid, $facilityId]) ?: [];
        $ready = array_map(function (array $row): array {
            $enriched = $this->rowEnricher->enrichVisitRow($row);
            $enriched['charges_total'] = round((float) ($row['charges_total'] ?? 0), 2);

            return $enriched;
        }, $readyRows);

        $terminal = VisitFsm::TERMINAL_STATES;
        $placeholders = implode(',', array_fill(0, count($terminal), '?'));
        $activeSql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, vt.label AS visit_type_label
                      FROM new_visit v
                      INNER JOIN patient_data pd ON pd.pid = v.pid
                      LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                      WHERE v.pid = ? AND v.facility_id = ?
                      AND v.state NOT IN ({$placeholders})
                      AND v.state <> 'ready_for_payment'
                      ORDER BY v.started_at DESC
                      LIMIT 5";
        $activeBind = array_merge([$pid, $facilityId], $terminal);
        $activeRows = QueryUtils::fetchRecords($activeSql, $activeBind) ?: [];
        $active = array_map(
            fn (array $row): array => $this->rowEnricher->enrichVisitRow($row),
            $activeRows
        );

        $preview = $this->patientContextService->previewPayload($pid, $actorUserId, 'cashier');

        $resolution = 'preview_only';
        $message = 'Not in payment queue — use Visit Board or reception.';
        if (count($ready) === 1) {
            $resolution = 'single';
            $message = '';
        } elseif (count($ready) > 1) {
            $resolution = 'pick_visit';
            $message = 'Multiple visits ready for payment — choose queue #.';
        } elseif (!empty($active)) {
            $resolution = 'not_ready';
            $message = 'Patient not ready for payment.';
        }

        return [
            'preview' => $preview,
            'ready_for_payment' => $ready,
            'active_visits' => $active,
            'resolution' => $resolution,
            'message' => $message,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function recordPayment(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        float $amountReceived,
        ?string $receiptNote = null,
        ?string $esignOverrideReason = null,
        ?string $completionOverrideReason = null,
        ?string $clientRequestId = null,
        ?string $paymentMethod = 'cash',
        ?string $momoReference = null,
    ): array {
        $clientRequestId = trim((string) ($clientRequestId ?? ''));
        if ($clientRequestId !== '') {
            $cached = $this->loadIdempotentPaymentResponse($clientRequestId);
            if ($cached !== null) {
                return $cached;
            }
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_payment') {
            throw new \InvalidArgumentException('Visit is not ready for payment');
        }

        $this->signService->assertProfileSigned($visitId, $esignOverrideReason);

        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $charges = $this->getEncounterCharges($pid, $encounter);
        // CBILL-1 — dispensed medicines count toward the amount due when auto-bill is on.
        $autoBillDrugs = $this->pharmacyAutoBillEnabled($facilityId);
        $drugCharges = $autoBillDrugs ? $this->getEncounterDrugCharges($pid, $encounter) : [];
        $totalDue = round($this->sumCharges($charges) + $this->sumDrugCharges($drugCharges), 2);

        if ($totalDue <= 0) {
            throw new \InvalidArgumentException('No charges on this visit — add fees before taking payment');
        }

        $method = $this->normalizePaymentMethod((string) ($paymentMethod ?? 'cash'), $facilityId);
        $paymentReference = $this->resolvePaymentReference(
            $method,
            $receiptNote,
            $momoReference
        );

        $completionGate = $this->assessCompletionGate($pid, true);
        if ($completionGate['blocked'] && !$completionGate['can_skip']) {
            $missing = implode(', ', $completionGate['missing_labels']);
            throw new \InvalidArgumentException(
                'Profile is ' . $completionGate['score'] . '% complete ('
                . $completionGate['threshold'] . '% required). Missing: ' . $missing
            );
        }

        if ($completionGate['blocked'] && $completionGate['can_skip']) {
            $overrideReason = trim((string) ($completionOverrideReason ?? ''));
            if ($overrideReason === '') {
                throw new \InvalidArgumentException(
                    'Profile incomplete — manager override reason is required before payment'
                );
            }

            $this->revisitGate->logCompletionOverride(
                $pid,
                $actorUserId,
                'billing',
                $completionGate,
                $overrideReason,
                $visitId
            );
        }

        if ($amountReceived <= 0) {
            throw new \InvalidArgumentException('Payment amount must be greater than zero');
        }

        if ($method === 'momo') {
            if (abs($amountReceived - $totalDue) > 0.001) {
                throw new \InvalidArgumentException('MoMo payment amount must match total due exactly');
            }
        } elseif ($amountReceived + 0.001 < $totalDue) {
            throw new \InvalidArgumentException('Amount received is less than total due');
        }

        if ($this->encounterHasPatientPayment($pid, $encounter)) {
            if ($visit['state'] === 'completed') {
                throw new \InvalidArgumentException('Payment already recorded for this visit');
            }

            $updated = $this->queueService->transition(
                $visitId,
                'completed',
                $actorUserId,
                $expectedVersion,
                'cash_payment_repair'
            );

            // Only mark medicines paid if the already-recorded payment actually covers the
            // full total (incl. drugs). A core front-payment that covered services only must
            // not silently flag the medicines as collected.
            if ($autoBillDrugs
                && $this->encounterPatientPaymentTotal($pid, $encounter) + 0.001 >= $totalDue) {
                $this->markDrugSalesBilled($pid, $encounter);
            }

            $response = $this->buildPaymentResponse($visit, $updated, $totalDue, $amountReceived);
            return $this->finalizePaymentResponse($response, $clientRequestId, $visitId, $actorUserId);
        }

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';

        sqlBeginTrans();
        $committed = false;
        try {
            $postedPaymentId = $this->postPatientPayment(
                $pid,
                $encounter,
                $totalDue,
                $actorUserId,
                $method,
                $paymentReference
            );
            $updated = $this->queueService->transition(
                $visitId,
                'completed',
                $actorUserId,
                $expectedVersion,
                $method === 'momo' ? 'momo_payment' : 'cash_payment'
            );
            if ($autoBillDrugs) {
                $this->markDrugSalesBilled($pid, $encounter);
            }
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
            'visit_id=' . $visitId . ' amount=' . $totalDue . ' method=' . $method
        );

        $receiptMeta = $this->issueReceipt(
            $visit,
            $totalDue,
            $amountReceived,
            $method === 'momo' ? $paymentReference : $receiptNote,
            $actorUserId,
            $postedPaymentId ?? 0
        );
        $receiptMeta['payment_method'] = $method;
        $receiptMeta['payment_method_label'] = $method === 'momo' ? 'MoMo' : 'Cash';
        if ($method === 'momo') {
            $receiptMeta['momo_reference'] = $paymentReference;
        }

        $response = $this->buildPaymentResponse(
            $visit,
            $updated,
            $totalDue,
            $amountReceived,
            $receiptMeta
        );

        return $this->finalizePaymentResponse($response, $clientRequestId, $visitId, $actorUserId);
    }

    /**
     * CBILL-2 — take a partial payment: record less than the full total, complete the visit,
     * and leave the remainder as an outstanding balance (surfaces in the M14 "owed to clinic"
     * list via its completed-with-balance branch). Manager-gated + reason required.
     *
     * @return array<string, mixed>
     */
    public function recordPartialPayment(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        float $amountReceived,
        string $reason,
        ?string $esignOverrideReason = null,
        ?string $clientRequestId = null,
        ?string $paymentMethod = 'cash',
        ?string $momoReference = null,
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding')) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('Reason is required for a partial payment');
        }

        $clientRequestId = trim((string) ($clientRequestId ?? ''));
        if ($clientRequestId !== '') {
            $cached = $this->loadIdempotentPaymentResponse($clientRequestId);
            if ($cached !== null) {
                return $cached;
            }
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_payment') {
            throw new \InvalidArgumentException('Visit is not ready for payment');
        }

        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        if ($this->configService->getInt('enable_partial_payment', 0, $facilityId) !== 1) {
            throw new \InvalidArgumentException('Partial payment is not enabled for this clinic');
        }

        $this->signService->assertProfileSigned($visitId, $esignOverrideReason);

        $charges = $this->getEncounterCharges($pid, $encounter);
        $autoBillDrugs = $this->pharmacyAutoBillEnabled($facilityId);
        $drugCharges = $autoBillDrugs ? $this->getEncounterDrugCharges($pid, $encounter) : [];
        $totalDue = round($this->sumCharges($charges) + $this->sumDrugCharges($drugCharges), 2);

        if ($totalDue <= 0) {
            throw new \InvalidArgumentException('No charges on this visit — add fees before taking payment');
        }

        if ($amountReceived <= 0) {
            throw new \InvalidArgumentException('Payment amount must be greater than zero');
        }
        if ($amountReceived + 0.001 >= $totalDue) {
            throw new \InvalidArgumentException('Amount covers the full total — use Take payment instead');
        }

        // Partial payment requires a complete-enough profile — the desk only offers the
        // button when completion is satisfied, and V1 has no manager completion-override
        // path for partial (unlike full pay). This is the defensive server-side guard.
        $completionGate = $this->assessCompletionGate($pid, true);
        if ($completionGate['blocked']) {
            $missing = implode(', ', $completionGate['missing_labels']);
            throw new \InvalidArgumentException(
                'Profile is ' . $completionGate['score'] . '% complete ('
                . $completionGate['threshold'] . '% required). Missing: ' . $missing
            );
        }

        $method = $this->normalizePaymentMethod((string) ($paymentMethod ?? 'cash'), $facilityId);
        $paymentReference = $this->resolvePaymentReference($method, null, $momoReference);
        $balanceDue = round($totalDue - $amountReceived, 2);

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';

        sqlBeginTrans();
        $committed = false;
        try {
            $postedPaymentId = $this->postPatientPayment(
                $pid,
                $encounter,
                $amountReceived,
                $actorUserId,
                $method,
                $paymentReference
            );
            $updated = $this->queueService->transition(
                $visitId,
                'completed',
                $actorUserId,
                $expectedVersion,
                'partial_payment: ' . mb_substr($reason, 0, 180)
            );
            if ($autoBillDrugs) {
                $this->markDrugSalesBilled($pid, $encounter);
            }
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
            'visit_id=' . $visitId . ' partial_payment paid=' . $amountReceived
                . ' balance=' . $balanceDue . ' method=' . $method
        );

        $receiptMeta = $this->issueReceipt(
            $visit,
            $amountReceived,
            $amountReceived,
            $method === 'momo' ? $paymentReference : ('Partial · owed ' . $balanceDue),
            $actorUserId,
            $postedPaymentId ?? 0
        );
        $receiptMeta['payment_method'] = $method;
        $receiptMeta['payment_method_label'] = $method === 'momo' ? 'MoMo' : 'Cash';
        $receiptMeta['balance_due'] = $balanceDue;
        $receiptMeta['partial'] = true;
        if ($method === 'momo') {
            $receiptMeta['momo_reference'] = $paymentReference;
        }

        $receipt = array_merge([
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'show_queue_number' => $this->configService->getInt('print_queue_number_on_receipt', 1, $facilityId) === 1,
            'amount_paid' => $amountReceived,
            'change_due' => 0.0,
            'paid_at' => date('c'),
            'receipt_number' => '',
        ], $receiptMeta);

        $response = [
            'visit' => $this->rowEnricher->enrichVisitRow($updated),
            'amount_paid' => $amountReceived,
            'change_due' => 0.0,
            'balance_due' => $balanceDue,
            'total_due' => $totalDue,
            'receipt' => $receipt,
            'payment_history_url' => $this->paymentHistoryUrl($pid, $visitId, $facilityId),
        ];

        return $this->finalizePaymentResponse($response, $clientRequestId, $visitId, $actorUserId);
    }

    /**
     * CBILL-3 — record a scheme-split checkout: the patient pays their (uncovered) portion now,
     * the scheme-covered portion becomes a manual claim (new_scheme_claim). The visit completes.
     * The scheme portion is NOT patient AR — the M14 outstanding list subtracts it.
     *
     * @param array<int, array<string, mixed>> $coverageLines each: source, source_id, description, amount, covered
     * @return array<string, mixed>
     */
    public function recordSchemePayment(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        int $schemeId,
        string $membershipNumber,
        array $coverageLines,
        float $amountReceived,
        ?string $esignOverrideReason = null,
        ?string $clientRequestId = null,
        ?string $paymentMethod = 'cash',
        ?string $momoReference = null,
    ): array {
        $clientRequestId = trim((string) ($clientRequestId ?? ''));
        if ($clientRequestId !== '') {
            $cached = $this->loadIdempotentPaymentResponse($clientRequestId);
            if ($cached !== null) {
                return $cached;
            }
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_payment') {
            throw new \InvalidArgumentException('Visit is not ready for payment');
        }

        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];
        $facilityId = (int) ($visit['facility_id'] ?? 0);

        $schemeService = new SchemeClaimService();
        if (!$schemeService->isEnabled($facilityId)) {
            throw new \InvalidArgumentException('Insurance scheme-split is not enabled for this clinic');
        }
        if ($schemeId <= 0) {
            throw new \InvalidArgumentException('A scheme is required');
        }
        $membershipNumber = trim($membershipNumber);
        if ($membershipNumber === '') {
            throw new \InvalidArgumentException('Membership number is required');
        }

        $this->signService->assertProfileSigned($visitId, $esignOverrideReason);

        $charges = $this->getEncounterCharges($pid, $encounter);
        $autoBillDrugs = $this->pharmacyAutoBillEnabled($facilityId);
        $drugCharges = $autoBillDrugs ? $this->getEncounterDrugCharges($pid, $encounter) : [];
        $totalDue = round($this->sumCharges($charges) + $this->sumDrugCharges($drugCharges), 2);

        if ($totalDue <= 0) {
            throw new \InvalidArgumentException('No charges on this visit — add fees before taking payment');
        }

        $split = $schemeService->splitTotals($coverageLines);
        if (abs(($split['patient_pay'] + $split['scheme_owed']) - $totalDue) > 0.01) {
            throw new \InvalidArgumentException('Coverage lines do not add up to the visit total');
        }
        $patientPay = $split['patient_pay'];
        $schemeOwed = $split['scheme_owed'];

        // Same profile-completion rule as partial pay: complete profile required (no override).
        $completionGate = $this->assessCompletionGate($pid, true);
        if ($completionGate['blocked']) {
            $missing = implode(', ', $completionGate['missing_labels']);
            throw new \InvalidArgumentException(
                'Profile is ' . $completionGate['score'] . '% complete ('
                . $completionGate['threshold'] . '% required). Missing: ' . $missing
            );
        }

        $method = $this->normalizePaymentMethod((string) ($paymentMethod ?? 'cash'), $facilityId);
        $paymentReference = $this->resolvePaymentReference($method, null, $momoReference);

        if ($patientPay > 0) {
            if ($amountReceived <= 0) {
                throw new \InvalidArgumentException('Payment amount must be greater than zero');
            }
            if ($amountReceived + 0.001 < $patientPay) {
                throw new \InvalidArgumentException('Amount received is less than the patient portion');
            }
        }

        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';

        sqlBeginTrans();
        $committed = false;
        $postedPaymentId = 0;
        try {
            $claimId = $schemeService->createClaim($visit, $schemeId, $membershipNumber, $coverageLines, $actorUserId);
            if ($patientPay > 0) {
                $postedPaymentId = $this->postPatientPayment(
                    $pid,
                    $encounter,
                    $patientPay,
                    $actorUserId,
                    $method,
                    $paymentReference
                );
            }
            $updated = $this->queueService->transition(
                $visitId,
                'completed',
                $actorUserId,
                $expectedVersion,
                'scheme_split_payment'
            );
            if ($autoBillDrugs) {
                $this->markDrugSalesBilled($pid, $encounter);
            }
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
            'visit_id=' . $visitId . ' scheme_split scheme_id=' . $schemeId
                . ' patient=' . $patientPay . ' scheme_owed=' . $schemeOwed
        );

        $changeDue = round(max(0.0, $amountReceived - $patientPay), 2);
        $receiptMeta = $this->issueReceipt(
            $visit,
            $patientPay,
            max($amountReceived, $patientPay),
            'Scheme: ' . mb_substr($schemeService->schemeLabel($schemeId), 0, 120) . ' owes ' . $schemeOwed,
            $actorUserId,
            $postedPaymentId
        );
        $receiptMeta['payment_method'] = $method;
        $receiptMeta['payment_method_label'] = $method === 'momo' ? 'MoMo' : 'Cash';
        $receiptMeta['scheme_owed'] = $schemeOwed;
        $receiptMeta['scheme_split'] = true;

        $receipt = array_merge([
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'show_queue_number' => $this->configService->getInt('print_queue_number_on_receipt', 1, $facilityId) === 1,
            'amount_paid' => $patientPay,
            'change_due' => $changeDue,
            'paid_at' => date('c'),
            'receipt_number' => '',
        ], $receiptMeta);

        $response = [
            'visit' => $this->rowEnricher->enrichVisitRow($updated),
            'amount_paid' => $patientPay,
            'change_due' => $changeDue,
            'patient_pay' => $patientPay,
            'scheme_owed' => $schemeOwed,
            'total_due' => $totalDue,
            'claim_id' => $claimId,
            'receipt' => $receipt,
            'payment_history_url' => $this->paymentHistoryUrl($pid, $visitId, $facilityId),
        ];

        return $this->finalizePaymentResponse($response, $clientRequestId, $visitId, $actorUserId);
    }

    /**
     * @param array<int, array<string, mixed>> $lines
     * @return array<string, mixed>
     */
    public function postCharges(int $visitId, array $lines, int $actorUserId): array
    {
        $result = $this->chargeService->postCharges($visitId, $lines, $actorUserId);
        $select = $this->selectVisit($visitId, $actorUserId);

        return array_merge($select, [
            'posted_count' => $result['posted_count'] ?? 0,
        ]);
    }

    /**
     * Close a zero-charge visit (supervisor ACL).
     *
     * @return array<string, mixed>
     */
    public function closeWithoutCharge(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        string $reason
    ): array {
        if (!$this->canCloseWithoutCharge()) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('Reason is required');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_payment') {
            throw new \InvalidArgumentException('Visit is not ready for payment');
        }

        $pid = (int) $visit['pid'];
        $encounter = (int) $visit['encounter'];
        $totalDue = $this->sumCharges($this->getEncounterCharges($pid, $encounter));
        if ($totalDue > 0) {
            throw new \InvalidArgumentException('Visit has charges — use Take payment instead');
        }

        $updated = $this->queueService->transition(
            $visitId,
            'completed',
            $actorUserId,
            $expectedVersion,
            'close_without_charge: ' . mb_substr($reason, 0, 200)
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'cashier',
            $actorUserId,
            1,
            'visit_id=' . $visitId . ' close_without_charge'
        );

        return ['visit' => $this->rowEnricher->enrichVisitRow($updated)];
    }

    /**
     * @param array<string, mixed> $visit
     * @param array<string, mixed> $receiptMeta
     * @return array<string, mixed>
     */
    private function buildPaymentResponse(
        array $visit,
        array $updated,
        float $totalDue,
        float $amountReceived,
        array $receiptMeta = []
    ): array {
        $changeDue = round($amountReceived - $totalDue, 2);
        $receipt = array_merge([
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'show_queue_number' => $this->configService->getInt(
                'print_queue_number_on_receipt',
                1,
                (int) ($visit['facility_id'] ?? 0)
            ) === 1,
            'amount_paid' => $totalDue,
            'change_due' => $changeDue,
            'paid_at' => date('c'),
            'receipt_number' => '',
        ], $receiptMeta);

        $historyUrl = $this->paymentHistoryUrl(
            (int) ($visit['pid'] ?? 0),
            (int) ($visit['id'] ?? 0),
            (int) ($visit['facility_id'] ?? 0)
        );

        return [
            'visit' => $this->rowEnricher->enrichVisitRow($updated),
            'amount_paid' => $totalDue,
            'change_due' => $changeDue,
            'receipt' => $receipt,
            'payment_history_url' => $historyUrl,
        ];
    }

    /**
     * M11-F12 — Cashier "History" link into chart-depth payment history.
     * Null when Chart Depth finance is OFF or actor lacks the finance ACL.
     */
    private function paymentHistoryUrl(int $pid, int $visitId, int $facilityId): ?string
    {
        if ($pid <= 0 || $visitId <= 0) {
            return null;
        }

        if ($this->configService->getInt('enable_chart_depth', 0, $facilityId) !== 1
            || $this->configService->getInt('enable_chart_depth_finance', 0, $facilityId) !== 1) {
            return null;
        }

        if (!AclMain::aclCheckCore('new_clinic', 'new_chart_depth_finance')) {
            return null;
        }

        return ($GLOBALS['webroot'] ?? '')
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/payments.php?pid='
            . urlencode((string) $pid)
            . '&visit_id=' . urlencode((string) $visitId);
    }

    private function canCloseWithoutCharge(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_close_without_charge');
    }

    private function encounterHasPatientPayment(int $pid, int $encounter): bool
    {
        return self::hasRecordedPaymentTotal($this->encounterPatientPaymentTotal($pid, $encounter));
    }

    private function encounterPatientPaymentTotal(int $pid, int $encounter): float
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COALESCE(SUM(pay_amount), 0) AS paid
             FROM ar_activity
             WHERE pid = ? AND encounter = ? AND account_code = 'PP'",
            [$pid, $encounter]
        );

        return round((float) ($row['paid'] ?? 0), 2);
    }

    /**
     * @return array<string, mixed>
     */
    public function markClosedUnpaid(
        int $visitId,
        int $actorUserId,
        int $expectedVersion,
        string $reason
    ): array {
        if (!AclMain::aclCheckCore('new_clinic', 'new_visit_mark_outstanding')) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('Reason is required');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        if ($visit['state'] !== 'ready_for_payment') {
            throw new \InvalidArgumentException('Visit is not ready for payment');
        }

        $updated = $this->queueService->transition(
            $visitId,
            'closed_unpaid',
            $actorUserId,
            $expectedVersion,
            $reason
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'cashier',
            $actorUserId,
            1,
            'visit_id=' . $visitId . ' closed_unpaid'
        );

        return ['visit' => $this->rowEnricher->enrichVisitRow($updated)];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getEncounterCharges(int $pid, int $encounter): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, code_type, code, code_text, units, fee, modifier
             FROM billing
             WHERE pid = ? AND encounter = ? AND activity = 1
             ORDER BY id ASC",
            [$pid, $encounter]
        ) ?: [];

        return array_map(static function (array $row): array {
            $units = (int) ($row['units'] ?? 1);
            if ($units < 1) {
                $units = 1;
            }
            $fee = (float) ($row['fee'] ?? 0);

            return [
                'id' => (int) $row['id'],
                'code_type' => $row['code_type'] ?? '',
                'code' => $row['code'] ?? '',
                'description' => $row['code_text'] ?? '',
                'units' => $units,
                'unit_price' => $units > 0 ? round($fee / $units, 2) : $fee,
                'amount' => $fee,
            ];
        }, $rows);
    }

    /**
     * CBILL-1 — is pharmacy auto-bill (medicines on the cashier bill) on for this facility?
     */
    private function pharmacyAutoBillEnabled(int $facilityId): bool
    {
        return $this->configService->getInt('pharmacy_auto_bill_on_dispense', 0, $facilityId) === 1;
    }

    /**
     * CBILL-1 — SQL fragment adding an encounter's unbilled medicine total to a
     * charges_total subquery, or '' when pharmacy auto-bill is off. The correlated
     * subquery references the outer `v` (new_visit) alias.
     */
    private function drugChargeSubquery(int $facilityId): string
    {
        if (!$this->pharmacyAutoBillEnabled($facilityId)) {
            return '';
        }

        return " + (SELECT COALESCE(SUM(ds.fee), 0) FROM drug_sales ds
                    WHERE ds.pid = v.pid AND ds.encounter = v.encounter AND ds.billed = 0)";
    }

    /**
     * CBILL-1 — unbilled dispensed medicines for this encounter, read from drug_sales
     * (where the pharmacy dispense already records them). Products live in drug_sales,
     * not billing, so we surface them here rather than writing a duplicate billing line.
     *
     * @return array<int, array<string, mixed>>
     */
    private function getEncounterDrugCharges(int $pid, int $encounter): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT ds.sale_id, ds.drug_id, d.name AS drug_name, ds.quantity, ds.fee
             FROM drug_sales ds
             LEFT JOIN drugs d ON d.drug_id = ds.drug_id
             WHERE ds.pid = ? AND ds.encounter = ? AND ds.billed = 0
             ORDER BY ds.sale_id ASC",
            [$pid, $encounter]
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'sale_id' => (int) ($row['sale_id'] ?? 0),
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'description' => (string) ($row['drug_name'] ?? ''),
                'quantity' => (int) ($row['quantity'] ?? 0),
                'amount' => round((float) ($row['fee'] ?? 0), 2),
            ];
        }, $rows);
    }

    /**
     * @param array<int, array<string, mixed>> $lines
     */
    private function sumDrugCharges(array $lines): float
    {
        $sum = 0.0;
        foreach ($lines as $line) {
            $sum += (float) ($line['amount'] ?? 0);
        }

        return round($sum, 2);
    }

    /**
     * CBILL-1 — mark this encounter's dispensed medicines as posted to accounting once
     * the cashier has collected them (mirrors the billing.billed flag).
     */
    private function markDrugSalesBilled(int $pid, int $encounter): void
    {
        QueryUtils::sqlStatementThrowException(
            "UPDATE drug_sales SET billed = 1, bill_date = NOW()
             WHERE pid = ? AND encounter = ? AND billed = 0",
            [$pid, $encounter]
        );
    }

    /**
     * @param array<int, array<string, mixed>> $charges
     */
    public static function sumChargeLines(array $charges): float
    {
        $sum = 0.0;
        foreach ($charges as $line) {
            $sum += (float) ($line['amount'] ?? 0);
        }

        return round($sum, 2);
    }

    public static function hasRecordedPaymentTotal(float $paidTotal): bool
    {
        return $paidTotal > 0.001;
    }

    /**
     * @param array<int, array<string, mixed>> $charges
     */
    private function sumCharges(array $charges): float
    {
        return self::sumChargeLines($charges);
    }

    private function postPatientPayment(
        int $pid,
        int $encounter,
        float $amount,
        int $actorUserId,
        string $paymentMethod,
        string $paymentReference,
    ): int {
        require_once dirname(__DIR__, 6) . '/library/payment.inc.php';

        sqlStatement(
            "UPDATE form_encounter SET last_level_closed = 4 WHERE encounter = ? AND pid = ?",
            [$encounter, $pid]
        );
        sqlStatement(
            "UPDATE billing SET billed = 1 WHERE encounter = ? AND pid = ?",
            [$encounter, $pid]
        );

        $method = $paymentMethod === 'momo' ? 'momo' : 'cash';
        $reference = mb_substr(trim($paymentReference), 0, 255);
        if ($reference === '') {
            $reference = $method === 'momo' ? 'MoMo payment' : 'New Clinic cashier';
        }
        $description = $method === 'momo' ? 'MoMo · Ref: ' . $reference : $reference;

        $sessionId = sqlInsert(
            "INSERT INTO ar_session SET payer_id = 0, patient_id = ?, user_id = ?, closed = 0,
             reference = ?, check_date = NOW(), deposit_date = NOW(), pay_total = ?,
             payment_type = 'patient', description = ?, adjustment_code = 'patient_payment',
             post_to_date = NOW(), payment_method = ?",
            [$pid, $actorUserId, $reference, $amount, $description, $method]
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
                $amount,
            ]
        );

        $timestamp = date('Y-m-d H:i:s');
        $paymentId = frontPayment($pid, $encounter, $method, $reference, 0, $amount, $timestamp);

        return (int) $paymentId;
    }

    private function normalizePaymentMethod(string $paymentMethod, int $facilityId): string
    {
        $method = strtolower(trim($paymentMethod));
        if ($method === 'momo') {
            if ($this->configService->getInt('enable_momo_payment', 0, $facilityId) !== 1) {
                throw new \InvalidArgumentException('MoMo payments are not enabled for this clinic');
            }

            return 'momo';
        }

        return 'cash';
    }

    private function resolvePaymentReference(
        string $method,
        ?string $receiptNote,
        ?string $momoReference,
    ): string {
        if ($method === 'momo') {
            $reference = trim((string) $momoReference);
            if ($reference === '') {
                throw new \InvalidArgumentException('MoMo transaction reference is required');
            }

            return mb_substr($reference, 0, 255);
        }

        if ($receiptNote !== null && trim($receiptNote) !== '') {
            return mb_substr(trim($receiptNote), 0, 255);
        }

        return 'New Clinic cashier';
    }

    private function feeSheetUrl(int $pid, int $encounter): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot . '/interface/patient_file/encounter/encounter_top.php?set_encounter='
            . urlencode((string) $encounter);
    }

    private function frontPaymentUrl(int $pid): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot . '/interface/patient_file/front_payment.php?form_pid=' . urlencode((string) $pid);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchPaidToday(int $facilityId, string $visitDate): array
    {
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ? AND v.state = 'completed'
                ORDER BY v.updated_at DESC LIMIT 10";

        $rows = QueryUtils::fetchRecords($sql, [$facilityId, $visitDate]) ?: [];

        return array_map(function (array $row) use ($facilityId): array {
            $enriched = $this->rowEnricher->enrichVisitRow($row);
            $correction = $this->billOpsAccess->addCorrectionLink((int) ($row['id'] ?? 0), $facilityId);
            if ($correction['visible']) {
                $enriched['charge_correction_url'] = $correction['url'];
                $enriched['charge_correction_label'] = $correction['label'];
            }
            $historyUrl = $this->paymentHistoryUrl(
                (int) ($row['pid'] ?? 0),
                (int) ($row['id'] ?? 0),
                $facilityId
            );
            if ($historyUrl !== null) {
                $enriched['payment_history_url'] = $historyUrl;
            }

            return $enriched;
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchClosedUnpaidToday(int $facilityId, string $visitDate): array
    {
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ? AND v.state = 'closed_unpaid'
                ORDER BY v.left_unpaid_at DESC LIMIT 10";

        $rows = QueryUtils::fetchRecords($sql, [$facilityId, $visitDate]) ?: [];

        return array_map(fn (array $row) => $this->rowEnricher->enrichVisitRow($row), $rows);
    }

    /**
     * @return array{blocked: bool, can_skip: bool, score: int, threshold: int, missing_labels: array<int, string>}
     */
    private function assessCompletionGate(int $pid, bool $forceRecompute): array
    {
        $result = $forceRecompute
            ? $this->completionService->recompute($pid)
            : $this->completionService->readCached($pid);
        $threshold = $this->completionService->getBillingThreshold();
        $score = (int) ($result['score'] ?? 0);
        $blocked = $score < $threshold;
        $overrideAllowed = $this->configService->getInt('allow_billing_completion_override', 1) === 1;
        $canSkip = $overrideAllowed
            && AclMain::aclCheckCore('new_clinic', 'new_billing_skip_completion');

        return [
            'blocked' => $blocked,
            'can_skip' => $canSkip,
            'score' => $score,
            'threshold' => $threshold,
            'missing_labels' => $result['missing_labels'] ?? [],
        ];
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    private function issueReceipt(
        array $visit,
        float $totalDue,
        float $amountReceived,
        ?string $receiptNote,
        int $actorUserId,
        int $postedPaymentId = 0
    ): array {
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $visitId = (int) ($visit['id'] ?? 0);
        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);
        $receiptNumber = $this->allocateReceiptNumber($facilityId);
        $changeDue = round($amountReceived - $totalDue, 2);
        $note = $receiptNote !== null ? mb_substr(trim($receiptNote), 0, 255) : null;

        QueryUtils::sqlInsert(
            "INSERT INTO new_receipt
             (facility_id, receipt_number, visit_id, pid, encounter, amount_paid, change_due, receipt_note, actor_user_id, posted_payment_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $facilityId,
                $receiptNumber,
                $visitId,
                $pid,
                $encounter,
                $totalDue,
                $changeDue,
                $note,
                $actorUserId,
                $postedPaymentId > 0 ? $postedPaymentId : null,
            ]
        );

        return [
            'receipt_number' => $receiptNumber,
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'amount_paid' => $totalDue,
            'change_due' => $changeDue,
            'paid_at' => date('c'),
        ];
    }

    private function allocateReceiptNumber(int $facilityId): string
    {
        if ($facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDefaultFacilityId();
        }

        $counterDate = date('Y-m-d');
        sqlStatement(
            "INSERT INTO new_receipt_counter (facility_id, counter_date, last_seq)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE last_seq = last_seq + 1",
            [$facilityId, $counterDate]
        );

        $row = QueryUtils::querySingleRow(
            "SELECT last_seq FROM new_receipt_counter WHERE facility_id = ? AND counter_date = ?",
            [$facilityId, $counterDate]
        );
        $seq = is_array($row) ? (int) ($row['last_seq'] ?? 1) : 1;

        return sprintf('%d-%s-%04d', $facilityId, date('Ymd'), $seq);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadIdempotentPaymentResponse(string $clientRequestId): ?array
    {
        if (strlen($clientRequestId) > 64) {
            throw new \InvalidArgumentException('client_request_id is too long');
        }

        $row = QueryUtils::querySingleRow(
            "SELECT response_json FROM new_cashier_payment_request WHERE client_request_id = ?",
            [$clientRequestId]
        );
        if (!is_array($row) || empty($row['response_json'])) {
            return null;
        }

        $decoded = json_decode((string) $row['response_json'], true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array<string, mixed> $response
     * @return array<string, mixed>
     */
    private function finalizePaymentResponse(
        array $response,
        string $clientRequestId,
        int $visitId,
        int $actorUserId
    ): array {
        if ($clientRequestId === '') {
            return $response;
        }

        $existing = $this->loadIdempotentPaymentResponse($clientRequestId);
        if ($existing !== null) {
            return $existing;
        }

        try {
            QueryUtils::sqlInsert(
                "INSERT INTO new_cashier_payment_request (client_request_id, visit_id, actor_user_id, response_json)
                 VALUES (?, ?, ?, ?)",
                [$clientRequestId, $visitId, $actorUserId, json_encode($response)]
            );
        } catch (\Throwable $e) {
            $existing = $this->loadIdempotentPaymentResponse($clientRequestId);
            if ($existing !== null) {
                return $existing;
            }

            throw $e;
        }

        return $response;
    }
}
