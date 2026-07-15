<?php

/**
 * M12 Lab Operations — manual result entry and release façade
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\Exceptions\LabResultValidationException;

class LabOpsResultService
{
    public function __construct(
        private readonly LabOpsAccessService $access = new LabOpsAccessService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly LabResultsReadinessService $labReadiness = new LabResultsReadinessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ProcedureOrderDeepLinkService $procedureOrderLinks = new ProcedureOrderDeepLinkService(),
        private readonly LabResultValidationService $resultValidation = new LabResultValidationService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getEntryForm(int $procedureOrderId): array
    {
        $this->access->assertHubAccess();
        $header = $this->loadOrderHeader($procedureOrderId);
        $pid = (int) ($header['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $lines = array_map(
            fn (array $line): array => $this->resultValidation->enrichLine($line),
            $this->loadOrderLines($procedureOrderId)
        );
        $encounterId = (int) ($header['encounter_id'] ?? 0);
        $hasSavedResults = $this->orderHasSavedResults($procedureOrderId);

        $editOrderUrl = null;
        if ($lines === [] && $encounterId > 0) {
            try {
                $editOrderUrl = $this->procedureOrderLinks->buildEditOrderUrlPreferNative(
                    $pid,
                    $encounterId,
                    $procedureOrderId,
                    'labops',
                    $this->procedureOrderLinks->buildLabOpsReturnUrl()
                );
            } catch (\InvalidArgumentException) {
                $editOrderUrl = null;
            }
        }

        return [
            'order' => $header,
            'lines' => $lines,
            'test_line_count' => count($lines),
            'has_test_lines' => $lines !== [],
            'edit_order_url' => $editOrderUrl,
            'has_saved_results' => $hasSavedResults,
            // Editing a released result is a correction (ISO 15189) — the UI gates it behind a reason.
            'already_released' => $this->orderIsReleased($procedureOrderId),
            'can_enter' => $this->access->canEnterResults(),
            'can_release' => $this->access->canReleaseResults(),
            'validation' => $this->resultValidation->getFormRulesForLines(
                $lines,
                $header['patient_age_years'] ?? null,
                (string) ($header['patient_sex'] ?? '')
            ),
            'encounter_results_ready' => $encounterId > 0
                ? $this->labReadiness->isResultsReady($pid, $encounterId)
                : false,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function saveEntry(int $procedureOrderId, array $payload, int $actorUserId): array
    {
        $this->access->assertEnterAccess();
        $header = $this->loadOrderHeader($procedureOrderId);
        $pid = (int) ($header['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $draft = !empty($payload['draft']);
        $payloadLines = $payload['lines'] ?? [];
        if (!is_array($payloadLines) || $payloadLines === []) {
            throw new \InvalidArgumentException('Result lines are required');
        }

        $orderLines = $this->loadOrderLines($procedureOrderId);
        $validated = $this->resultValidation->validateSave(
            $orderLines,
            $payloadLines,
            $draft,
            $header['patient_age_years'] ?? null,
            (string) ($header['patient_sex'] ?? '')
        );
        if (!empty($validated['errors'])) {
            throw new LabResultValidationException(
                $validated['errors'],
                $validated['field_errors'],
                $validated['field_warnings']
            );
        }

        $savedReports = [];
        foreach ($validated['normalized_lines'] as $linePayload) {
            $savedReports[] = $this->saveLine($procedureOrderId, $linePayload, $draft);
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.result_saved',
            $actorUserId,
            1,
            'procedure_order_id=' . $procedureOrderId . ' draft=' . ($draft ? '1' : '0'),
            $pid > 0 ? $pid : null
        );

        return [
            'procedure_order_id' => $procedureOrderId,
            'draft' => $draft,
            'reports' => $savedReports,
            'qc_warnings' => $validated['warnings'],
            'field_warnings' => $validated['field_warnings'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @param array<string, mixed>|null $notification critical-value read-back details captured at release
     */
    public function releaseOrder(int $procedureOrderId, int $actorUserId, ?array $notification = null): array
    {
        $this->access->assertReleaseAccess();

        if ($procedureOrderId <= 0) {
            throw new \InvalidArgumentException('Procedure order id is required');
        }

        $header = $this->loadOrderHeader($procedureOrderId);
        $pid = (int) ($header['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $orderLines = $this->loadOrderLines($procedureOrderId);
        $releaseCheck = $this->resultValidation->validateForRelease(
            $orderLines,
            $header['patient_age_years'] ?? null,
            (string) ($header['patient_sex'] ?? '')
        );
        if (!empty($releaseCheck['errors'])) {
            throw new LabResultValidationException($releaseCheck['errors']);
        }

        $now = date('Y-m-d H:i:s');
        QueryUtils::sqlStatementThrowException(
            'UPDATE procedure_report
             SET review_status = ?, date_report = COALESCE(NULLIF(date_report, "0000-00-00 00:00:00"), ?),
                 report_status = CASE WHEN report_status IS NULL OR report_status = "" THEN ? ELSE report_status END
             WHERE procedure_order_id = ? AND review_status != ?',
            ['reviewed', $now, 'final', $procedureOrderId, 'reviewed']
        );

        // If this release closes an open amendment, mark the reports corrected (ISO 15189).
        $corrected = $this->closePendingAmendment($procedureOrderId, $now);

        $releasedReportIds = $this->loadReportIdsForOrder($procedureOrderId);
        $abnormal = $this->orderHasAbnormal($procedureOrderId);
        $criticals = $releaseCheck['criticals'] ?? [];

        // SLIPTA critical-value indicator — a released critical result must record who was notified
        // and when (read-back). Critical never blocks release (the result is valid and urgent), so
        // we still log a "pending" notification if the details were not captured, for follow-up.
        $notificationRecord = null;
        if (!empty($criticals)) {
            $notificationRecord = $this->recordCriticalNotification(
                $procedureOrderId,
                $pid,
                $criticals,
                $notification,
                $actorUserId
            );
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.result_released',
            $actorUserId,
            1,
            'procedure_order_id=' . $procedureOrderId
            . ' reports=' . implode(',', $releasedReportIds)
            . ' abnormal=' . ($abnormal ? '1' : '0')
            . ' critical=' . (empty($criticals) ? '0' : ('1 [' . implode('; ', $criticals) . ']'))
            . ' critical_notified=' . ($notificationRecord === null ? 'na' : ($notificationRecord['captured'] ? '1' : 'pending'))
            . ' corrected=' . ($corrected ? '1' : '0'),
            $pid > 0 ? $pid : null
        );

        $encounterId = (int) ($header['encounter_id'] ?? 0);
        $encounterReady = $this->labReadiness->isResultsReady($pid, $encounterId);

        return [
            'procedure_order_id' => $procedureOrderId,
            'released_report_ids' => $releasedReportIds,
            'review_status' => 'reviewed',
            'order_fully_released' => true,
            'results_ready' => $encounterReady,
            'encounter_results_ready' => $encounterReady,
            'abnormal' => $abnormal,
            'qc_warnings' => $releaseCheck['warnings'],
            'qc_criticals' => $criticals,
            'critical_notification_captured' => $notificationRecord === null ? null : $notificationRecord['captured'],
            'corrected' => $corrected,
        ];
    }

    /**
     * Persist a critical-value notification for a released order (SLIPTA critical-value indicator).
     * When the caller supplied read-back details the row is "captured"; otherwise it is logged as
     * pending so an unnotified critical is still traceable for follow-up.
     *
     * @param array<int, string> $criticals
     * @param array<string, mixed>|null $notification
     * @return array{captured: bool}
     */
    private function recordCriticalNotification(
        int $procedureOrderId,
        int $pid,
        array $criticals,
        ?array $notification,
        int $actorUserId
    ): array {
        $notifiedName = trim((string) ($notification['notified_name'] ?? ''));
        $notifiedRole = trim((string) ($notification['notified_role'] ?? ''));
        $method = trim((string) ($notification['method'] ?? ''));
        $note = trim((string) ($notification['note'] ?? ''));
        $readBack = !empty($notification['read_back_confirmed']) ? 1 : 0;
        $captured = $notifiedName !== '';

        QueryUtils::sqlInsert(
            'INSERT INTO new_lab_critical_notification
                (procedure_order_id, pid, criticals_summary, notified_name, notified_role, method,
                 read_back_confirmed, note, notified_by, notified_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $procedureOrderId,
                $pid,
                mb_substr(implode('; ', $criticals), 0, 1024),
                $notifiedName !== '' ? mb_substr($notifiedName, 0, 128) : null,
                $notifiedRole !== '' ? mb_substr($notifiedRole, 0, 64) : null,
                $method !== '' ? mb_substr($method, 0, 32) : null,
                $readBack,
                $note !== '' ? mb_substr($note, 0, 255) : null,
                $actorUserId > 0 ? $actorUserId : null,
                date('Y-m-d H:i:s'),
            ]
        );

        return ['captured' => $captured];
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @param array<string, mixed>|null $notification critical-value read-back details captured at release
     */
    public function releaseReport(int $procedureReportId, int $actorUserId, ?array $notification = null): array
    {
        $this->access->assertReleaseAccess();

        if ($procedureReportId <= 0) {
            throw new \InvalidArgumentException('Procedure report id is required');
        }

        $report = QueryUtils::querySingleRow(
            'SELECT pr.procedure_report_id, pr.procedure_order_id
             FROM procedure_report pr
             INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
             WHERE pr.procedure_report_id = ?',
            [$procedureReportId]
        );

        if (!is_array($report) || empty($report['procedure_order_id'])) {
            throw new \RuntimeException('Lab report not found', 404);
        }

        $released = $this->releaseOrder((int) $report['procedure_order_id'], $actorUserId, $notification);
        $released['procedure_report_id'] = $procedureReportId;

        return $released;
    }

    /**
     * Begin an amendment of a released result (ISO 15189 corrected report, D-LAB-AMEND). Snapshots
     * the current released values with the reason, then reopens the form for editing. The corrected
     * result is marked on re-release. Amending needs release privilege.
     *
     * @return array<string, mixed>
     */
    public function amendReleasedOrder(int $procedureOrderId, string $reason, int $actorUserId): array
    {
        $this->access->assertReleaseAccess();

        if ($procedureOrderId <= 0) {
            throw new \InvalidArgumentException('Procedure order id is required');
        }
        $reason = trim($reason);
        if ($reason === '') {
            throw new \InvalidArgumentException('An amendment reason is required');
        }

        $header = $this->loadOrderHeader($procedureOrderId);
        $pid = (int) ($header['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        if (!$this->orderIsReleased($procedureOrderId)) {
            throw new \InvalidArgumentException('Only a released result can be amended');
        }

        // Keep one open amendment per correction cycle so re-opening the form doesn't stack rows.
        if (!$this->hasPendingAmendment($procedureOrderId)) {
            QueryUtils::sqlInsert(
                'INSERT INTO new_lab_result_amendment
                    (procedure_order_id, pid, reason, previous_values, amended_by, amended_at)
                 VALUES (?, ?, ?, ?, ?, ?)',
                [
                    $procedureOrderId,
                    $pid,
                    mb_substr($reason, 0, 255),
                    json_encode($this->snapshotResults($procedureOrderId)),
                    $actorUserId > 0 ? $actorUserId : null,
                    date('Y-m-d H:i:s'),
                ]
            );
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.result_amend_begin',
            $actorUserId,
            1,
            'procedure_order_id=' . $procedureOrderId . ' reason=' . mb_substr($reason, 0, 200),
            $pid > 0 ? $pid : null
        );

        return [
            'procedure_order_id' => $procedureOrderId,
            'amending' => true,
            'reason' => $reason,
        ];
    }

    private function orderIsReleased(int $procedureOrderId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM procedure_report
             WHERE procedure_order_id = ? AND review_status = 'reviewed'",
            [$procedureOrderId]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    private function hasPendingAmendment(int $procedureOrderId): bool
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM new_lab_result_amendment
             WHERE procedure_order_id = ? AND released_at IS NULL',
            [$procedureOrderId]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    /**
     * Snapshot the current released result values, keyed by test line, for the amendment trail.
     *
     * @return array<int, array<string, mixed>>
     */
    private function snapshotResults(int $procedureOrderId): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT pc.procedure_order_seq, pc.procedure_code, pc.procedure_name,
                    pres.result, pres.units, pres.abnormal, pres.comments
             FROM procedure_order_code pc
             LEFT JOIN procedure_report pr ON pr.procedure_order_id = pc.procedure_order_id
                 AND pr.procedure_order_seq = pc.procedure_order_seq
             LEFT JOIN procedure_result pres ON pres.procedure_report_id = pr.procedure_report_id
             WHERE pc.procedure_order_id = ?
             ORDER BY pc.procedure_order_seq ASC, pres.procedure_result_id ASC',
            [$procedureOrderId]
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'seq' => (int) ($row['procedure_order_seq'] ?? 0),
                'code' => (string) ($row['procedure_code'] ?? ''),
                'name' => (string) ($row['procedure_name'] ?? ''),
                'result' => (string) ($row['result'] ?? ''),
                'units' => (string) ($row['units'] ?? ''),
                'abnormal' => (string) ($row['abnormal'] ?? ''),
                'comments' => (string) ($row['comments'] ?? ''),
            ];
        }, $rows);
    }

    /**
     * Close any pending amendment for the order once its corrected result is re-released: stamp the
     * amendment row and mark the reports as corrected. Returns true when a correction was closed.
     */
    private function closePendingAmendment(int $procedureOrderId, string $now): bool
    {
        if (!$this->hasPendingAmendment($procedureOrderId)) {
            return false;
        }

        QueryUtils::sqlStatementThrowException(
            'UPDATE new_lab_result_amendment SET released_at = ?
             WHERE procedure_order_id = ? AND released_at IS NULL',
            [$now, $procedureOrderId]
        );
        QueryUtils::sqlStatementThrowException(
            "UPDATE procedure_report SET report_status = 'corrected'
             WHERE procedure_order_id = ?",
            [$procedureOrderId]
        );

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadOrderHeader(int $procedureOrderId): array
    {
        if ($procedureOrderId <= 0) {
            throw new \InvalidArgumentException('Procedure order id is required');
        }

        $row = QueryUtils::querySingleRow(
            "SELECT po.procedure_order_id, po.patient_id, po.encounter_id, po.date_ordered, po.order_status,
                    pd.fname, pd.lname, pd.pubpid, pd.DOB, pd.sex,
                    nv.id AS visit_id, nv.queue_number,
                    meta.collected_at, meta.accession_no
             FROM procedure_order po
             INNER JOIN patient_data pd ON pd.pid = po.patient_id
             LEFT JOIN new_visit nv ON nv.pid = po.patient_id AND nv.encounter = po.encounter_id
             LEFT JOIN new_lab_order_meta meta ON meta.procedure_order_id = po.procedure_order_id
             WHERE po.procedure_order_id = ? AND po.activity = 1",
            [$procedureOrderId]
        );

        if (!is_array($row) || empty($row['procedure_order_id'])) {
            throw new \RuntimeException('Lab order not found', 404);
        }

        return [
            'procedure_order_id' => (int) $row['procedure_order_id'],
            'patient_id' => (int) $row['patient_id'],
            'encounter_id' => (int) ($row['encounter_id'] ?? 0),
            'patient_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'queue_number' => isset($row['queue_number']) ? (int) $row['queue_number'] : null,
            'visit_id' => isset($row['visit_id']) ? (int) $row['visit_id'] : null,
            'date_ordered' => (string) ($row['date_ordered'] ?? ''),
            'order_status' => (string) ($row['order_status'] ?? ''),
            'collected_at' => $row['collected_at'] ?? null,
            'accession_no' => $row['accession_no'] ?? null,
            // Patient context for age/sex-aware QC ranges (D-LAB-AGE).
            'patient_age_years' => $this->ageYears((string) ($row['DOB'] ?? '')),
            'patient_sex' => strtolower((string) ($row['sex'] ?? '')),
        ];
    }

    /** Whole years from a DOB (Y-m-d); null when unknown. */
    private function ageYears(string $dob): ?int
    {
        $dob = trim($dob);
        if ($dob === '' || str_starts_with($dob, '0000')) {
            return null;
        }
        try {
            return (new \DateTimeImmutable($dob))->diff(new \DateTimeImmutable('today'))->y;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadOrderLines(int $procedureOrderId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT pc.procedure_order_seq, pc.procedure_code, pc.procedure_name,
                    pr.procedure_report_id, pr.date_collected, pr.date_report, pr.review_status,
                    pr.report_status, pr.specimen_num
             FROM procedure_order_code pc
             LEFT JOIN procedure_report pr ON pr.procedure_order_id = pc.procedure_order_id
                 AND pr.procedure_order_seq = pc.procedure_order_seq
             WHERE pc.procedure_order_id = ?
             ORDER BY pc.procedure_order_seq ASC, pr.procedure_report_id DESC",
            [$procedureOrderId]
        ) ?: [];

        $lines = [];
        $seenSeq = [];
        foreach ($rows as $row) {
            $seq = (int) ($row['procedure_order_seq'] ?? 0);
            if ($seq <= 0 || isset($seenSeq[$seq])) {
                continue;
            }
            $seenSeq[$seq] = true;

            $reportId = (int) ($row['procedure_report_id'] ?? 0);
            $results = $reportId > 0 ? $this->loadResults($reportId) : [];
            if (count($results) > 1) {
                $results = [end($results)];
            }

            $lines[] = [
                'procedure_order_seq' => $seq,
                'procedure_code' => (string) ($row['procedure_code'] ?? ''),
                'procedure_name' => (string) ($row['procedure_name'] ?? ''),
                'procedure_report_id' => $reportId > 0 ? $reportId : null,
                'date_collected' => $row['date_collected'] ?? null,
                'date_report' => $row['date_report'] ?? null,
                'review_status' => (string) ($row['review_status'] ?? ''),
                'report_status' => (string) ($row['report_status'] ?? ''),
                'specimen_num' => (string) ($row['specimen_num'] ?? ''),
                'results' => $results,
            ];
        }

        return $lines;
    }

    private function orderHasSavedResults(int $procedureOrderId): bool
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt
             FROM procedure_report pr
             INNER JOIN procedure_result pres ON pres.procedure_report_id = pr.procedure_report_id
             WHERE pr.procedure_order_id = ?
               AND pres.result IS NOT NULL AND pres.result != ""',
            [$procedureOrderId]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadResults(int $procedureReportId): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT procedure_result_id, result_code, result_text, result, units, `range`,
                    abnormal, comments, result_status, `date`
             FROM procedure_result
             WHERE procedure_report_id = ?
             ORDER BY procedure_result_id ASC',
            [$procedureReportId]
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'procedure_result_id' => (int) ($row['procedure_result_id'] ?? 0),
                'result_code' => (string) ($row['result_code'] ?? ''),
                'result_text' => (string) ($row['result_text'] ?? ''),
                'result' => (string) ($row['result'] ?? ''),
                'units' => (string) ($row['units'] ?? ''),
                'range' => (string) ($row['range'] ?? ''),
                'abnormal' => (string) ($row['abnormal'] ?? ''),
                'comments' => (string) ($row['comments'] ?? ''),
                'result_status' => (string) ($row['result_status'] ?? ''),
                'date' => $row['date'] ?? null,
            ];
        }, $rows);
    }

    /**
     * @param array<string, mixed> $linePayload
     * @return array<string, mixed>
     */
    private function saveLine(int $procedureOrderId, array $linePayload, bool $draft): array
    {
        $seq = (int) ($linePayload['procedure_order_seq'] ?? 0);
        if ($seq <= 0) {
            throw new \InvalidArgumentException('procedure_order_seq is required');
        }

        $dateCollected = $this->normalizeDateTime($linePayload['date_collected'] ?? null);
        $dateReport = $this->normalizeDateTime($linePayload['date_report'] ?? null) ?? date('Y-m-d H:i:s');
        $specimenNum = trim((string) ($linePayload['specimen_num'] ?? ''));

        $reportId = (int) ($linePayload['procedure_report_id'] ?? 0);
        if ($reportId > 0) {
            $this->assertReportBelongsToLine($reportId, $procedureOrderId, $seq);
        }

        $reviewStatus = $draft ? 'draft' : 'received';

        if ($reportId <= 0) {
            $reportId = QueryUtils::sqlInsert(
                'INSERT INTO procedure_report
                 (procedure_order_id, procedure_order_seq, date_collected, date_report, specimen_num, report_status, review_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    $procedureOrderId,
                    $seq,
                    $dateCollected,
                    $dateReport,
                    $specimenNum,
                    $draft ? 'prelim' : 'final',
                    $reviewStatus,
                ]
            );
        } else {
            QueryUtils::sqlStatementThrowException(
                'UPDATE procedure_report
                 SET date_collected = COALESCE(?, date_collected),
                     date_report = COALESCE(?, date_report),
                     specimen_num = ?,
                     report_status = ?,
                     review_status = CASE WHEN review_status = ? THEN review_status ELSE ? END
                 WHERE procedure_report_id = ?',
                [
                    $dateCollected,
                    $dateReport,
                    $specimenNum,
                    $draft ? 'prelim' : 'final',
                    'reviewed',
                    $reviewStatus,
                    $reportId,
                ]
            );
        }

        $resultRows = $linePayload['results'] ?? [];
        if (!is_array($resultRows)) {
            $resultRows = [];
        }

        foreach ($resultRows as $resultPayload) {
            if (!is_array($resultPayload)) {
                continue;
            }
            $this->saveResultRow($reportId, $resultPayload);
        }

        return [
            'procedure_report_id' => $reportId,
            'procedure_order_seq' => $seq,
            'review_status' => $reviewStatus,
        ];
    }

    private function assertReportBelongsToLine(int $reportId, int $procedureOrderId, int $seq): void
    {
        $row = QueryUtils::querySingleRow(
            'SELECT procedure_report_id
             FROM procedure_report
             WHERE procedure_report_id = ? AND procedure_order_id = ? AND procedure_order_seq = ?',
            [$reportId, $procedureOrderId, $seq]
        );

        if (!is_array($row) || empty($row['procedure_report_id'])) {
            throw new \InvalidArgumentException('Lab report does not belong to this order line');
        }
    }

    private function assertResultBelongsToReport(int $resultId, int $reportId): void
    {
        $row = QueryUtils::querySingleRow(
            'SELECT procedure_result_id
             FROM procedure_result
             WHERE procedure_result_id = ? AND procedure_report_id = ?',
            [$resultId, $reportId]
        );

        if (!is_array($row) || empty($row['procedure_result_id'])) {
            throw new \InvalidArgumentException('Lab result does not belong to this report');
        }
    }

    /**
     * @param array<string, mixed> $resultPayload
     */
    private function saveResultRow(int $reportId, array $resultPayload): void
    {
        $resultId = (int) ($resultPayload['procedure_result_id'] ?? 0);
        $resultCode = trim((string) ($resultPayload['result_code'] ?? ''));
        $resultText = trim((string) ($resultPayload['result_text'] ?? ''));
        $value = trim((string) ($resultPayload['result'] ?? ''));
        $units = trim((string) ($resultPayload['units'] ?? ''));
        $range = trim((string) ($resultPayload['range'] ?? ''));
        $abnormal = trim((string) ($resultPayload['abnormal'] ?? ''));
        $comments = trim((string) ($resultPayload['comments'] ?? ''));
        $resultDate = $this->normalizeDateTime($resultPayload['date'] ?? null) ?? date('Y-m-d H:i:s');

        if ($resultId <= 0) {
            $existing = QueryUtils::querySingleRow(
                'SELECT procedure_result_id FROM procedure_result
                 WHERE procedure_report_id = ?
                 ORDER BY procedure_result_id DESC
                 LIMIT 1',
                [$reportId]
            );
            if (is_array($existing) && !empty($existing['procedure_result_id'])) {
                $resultId = (int) $existing['procedure_result_id'];
            }
        }

        if ($resultId > 0) {
            $this->assertResultBelongsToReport($resultId, $reportId);
            QueryUtils::sqlStatementThrowException(
                'UPDATE procedure_result
                 SET result_code = ?, result_text = ?, result = ?, units = ?, `range` = ?,
                     abnormal = ?, comments = ?, `date` = ?
                 WHERE procedure_result_id = ?',
                [$resultCode, $resultText, $value, $units, $range, $abnormal, $comments, $resultDate, $resultId]
            );
            return;
        }

        if ($value === '' && $resultText === '') {
            return;
        }

        QueryUtils::sqlInsert(
            'INSERT INTO procedure_result
             (procedure_report_id, result_code, result_text, result, units, `range`, abnormal, comments, `date`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$reportId, $resultCode, $resultText, $value, $units, $range, $abnormal, $comments, $resultDate]
        );
    }

    private function reportHasAbnormal(int $procedureReportId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM procedure_result
             WHERE procedure_report_id = ? AND abnormal IN ('yes', 'high', 'low', 'abnormal')",
            [$procedureReportId]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    private function orderHasAbnormal(int $procedureOrderId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM procedure_result pres
             INNER JOIN procedure_report pr ON pr.procedure_report_id = pres.procedure_report_id
             WHERE pr.procedure_order_id = ?
               AND pres.abnormal IN ('yes', 'high', 'low', 'abnormal')",
            [$procedureOrderId]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    /**
     * @return array<int, int>
     */
    private function loadReportIdsForOrder(int $procedureOrderId): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT procedure_report_id FROM procedure_report WHERE procedure_order_id = ?',
            [$procedureOrderId]
        ) ?: [];

        return array_values(array_filter(array_map(
            static fn (array $row): int => (int) ($row['procedure_report_id'] ?? 0),
            $rows
        )));
    }

    /**
     * @param mixed $value
     */
    private function normalizeDateTime($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $text = trim((string) $value);
        if ($text === '') {
            return null;
        }

        try {
            return (new \DateTime($text))->format('Y-m-d H:i:s');
        } catch (\Exception) {
            throw new \InvalidArgumentException('Invalid date/time: ' . $text);
        }
    }
}
