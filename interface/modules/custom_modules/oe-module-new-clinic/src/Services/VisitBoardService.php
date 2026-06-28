<?php

/**
 * Visit Board aggregation (M2)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class VisitBoardService
{
    public const COLUMN_STATES = [
        'waiting' => ['waiting'],
        'triage' => ['in_triage'],
        'doctor' => ['ready_for_doctor', 'with_doctor'],
        'lab' => ['ready_for_lab', 'in_lab', 'lab_complete'],
        'pharmacy' => ['ready_for_pharmacy', 'in_pharmacy', 'pharmacy_complete'],
        'payment' => ['ready_for_payment'],
        'done' => ['completed'],
    ];

    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitRowEnricher $rowEnricher = new VisitRowEnricher(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getBoard(int $facilityId, ?string $visitDate = null): array
    {
        $visitDate = $visitDate ?? date('Y-m-d');
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId > 0 ? $facilityId : null);
        $this->visitScope->repairOrphanVisits($facilityId, $visitDate);

        $active = $this->fetchVisits($facilityId, $visitDate, false);
        $cancelled = $this->fetchVisits($facilityId, $visitDate, true);
        $closedUnpaid = $this->fetchClosedUnpaid($facilityId, $visitDate);

        $columns = [];
        foreach (self::COLUMN_STATES as $columnKey => $states) {
            $columns[$columnKey] = array_values(array_filter(
                $active,
                fn (array $row) => in_array($row['state'], $states, true)
            ));
        }

        $counts = [];
        foreach ($columns as $key => $cards) {
            $counts[$key] = count($cards);
        }
        $counts['cancelled'] = count($cancelled);
        $counts['closed_unpaid'] = count($closedUnpaid);

        return [
            'config' => [
                'enable_lab_role' => $this->config->isEnabled('enable_lab_role', 0),
                'enable_pharmacy_role' => $this->config->isEnabled('enable_pharmacy_role', 0),
                'enable_triage' => $this->config->isEnabled('enable_triage', 1),
                'enable_multi_doctor_filters' => $this->config->getInt('enable_multi_doctor_filters', 0, $facilityId) === 1,
            ],
            'columns' => $columns,
            'cancelled' => $cancelled,
            'closed_unpaid' => $closedUnpaid,
            'counts' => $counts,
            'visit_date' => $visitDate,
            'last_updated' => date('c'),
        ];
    }

    private const STATE_LABELS = [
        'waiting' => 'Waiting',
        'in_triage' => 'In triage',
        'ready_for_doctor' => 'Ready for doctor',
        'with_doctor' => 'With doctor',
        'ready_for_lab' => 'Ready for lab',
        'in_lab' => 'In lab',
        'lab_complete' => 'Lab complete',
        'ready_for_pharmacy' => 'Ready for pharmacy',
        'in_pharmacy' => 'In pharmacy',
        'pharmacy_complete' => 'Pharmacy complete',
        'ready_for_payment' => 'Ready to pay',
        'completed' => 'Completed',
        'closed_unpaid' => 'Left unpaid',
        'cancelled' => 'Cancelled',
    ];

    /**
     * @return array<string, mixed>
     */
    public function getVisitDetail(int $visitId, int $actorUserId): array
    {
        $visit = $this->queueService->getVisitForActor($visitId);

        $enriched = $this->enrichVisitRow($visit);
        $skippedTriage = $this->rowEnricher->hasSkippedTriage($visitId);
        $audit = QueryUtils::fetchRecords(
            "SELECT from_state, to_state, actor_user_id, reason, created_at
             FROM new_visit_state_log WHERE visit_id = ? ORDER BY id DESC LIMIT 5",
            [$visitId]
        ) ?: [];
        $pid = (int) ($enriched['pid'] ?? 0);

        return [
            'visit' => $enriched,
            'skipped_triage' => $skippedTriage,
            'audit' => $audit,
            'visit_summary' => $this->buildVisitSummary($enriched, $skippedTriage),
            'audit_timeline' => self::formatAuditTimeline($audit),
            'chart_history_url' => $pid > 0
                ? PatientCompletionService::chartUrl($pid, 'overview') . '&visit_id=' . urlencode((string) $visitId)
                : null,
        ];
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    public function buildVisitSummary(array $visit, bool $skippedTriage): array
    {
        $badges = [];
        if (!empty($visit['is_urgent'])) {
            $badges[] = 'urgent';
        }
        if ($skippedTriage) {
            $badges[] = 'skipped_triage';
        }

        $state = (string) ($visit['state'] ?? '');
        $providerHint = 'Unassigned';
        $assignedId = (int) ($visit['assigned_provider_id'] ?? 0);
        if ($assignedId > 0) {
            $provider = QueryUtils::querySingleRow(
                "SELECT fname, lname FROM users WHERE id = ?",
                [$assignedId]
            );
            if (is_array($provider)) {
                $name = trim(($provider['fname'] ?? '') . ' ' . ($provider['lname'] ?? ''));
                if ($name !== '') {
                    $providerHint = 'Dr ' . $name;
                }
            }
        }

        return [
            'state' => $state,
            'state_label' => self::stateLabel($state),
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'visit_type_label' => (string) ($visit['visit_type_label'] ?? 'Visit'),
            'started_at_label' => self::formatTimeLabel($visit['started_at'] ?? null),
            'wait_minutes' => (int) ($visit['wait_minutes'] ?? 0),
            'provider_hint' => $providerHint,
            'chief_complaint' => $visit['chief_complaint'] ?? null,
            'badges' => $badges,
            'dob_label' => self::formatDobLabel($visit['DOB'] ?? null),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $auditRows
     * @return array<int, array<string, mixed>>
     */
    public static function formatAuditTimeline(array $auditRows): array
    {
        $items = [];
        foreach ($auditRows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $items[] = self::formatAuditItem($row);
        }

        return $items;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private static function formatAuditItem(array $row): array
    {
        $fromState = (string) ($row['from_state'] ?? '');
        $toState = (string) ($row['to_state'] ?? '');
        $reason = trim((string) ($row['reason'] ?? ''));
        $createdAt = (string) ($row['created_at'] ?? '');

        if ($toState === 'cancelled') {
            $label = 'Visit cancelled';
            $subtitle = $reason !== '' ? $reason : null;
        } elseif ($fromState === '' && $toState === 'waiting') {
            $label = 'Visit started';
            $subtitle = null;
        } elseif ($fromState === 'waiting' && $toState === 'ready_for_doctor') {
            $label = 'Skipped triage';
            $subtitle = 'Sent directly to doctor';
        } else {
            $label = 'Moved to ' . self::stateLabel($toState);
            $subtitle = $fromState !== '' ? 'From ' . self::stateLabel($fromState) : null;
        }

        if ($reason !== '' && $toState !== 'cancelled') {
            $subtitle = $subtitle ? ($subtitle . ' — ' . $reason) : $reason;
        }

        return [
            'type' => 'state_changed',
            'label' => $label,
            'subtitle' => $subtitle,
            'at' => $createdAt,
            'at_label' => self::formatTimeLabel($createdAt),
        ];
    }

    public static function stateLabel(string $state): string
    {
        return self::STATE_LABELS[$state] ?? ucwords(str_replace('_', ' ', $state));
    }

    private static function formatTimeLabel(?string $timestamp): ?string
    {
        if ($timestamp === null || $timestamp === '') {
            return null;
        }

        $time = strtotime($timestamp);
        if ($time === false) {
            return null;
        }

        return date('H:i', $time);
    }

    private static function formatDobLabel(?string $dob): ?string
    {
        if ($dob === null || $dob === '' || $dob === '0000-00-00') {
            return null;
        }

        $time = strtotime($dob);
        if ($time === false) {
            return null;
        }

        return date('j M Y', $time);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchVisits(int $facilityId, string $visitDate, bool $cancelledOnly): array
    {
        if ($cancelledOnly) {
            $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                           vt.label AS visit_type_label
                    FROM new_visit v
                    INNER JOIN patient_data pd ON pd.pid = v.pid
                    LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                    WHERE v.facility_id = ? AND v.visit_date = ? AND v.state = 'cancelled'
                    ORDER BY v.cancelled_at DESC, v.queue_number ASC";
            $rows = QueryUtils::fetchRecords($sql, [$facilityId, $visitDate]) ?: [];
        } else {
            $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                           vt.label AS visit_type_label
                    FROM new_visit v
                    INNER JOIN patient_data pd ON pd.pid = v.pid
                    LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                    WHERE v.facility_id = ? AND v.visit_date = ?
                    AND v.state NOT IN ('cancelled', 'closed_unpaid')
                    ORDER BY v.is_urgent DESC, v.queue_number ASC, v.started_at ASC";
            $rows = QueryUtils::fetchRecords($sql, [$facilityId, $visitDate]) ?: [];
        }

        return $this->enrichVisitRows($rows);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function enrichVisitRows(array $rows): array
    {
        $visitIds = array_map(fn (array $row) => (int) ($row['id'] ?? 0), $rows);
        $skippedMap = $this->rowEnricher->batchSkippedTriage($visitIds);

        return array_map(
            fn (array $row) => $this->rowEnricher->enrichVisitRow(
                $row,
                (int) ($row['id'] ?? 0),
                $skippedMap
            ),
            $rows
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchClosedUnpaid(int $facilityId, string $visitDate): array
    {
        $sql = "SELECT v.*, pd.fname, pd.lname, pd.pubpid, pd.sex, pd.DOB,
                       vt.label AS visit_type_label
                FROM new_visit v
                INNER JOIN patient_data pd ON pd.pid = v.pid
                LEFT JOIN new_visit_type vt ON vt.id = v.visit_type_id
                WHERE v.facility_id = ? AND v.visit_date = ? AND v.state = 'closed_unpaid'
                ORDER BY v.left_unpaid_at DESC, v.queue_number ASC";

        $rows = QueryUtils::fetchRecords($sql, [$facilityId, $visitDate]) ?: [];

        return $this->enrichVisitRows($rows);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function enrichVisitRow(array $row): array
    {
        return $this->rowEnricher->enrichVisitRow($row);
    }
}
