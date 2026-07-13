<?php

/**
 * S1 Recalls lens — H1-safe worklist and recall CRUD (PRD §6.7 H1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Modules\NewClinic\Support\Sanitize;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\RecallMessaging\RecallMessagingFactory;
use OpenEMR\Modules\NewClinic\Services\RecallMessaging\RecallMessagingPort;

class SchedulingRecallsService
{
    /** @var list<string> */
    public const OPEN_STATUSES = ['open', 'contacted', 'scheduled', 'snoozed'];

    /** @var list<string> */
    public const TERMINAL_STATUSES = ['completed', 'declined', 'unreachable'];

    /** @var list<string> */
    public const ALL_STATUSES = ['open', 'contacted', 'scheduled', 'completed', 'declined', 'unreachable', 'snoozed'];

    /** @var list<string> */
    public const RECALL_TYPES = ['general', 'follow_up', 'preventive', 'chronic', 'dental'];

    public function __construct(
        private readonly SchedulingAccessService $access = new SchedulingAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly SchedulingShellService $shell = new SchedulingShellService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getWorklist(
        int $facilityId,
        ?int $providerId = null,
        string $bucket = 'due',
        ?int $pid = null,
        string $search = '',
    ): array {
        $this->access->assertHubAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $today = $this->clinicDate->today();
        $rows = $this->fetchRecallRows($facilityId, $providerId, $pid, $search);
        $mapped = array_map(fn (array $row): array => $this->mapRecallRow($row, $today), $rows);

        $counts = [
            'overdue' => 0,
            'due' => 0,
            'upcoming' => 0,
            'completed' => 0,
        ];
        foreach ($mapped as $row) {
            $counts[$row['bucket']]++;
        }

        $filtered = array_values(array_filter(
            $mapped,
            static function (array $row) use ($bucket, $pid): bool {
                if ($pid !== null && $pid > 0 && (int) ($row['pid'] ?? 0) !== $pid) {
                    return false;
                }
                if ($pid !== null && $pid > 0) {
                    return true;
                }

                return $row['bucket'] === $bucket;
            },
        ));

        return [
            'bucket' => $bucket,
            'facility_id' => $facilityId,
            'provider_id' => $providerId,
            'today' => $today,
            'counts' => $counts,
            'rows' => $filtered,
            'can_manage' => $this->access->canBookAppointment(),
            'providers' => $this->shell->getBootstrapPayload($facilityId)['providers'],
            'recall_types' => $this->recallTypeOptions(),
            'messaging_enabled' => $this->messaging()->isConfigured(),
        ];
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function saveRecall(int $facilityId, array $input, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Recall write permission denied', 403);
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $recallId = (int) ($input['recall_id'] ?? 0);
        $pid = (int) ($input['pid'] ?? 0);
        $dueDate = trim((string) ($input['due_date'] ?? ''));
        $reason = trim((string) ($input['reason'] ?? ''));
        $providerId = (int) ($input['provider_id'] ?? 0);
        $targetFacility = (int) ($input['facility_id'] ?? $facilityId);

        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
        if ($dueDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
            throw new \InvalidArgumentException('Valid due date is required');
        }
        if ($providerId <= 0) {
            throw new \InvalidArgumentException('Provider is required');
        }
        if ($targetFacility <= 0) {
            throw new \InvalidArgumentException('Facility is required');
        }

        if ($recallId > 0) {
            $existing = QueryUtils::fetchRecords(
                'SELECT r_ID FROM medex_recalls WHERE r_ID = ?',
                [$recallId],
            );
            if (empty($existing)) {
                throw new \InvalidArgumentException('Recall not found');
            }
            QueryUtils::sqlStatementThrowException(
                'UPDATE medex_recalls SET r_pid = ?, r_reason = ?, r_eventDate = ?, r_provider = ?, r_facility = ? WHERE r_ID = ?',
                [$pid, $reason, $dueDate, $providerId, $targetFacility, $recallId],
            );
        } else {
            QueryUtils::sqlStatementThrowException(
                'INSERT INTO medex_recalls (r_PRACTID, r_pid, r_reason, r_eventDate, r_provider, r_facility)
                 VALUES (0, ?, ?, ?, ?, ?)',
                [$pid, $reason, $dueDate, $providerId, $targetFacility],
            );
            $row = QueryUtils::querySingleRow(
                'SELECT r_ID FROM medex_recalls WHERE r_pid = ? ORDER BY r_ID DESC LIMIT 1',
                [$pid],
            );
            $recallId = (int) ($row['r_ID'] ?? 0);
        }

        if ($recallId <= 0) {
            throw new \RuntimeException('Failed to save recall');
        }

        $recallType = $this->normalizeRecallType((string) ($input['recall_type'] ?? 'general'));
        $this->upsertMeta($recallId, (string) ($input['status'] ?? 'open'), null, $actorUserId, $recallType);

        return $this->getWorklist(
            $facilityId,
            isset($input['filter_provider_id']) ? (int) $input['filter_provider_id'] : null,
            (string) ($input['bucket'] ?? 'due'),
            null,
            '',
        );
    }

    /**
     * A5/G5 — "Flag for follow-up" from the patient chart. Creates a recall of
     * type `follow_up` so it lands in the existing S1 Recalls worklist rather
     * than a parallel follow-up store. Same write ACL as every other recall
     * (assertHubAccess + canBookAppointment); the chart only shows the entry
     * point when both hold. Provider defaults to the patient's assigned provider,
     * falling back to the acting user, so `r_provider` is always populated.
     *
     * @return array<string, mixed>
     */
    public function flagFollowUp(int $pid, string $dueDate, string $reason, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Recall write permission denied', 403);
        }

        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
        $dueDate = trim($dueDate);
        if (
            $dueDate === ''
            || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dueDate, $dateParts)
            || !checkdate((int) $dateParts[2], (int) $dateParts[3], (int) $dateParts[1])
        ) {
            throw new \InvalidArgumentException('Valid due date is required');
        }
        $reason = trim($reason);
        if ($reason === '') {
            $reason = 'Follow-up';
        }
        $reason = mb_substr($reason, 0, 255);

        $facilityId = $this->visitScope->resolveDeskFacilityId();
        $providerId = $this->resolveFollowUpProvider($pid, $actorUserId);
        if ($providerId <= 0) {
            throw new \RuntimeException('No provider available to own the follow-up', 400);
        }

        QueryUtils::sqlStatementThrowException(
            'INSERT INTO medex_recalls (r_PRACTID, r_pid, r_reason, r_eventDate, r_provider, r_facility)
             VALUES (0, ?, ?, ?, ?, ?)',
            [$pid, $reason, $dueDate, $providerId, $facilityId],
        );
        $row = QueryUtils::querySingleRow(
            'SELECT r_ID FROM medex_recalls WHERE r_pid = ? ORDER BY r_ID DESC LIMIT 1',
            [$pid],
        );
        $recallId = (int) ($row['r_ID'] ?? 0);
        if ($recallId <= 0) {
            throw new \RuntimeException('Failed to create follow-up');
        }

        $this->upsertMeta($recallId, 'open', null, $actorUserId, 'follow_up');

        return [
            'recall_id' => $recallId,
            'pid' => $pid,
            'due_date' => $dueDate,
            'reason' => $reason,
        ];
    }

    private function resolveFollowUpProvider(int $pid, int $actorUserId): int
    {
        $row = QueryUtils::querySingleRow('SELECT providerID FROM patient_data WHERE pid = ?', [$pid]);
        $providerId = is_array($row) ? (int) ($row['providerID'] ?? 0) : 0;
        if ($providerId > 0) {
            return $providerId;
        }

        return $actorUserId > 0 ? $actorUserId : 0;
    }

    public function deleteRecall(int $recallId, int $actorUserId): void
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Recall write permission denied', 403);
        }
        if ($recallId <= 0) {
            throw new \InvalidArgumentException('Recall is required');
        }

        QueryUtils::sqlStatementThrowException('DELETE FROM new_clinic_recall_meta WHERE recall_id = ?', [$recallId]);
        QueryUtils::sqlStatementThrowException('DELETE FROM medex_recalls WHERE r_ID = ?', [$recallId]);
    }

    /**
     * @return array<string, mixed>
     */
    public function updateStatus(int $recallId, string $status, ?string $note, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Recall write permission denied', 403);
        }
        if ($recallId <= 0) {
            throw new \InvalidArgumentException('Recall is required');
        }
        if (!in_array($status, self::ALL_STATUSES, true)) {
            throw new \InvalidArgumentException('Invalid recall status');
        }

        $this->upsertMeta($recallId, $status, $note, $actorUserId);

        return ['recall_id' => $recallId, 'status' => $status];
    }

    /**
     * @return array<string, mixed>
     */
    public function sendRecallReminder(int $recallId, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Recall write permission denied', 403);
        }
        if ($recallId <= 0) {
            throw new \InvalidArgumentException('Recall is required');
        }

        $row = QueryUtils::querySingleRow(
            'SELECT r_pid FROM medex_recalls WHERE r_ID = ?',
            [$recallId],
        );
        if (empty($row['r_pid'])) {
            throw new \InvalidArgumentException('Recall not found');
        }

        $pid = (int) $row['r_pid'];
        $queued = $this->messaging()->queueRecallReminder($recallId, $pid, $actorUserId);
        if (!$queued) {
            throw new \RuntimeException('Automated messaging is not available for this clinic');
        }

        return [
            'recall_id' => $recallId,
            'queued' => true,
            'delivery' => $this->messaging()->getRecallDeliveryStatus($recallId, $pid),
        ];
    }

    public function linkProducedAppointment(int $recallId, int $pcEid, int $actorUserId): void
    {
        if ($recallId <= 0 || $pcEid <= 0) {
            return;
        }

        QueryUtils::sqlStatementThrowException(
            'INSERT INTO new_clinic_recall_meta (recall_id, status, produced_eid, updated_by)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), produced_eid = VALUES(produced_eid), updated_by = VALUES(updated_by)',
            [$recallId, 'scheduled', $pcEid, $actorUserId],
        );
    }

    /**
     * S-P5 — close recall loop when linked appointment is checked in at Front Desk.
     */
    public function completeLinkedRecallOnCheckIn(int $pcEid, int $pid, int $actorUserId): bool
    {
        if ($pcEid <= 0 || $pid <= 0) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT meta.recall_id
             FROM new_clinic_recall_meta AS meta
             INNER JOIN medex_recalls AS mr ON mr.r_ID = meta.recall_id
             WHERE meta.produced_eid = ?
               AND mr.r_pid = ?
               AND meta.status IN (?, ?, ?)',
            [$pcEid, $pid, 'open', 'contacted', 'scheduled'],
        );

        $recallId = is_array($row) ? (int) ($row['recall_id'] ?? 0) : 0;
        if ($recallId <= 0) {
            return false;
        }

        $this->upsertMeta(
            $recallId,
            'completed',
            'Completed via Front Desk check-in',
            $actorUserId,
        );

        return true;
    }

    /**
     * Snooze recall by pushing due date (recall fields only — H1).
     *
     * @return array<string, mixed>
     */
    public function snoozeRecall(int $recallId, int $days, int $actorUserId, string $note = ''): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Recall write permission denied', 403);
        }
        if ($recallId <= 0) {
            throw new \InvalidArgumentException('Recall is required');
        }
        if ($days <= 0) {
            throw new \InvalidArgumentException('Snooze days must be positive');
        }

        $row = QueryUtils::querySingleRow(
            'SELECT r_eventDate FROM medex_recalls WHERE r_ID = ?',
            [$recallId],
        );
        if (empty($row['r_eventDate'])) {
            throw new \InvalidArgumentException('Recall not found');
        }

        $newDate = date('Y-m-d', strtotime((string) $row['r_eventDate'] . ' +' . $days . ' days'));
        QueryUtils::sqlStatementThrowException(
            'UPDATE medex_recalls SET r_eventDate = ? WHERE r_ID = ?',
            [$newDate, $recallId],
        );
        $this->upsertMeta($recallId, 'snoozed', $note !== '' ? $note : ('Snoozed ' . $days . ' days'), $actorUserId);

        return ['recall_id' => $recallId, 'due_date' => $newDate, 'status' => 'snoozed'];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchRecallRows(int $facilityId, ?int $providerId, ?int $pid, string $search): array
    {
        $bind = [];
        $where = ['IFNULL(pat.deceased_date, 0) = 0'];

        if ($facilityId > 0) {
            $where[] = 'mr.r_facility = ?';
            $bind[] = $facilityId;
        }
        if ($providerId !== null && $providerId > 0) {
            $where[] = 'mr.r_provider = ?';
            $bind[] = $providerId;
        }
        if ($pid !== null && $pid > 0) {
            $where[] = 'mr.r_pid = ?';
            $bind[] = $pid;
        }
        $search = Sanitize::searchToken($search);
        if ($search !== '') {
            $like = '%' . $search . '%';
            $where[] = '(pat.fname LIKE ? OR pat.lname LIKE ? OR pat.pubpid LIKE ? OR mr.r_reason LIKE ?)';
            array_push($bind, $like, $like, $like, $like);
        }

        $sql = 'SELECT mr.r_ID, mr.r_pid, mr.r_eventDate, mr.r_facility, mr.r_provider, mr.r_reason,
                       pat.fname, pat.lname, pat.pubpid, pat.phone_home, pat.phone_cell, pat.email,
                       pat.hipaa_allowsms, pat.hipaa_allowemail, pat.hipaa_voice,
                       meta.status AS recall_status, meta.produced_eid, meta.outcome_note, meta.recall_type,
                       appt.pc_eventDate AS produced_event_date
                FROM medex_recalls AS mr
                INNER JOIN patient_data AS pat ON pat.pid = mr.r_pid
                LEFT JOIN new_clinic_recall_meta AS meta ON meta.recall_id = mr.r_ID
                LEFT JOIN openemr_postcalendar_events AS appt ON appt.pc_eid = meta.produced_eid
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY mr.r_eventDate ASC, pat.lname ASC, pat.fname ASC';

        return QueryUtils::fetchRecords($sql, $bind) ?: [];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRecallRow(array $row, string $today): array
    {
        $dueDate = (string) ($row['r_eventDate'] ?? '');
        $status = (string) ($row['recall_status'] ?? 'open');
        if ($status === '') {
            $status = 'open';
        }

        $bucket = $this->resolveBucket($dueDate, $status, $today);
        $daysDelta = $this->daysFromToday($dueDate, $today);
        $fname = trim((string) ($row['fname'] ?? ''));
        $lname = trim((string) ($row['lname'] ?? ''));
        $pid = (int) ($row['r_pid'] ?? 0);

        return [
            'recall_id' => (int) ($row['r_ID'] ?? 0),
            'pid' => $pid,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'patient_name' => trim($fname . ' ' . $lname) ?: ('PID ' . $pid),
            'due_date' => $dueDate,
            'days_delta' => $daysDelta,
            'bucket' => $bucket,
            'reason' => (string) ($row['r_reason'] ?? ''),
            'provider_id' => (int) ($row['r_provider'] ?? 0),
            'facility_id' => (int) ($row['r_facility'] ?? 0),
            'status' => $status,
            'status_label' => $this->statusLabel($status),
            'recall_type' => $this->normalizeRecallType((string) ($row['recall_type'] ?? 'general')),
            'recall_type_label' => $this->recallTypeLabel((string) ($row['recall_type'] ?? 'general')),
            'messaging' => $this->messaging()->getRecallDeliveryStatus((int) ($row['r_ID'] ?? 0), $pid),
            'produced_eid' => isset($row['produced_eid']) ? (int) $row['produced_eid'] : null,
            'produced_event_date' => (string) ($row['produced_event_date'] ?? ''),
            'outcome_note' => (string) ($row['outcome_note'] ?? ''),
            'contact' => $this->contactSummary($row),
        ];
    }

    private function resolveBucket(string $dueDate, string $status, string $today): string
    {
        if (in_array($status, self::TERMINAL_STATUSES, true)) {
            return 'completed';
        }

        if ($dueDate === '') {
            return 'upcoming';
        }
        if ($dueDate < $today) {
            return 'overdue';
        }
        if ($dueDate === $today) {
            return 'due';
        }

        return 'upcoming';
    }

    private function daysFromToday(string $dueDate, string $today): int
    {
        if ($dueDate === '') {
            return 0;
        }
        $dueTs = strtotime($dueDate);
        $todayTs = strtotime($today);
        if ($dueTs === false || $todayTs === false) {
            return 0;
        }

        return (int) round(($dueTs - $todayTs) / 86400);
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'open' => 'Open',
            'contacted' => 'Contacted',
            'scheduled' => 'Scheduled',
            'completed' => 'Completed',
            'declined' => 'Declined',
            'unreachable' => 'Unreachable',
            'snoozed' => 'Snoozed',
            default => ucfirst($status),
        };
    }

    /**
     * @param array<string, mixed> $row
     */
    private function contactSummary(array $row): string
    {
        $parts = [];
        if (!empty($row['hipaa_allowsms'])) {
            $parts[] = 'SMS ok';
        }
        if (!empty($row['hipaa_allowemail'])) {
            $parts[] = 'Email ok';
        }
        if (!empty($row['hipaa_voice'])) {
            $parts[] = 'Voice ok';
        }
        if ($parts === []) {
            return 'No consent flags';
        }

        return implode(' · ', $parts);
    }

    private function upsertMeta(
        int $recallId,
        string $status,
        ?string $note,
        int $actorUserId,
        ?string $recallType = null,
    ): void {
        if ($recallType !== null) {
            QueryUtils::sqlStatementThrowException(
                'INSERT INTO new_clinic_recall_meta (recall_id, status, recall_type, outcome_note, updated_by)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status),
                 recall_type = VALUES(recall_type),
                 outcome_note = COALESCE(VALUES(outcome_note), outcome_note),
                 updated_by = VALUES(updated_by)',
                [$recallId, $status, $this->normalizeRecallType($recallType), $note, $actorUserId],
            );

            return;
        }

        QueryUtils::sqlStatementThrowException(
            'INSERT INTO new_clinic_recall_meta (recall_id, status, recall_type, outcome_note, updated_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status),
             outcome_note = COALESCE(VALUES(outcome_note), outcome_note),
             updated_by = VALUES(updated_by)',
            [$recallId, $status, 'general', $note, $actorUserId],
        );
    }

    private function messaging(): RecallMessagingPort
    {
        return RecallMessagingFactory::create();
    }

    /**
     * @return list<array{id: string, label: string}>
     */
    private function recallTypeOptions(): array
    {
        $options = [];
        foreach (self::RECALL_TYPES as $type) {
            $options[] = ['id' => $type, 'label' => $this->recallTypeLabel($type)];
        }

        return $options;
    }

    private function normalizeRecallType(string $type): string
    {
        $type = strtolower(trim($type));

        return in_array($type, self::RECALL_TYPES, true) ? $type : 'general';
    }

    private function recallTypeLabel(string $type): string
    {
        return match ($this->normalizeRecallType($type)) {
            'follow_up' => 'Follow-up',
            'preventive' => 'Preventive',
            'chronic' => 'Chronic care',
            'dental' => 'Dental',
            default => 'General',
        };
    }
}
