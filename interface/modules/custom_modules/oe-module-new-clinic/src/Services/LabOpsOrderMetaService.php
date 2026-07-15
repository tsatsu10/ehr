<?php

/**
 * M12 Lab Operations — order metadata (specimen collection, fulfillment)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class LabOpsOrderMetaService
{
    /** Standard specimen-rejection reasons (SLIPTA sample-rejection indicator). */
    public const REJECTION_REASONS = [
        'haemolysed' => 'Haemolysed',
        'clotted' => 'Clotted',
        'insufficient' => 'Insufficient sample (QNS)',
        'wrong_container' => 'Wrong container / tube',
        'mislabelled' => 'Mislabelled / unlabelled',
        'leaked' => 'Leaked / spilt in transit',
        'wrong_patient' => 'Wrong patient',
        'contaminated' => 'Contaminated / expired tube',
    ];

    public function __construct(
        private readonly LabOpsAccessService $access = new LabOpsAccessService(),
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
    ) {
    }

    /** @return array<int, array{id: string, label: string}> */
    public function rejectionReasonOptions(): array
    {
        $out = [];
        foreach (self::REJECTION_REASONS as $id => $label) {
            $out[] = ['id' => $id, 'label' => $label];
        }
        return $out;
    }

    /**
     * Reject a collected specimen (SLIPTA sample-rejection indicator). Logs the event, clears the
     * collected state so the specimen must be re-collected, and flags the order on the worklist.
     * Never touches results — a rejection is about the sample, before analysis.
     *
     * @return array<string, mixed>
     */
    public function rejectSpecimen(int $procedureOrderId, string $reason, ?string $note, int $actorUserId): array
    {
        $this->access->assertEnterAccess();
        if ($procedureOrderId <= 0) {
            throw new \InvalidArgumentException('Procedure order id is required');
        }
        $reason = trim($reason);
        if (!isset(self::REJECTION_REASONS[$reason])) {
            throw new \InvalidArgumentException('Choose a rejection reason');
        }

        $order = $this->loadOrderWithLab($procedureOrderId);
        $pid = (int) ($order['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);
        $visitId = $this->resolveVisitId($pid, (int) ($order['encounter_id'] ?? 0));
        $note = $note !== null ? mb_substr(trim($note), 0, 255) : null;
        $now = date('Y-m-d H:i:s');

        // One row per rejection event (rejection-rate reporting), plus the denormalised latest
        // rejection on the meta row for the worklist. Clearing collected_at/accession forces a
        // fresh collection.
        QueryUtils::sqlInsert(
            'INSERT INTO new_lab_specimen_rejection
                (procedure_order_id, pid, visit_id, reason, note, rejected_by, rejected_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$procedureOrderId, $pid, $visitId, $reason, $note, $actorUserId, $now]
        );
        QueryUtils::sqlStatementThrowException(
            'UPDATE new_lab_order_meta
             SET collected_at = NULL, accession_no = NULL, rejected_at = ?, rejection_reason = ?
             WHERE procedure_order_id = ?',
            [$now, $reason, $procedureOrderId]
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.specimen_rejected',
            $actorUserId,
            1,
            'procedure_order_id=' . $procedureOrderId . ' reason=' . $reason . ' note=' . ($note ?? ''),
            $pid > 0 ? $pid : null
        );

        return [
            'procedure_order_id' => $procedureOrderId,
            'rejected_at' => $now,
            'rejection_reason' => $reason,
            'rejection_label' => self::REJECTION_REASONS[$reason],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function collectSpecimen(int $procedureOrderId, ?string $accessionNo, int $actorUserId): array
    {
        $this->access->assertEnterAccess();
        $order = $this->loadOrderWithLab($procedureOrderId);
        $pid = (int) ($order['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $now = date('Y-m-d H:i:s');
        $accessionNo = $accessionNo !== null ? trim($accessionNo) : null;
        if ($accessionNo === '') {
            $accessionNo = null;
        }

        $visitId = $this->resolveVisitId($pid, (int) ($order['encounter_id'] ?? 0));
        $metaId = $this->upsertMeta($procedureOrderId, $pid, $visitId, $accessionNo, $now, $actorUserId);
        $this->touchProcedureReports($procedureOrderId, $now, $accessionNo);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.specimen_collected',
            $actorUserId,
            1,
            'procedure_order_id=' . $procedureOrderId
            . ' visit_id=' . ($visitId ?? '')
            . ' accession=' . ($accessionNo ?? ''),
            $pid > 0 ? $pid : null
        );

        return [
            'procedure_order_id' => $procedureOrderId,
            'meta_id' => $metaId,
            'collected_at' => $now,
            'accession_no' => $accessionNo,
            'visit_id' => $visitId,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function recordRequisitionPrinted(int $procedureOrderId, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        $order = $this->loadOrder($procedureOrderId);
        $pid = (int) ($order['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $now = date('Y-m-d H:i:s');
        $visitId = $this->resolveVisitId($pid, (int) ($order['encounter_id'] ?? 0));
        $metaId = $this->upsertMeta(
            $procedureOrderId,
            $pid,
            $visitId,
            null,
            null,
            $actorUserId,
            'send_out',
            $now
        );

        return [
            'procedure_order_id' => $procedureOrderId,
            'meta_id' => $metaId,
            'requisition_printed_at' => $now,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function markAsSendOut(int $procedureOrderId, int $actorUserId): array
    {
        $this->access->assertEnterAccess();
        $order = $this->loadOrder($procedureOrderId);
        $pid = (int) ($order['patient_id'] ?? 0);
        $this->facilityScope->assertPatientAccessible($pid);

        $visitId = $this->resolveVisitId($pid, (int) ($order['encounter_id'] ?? 0));
        $metaId = $this->upsertMeta(
            $procedureOrderId,
            $pid,
            $visitId,
            null,
            null,
            $actorUserId,
            'send_out'
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'lab_ops.marked_send_out',
            $actorUserId,
            1,
            'procedure_order_id=' . $procedureOrderId,
            $pid > 0 ? $pid : null
        );

        return [
            'procedure_order_id' => $procedureOrderId,
            'meta_id' => $metaId,
            'fulfillment' => 'send_out',
        ];
    }

    /**
     * Create metadata row with fulfillment inferred from the order's lab provider (M8-F12).
     *
     * @return string Resolved fulfillment (`in_house` or `send_out`)
     */
    public function ensureFulfillmentMeta(int $procedureOrderId): string
    {
        $order = $this->loadOrderWithLab($procedureOrderId);
        $labId = (int) ($order['lab_id'] ?? 0);

        $existing = QueryUtils::querySingleRow(
            'SELECT id, fulfillment FROM new_lab_order_meta WHERE procedure_order_id = ?',
            [$procedureOrderId]
        );

        $resolved = $this->resolveFulfillment(
            is_array($existing) ? (string) ($existing['fulfillment'] ?? '') : null,
            $labId
        );

        if (is_array($existing) && !empty($existing['id'])) {
            $stored = (string) ($existing['fulfillment'] ?? '');
            if ($stored !== $resolved) {
                QueryUtils::sqlStatementThrowException(
                    'UPDATE new_lab_order_meta SET fulfillment = ? WHERE procedure_order_id = ?',
                    [$resolved, $procedureOrderId]
                );
            }

            return $resolved;
        }

        $pid = (int) ($order['patient_id'] ?? 0);
        $encounterId = (int) ($order['encounter_id'] ?? 0);
        $visitId = $this->resolveVisitId($pid, $encounterId);

        $this->upsertMeta(
            $procedureOrderId,
            $pid,
            $visitId,
            null,
            null,
            0,
            $resolved
        );

        return $resolved;
    }

    /**
     * @param array<int, int> $procedureOrderIds
     */
    public function batchEnsureFulfillmentMeta(array $procedureOrderIds): void
    {
        foreach ($procedureOrderIds as $procedureOrderId) {
            $procedureOrderId = (int) $procedureOrderId;
            if ($procedureOrderId <= 0) {
                continue;
            }

            try {
                $this->ensureFulfillmentMeta($procedureOrderId);
            } catch (\Throwable $e) {
                error_log(
                    'Lab ops fulfillment meta backfill failed for order '
                    . $procedureOrderId . ': ' . $e->getMessage()
                );
            }
        }
    }

    public function inferFulfillmentFromProviderId(int $labId): string
    {
        if ($labId <= 0) {
            return 'in_house';
        }

        $provider = QueryUtils::querySingleRow(
            'SELECT type, protocol, remote_host FROM procedure_providers WHERE ppid = ? AND active = 1',
            [$labId]
        );

        return $this->inferFulfillmentFromProviderRow(is_array($provider) ? $provider : null);
    }

    /**
     * Stored send-out (e.g. requisition printed) wins; otherwise infer from the order's lab provider.
     */
    public function resolveFulfillment(?string $storedFulfillment, int $labId): string
    {
        $stored = strtolower(trim((string) ($storedFulfillment ?? '')));
        if ($stored === 'send_out') {
            return 'send_out';
        }

        return $this->inferFulfillmentFromProviderId($labId);
    }

    /**
     * @param array<string, mixed>|null $provider
     */
    public function inferFulfillmentFromProviderRow(?array $provider): string
    {
        if ($provider === null) {
            return 'in_house';
        }

        $type = strtolower(trim((string) ($provider['type'] ?? '')));
        if (in_array($type, ['inhouse', 'in_house', 'in-house'], true)) {
            return 'in_house';
        }
        if ($type !== '' && !in_array($type, ['inhouse', 'in_house', 'in-house'], true)) {
            return 'send_out';
        }

        $protocol = strtoupper(trim((string) ($provider['protocol'] ?? '')));
        $remoteHost = trim((string) ($provider['remote_host'] ?? ''));
        if ($protocol === 'DL' && $remoteHost === '') {
            return 'in_house';
        }

        return 'send_out';
    }

    /**
     * @return array<string, mixed>
     */
    private function loadOrderWithLab(int $procedureOrderId): array
    {
        $order = $this->loadOrder($procedureOrderId);

        $row = QueryUtils::querySingleRow(
            'SELECT lab_id FROM procedure_order WHERE procedure_order_id = ?',
            [$procedureOrderId]
        );
        if (is_array($row)) {
            $order['lab_id'] = (int) ($row['lab_id'] ?? 0);
        }

        return $order;
    }

    /**
     * @return array<string, mixed>
     */
    private function loadOrder(int $procedureOrderId): array
    {
        if ($procedureOrderId <= 0) {
            throw new \InvalidArgumentException('Procedure order id is required');
        }

        $row = QueryUtils::querySingleRow(
            'SELECT procedure_order_id, patient_id, encounter_id, order_status, activity
             FROM procedure_order WHERE procedure_order_id = ?',
            [$procedureOrderId]
        );

        if (!is_array($row) || empty($row['procedure_order_id'])) {
            throw new \RuntimeException('Lab order not found', 404);
        }

        if ((int) ($row['activity'] ?? 0) !== 1) {
            throw new \InvalidArgumentException('Lab order is not active');
        }

        return $row;
    }

    private function resolveVisitId(int $pid, int $encounterId): ?int
    {
        if ($encounterId <= 0) {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit WHERE pid = ? AND encounter = ? ORDER BY id DESC LIMIT 1',
            [$pid, $encounterId]
        );

        $visitId = is_array($row) ? (int) ($row['id'] ?? 0) : 0;

        return $visitId > 0 ? $visitId : null;
    }

    private function upsertMeta(
        int $procedureOrderId,
        int $pid,
        ?int $visitId,
        ?string $accessionNo,
        ?string $collectedAt,
        int $actorUserId,
        ?string $fulfillment = null,
        ?string $requisitionPrintedAt = null
    ): int {
        $existing = QueryUtils::querySingleRow(
            'SELECT id, fulfillment FROM new_lab_order_meta WHERE procedure_order_id = ?',
            [$procedureOrderId]
        );

        if (is_array($existing) && !empty($existing['id'])) {
            $storedFulfillment = (string) ($existing['fulfillment'] ?? '');
            if ($fulfillment === 'send_out') {
                $nextFulfillment = 'send_out';
            } elseif ($storedFulfillment === 'send_out') {
                $nextFulfillment = 'send_out';
            } elseif ($fulfillment !== null && $fulfillment !== '') {
                $nextFulfillment = $fulfillment;
            } else {
                $order = $this->loadOrderWithLab($procedureOrderId);
                $nextFulfillment = $this->resolveFulfillment(
                    $storedFulfillment,
                    (int) ($order['lab_id'] ?? 0)
                );
            }

            QueryUtils::sqlStatementThrowException(
                'UPDATE new_lab_order_meta
                 SET collected_at = COALESCE(?, collected_at),
                     collected_by = CASE WHEN ? IS NOT NULL THEN ? ELSE collected_by END,
                     accession_no = COALESCE(?, accession_no),
                     visit_id = COALESCE(?, visit_id),
                     pid = ?,
                     fulfillment = ?,
                     requisition_printed_at = COALESCE(?, requisition_printed_at),
                     rejected_at = CASE WHEN ? IS NOT NULL THEN NULL ELSE rejected_at END,
                     rejection_reason = CASE WHEN ? IS NOT NULL THEN NULL ELSE rejection_reason END
                 WHERE procedure_order_id = ?',
                [
                    $collectedAt,
                    $collectedAt,
                    $actorUserId,
                    $accessionNo,
                    $visitId,
                    $pid,
                    $nextFulfillment,
                    $requisitionPrintedAt,
                    // Re-collection clears any prior rejection flag (specimen replaced).
                    $collectedAt,
                    $collectedAt,
                    $procedureOrderId,
                ]
            );

            return (int) $existing['id'];
        }

        if ($fulfillment === null || $fulfillment === '') {
            $order = $this->loadOrderWithLab($procedureOrderId);
            $fulfillment = $this->inferFulfillmentFromProviderId((int) ($order['lab_id'] ?? 0));
        }

        return QueryUtils::sqlInsert(
            'INSERT INTO new_lab_order_meta
             (procedure_order_id, visit_id, pid, fulfillment, accession_no, collected_at, collected_by, requisition_printed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $procedureOrderId,
                $visitId,
                $pid,
                $fulfillment ?? 'in_house',
                $accessionNo,
                $collectedAt,
                $collectedAt !== null ? $actorUserId : null,
                $requisitionPrintedAt,
            ]
        );
    }

    private function touchProcedureReports(int $procedureOrderId, string $collectedAt, ?string $accessionNo): void
    {
        $lines = QueryUtils::fetchRecords(
            'SELECT procedure_order_seq FROM procedure_order_code WHERE procedure_order_id = ?',
            [$procedureOrderId]
        ) ?: [];

        foreach ($lines as $line) {
            $seq = (int) ($line['procedure_order_seq'] ?? 0);
            if ($seq <= 0) {
                continue;
            }

            $report = QueryUtils::querySingleRow(
                'SELECT procedure_report_id FROM procedure_report
                 WHERE procedure_order_id = ? AND procedure_order_seq = ?
                 ORDER BY procedure_report_id DESC LIMIT 1',
                [$procedureOrderId, $seq]
            );

            if (is_array($report) && !empty($report['procedure_report_id'])) {
                QueryUtils::sqlStatementThrowException(
                    'UPDATE procedure_report
                     SET date_collected = COALESCE(NULLIF(date_collected, "0000-00-00 00:00:00"), ?),
                         specimen_num = COALESCE(?, specimen_num)
                     WHERE procedure_report_id = ?',
                    [$collectedAt, $accessionNo, (int) $report['procedure_report_id']]
                );
                continue;
            }

            QueryUtils::sqlInsert(
                'INSERT INTO procedure_report
                 (procedure_order_id, procedure_order_seq, date_collected, specimen_num, report_status)
                 VALUES (?, ?, ?, ?, ?)',
                [$procedureOrderId, $seq, $collectedAt, $accessionNo ?? '', 'prelim']
            );
        }
    }
}
