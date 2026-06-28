<?php

/**
 * Patient chart Overview activity feed (M0-F27 / MRD §8.4)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PatientActivityFeedService
{
    public const PAGE_SIZE = 25;

    public const LOOKBACK_DAYS = 90;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly EncounterSignService $signService = new EncounterSignService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getOverviewBlocks(int $pid, bool $patientAlreadyVerified = false): array
    {
        if (!$patientAlreadyVerified) {
            $this->facilityScope->assertPatientAccessible($pid);
        }

        return [
            'action_required' => $this->buildActionRequired($pid),
            'activity_feed' => $this->getActivityFeed($pid, 0, self::PAGE_SIZE, true),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getActivityFeed(
        int $pid,
        int $offset = 0,
        int $limit = self::PAGE_SIZE,
        bool $patientAlreadyVerified = false
    ): array {
        if (!$patientAlreadyVerified) {
            $this->facilityScope->assertPatientAccessible($pid);
        }

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $since = (new \DateTimeImmutable('today'))
            ->modify('-' . self::LOOKBACK_DAYS . ' days')
            ->format('Y-m-d 00:00:00');
        $facilityFilter = $this->facilityScope->getVisitFacilityFilterClause('v');
        $countBind = array_merge([$pid, $since], $facilityFilter['bind']);

        $stateTotalRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM new_visit_state_log l
             INNER JOIN new_visit v ON v.id = l.visit_id
             WHERE v.pid = ? AND l.created_at >= ?{$facilityFilter['sql']}",
            $countBind
        );
        $stateTotal = is_array($stateTotalRow) ? (int) ($stateTotalRow['cnt'] ?? 0) : 0;

        $labBind = array_merge([$pid, $since], $facilityFilter['bind']);
        $labTotalRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM procedure_report pr
             INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
             LEFT JOIN new_visit v ON v.pid = po.patient_id AND v.encounter = po.encounter_id
             WHERE po.patient_id = ? AND pr.review_status = 'reviewed'
               AND pr.date_report >= ?{$facilityFilter['sql']}",
            $labBind
        );
        $labTotal = is_array($labTotalRow) ? (int) ($labTotalRow['cnt'] ?? 0) : 0;
        $total = $stateTotal + $labTotal;

        $fetchSize = min($offset + $limit + 50, 500);
        $stateItems = $this->fetchStateLogItems($pid, $since, $fetchSize, 0, $facilityFilter);
        $labItems = $this->fetchLabResultReadyItems($pid, $since, $fetchSize, 0, $facilityFilter);
        $merged = array_merge($stateItems, $labItems);
        usort($merged, static function (array $a, array $b): int {
            return strcmp((string) ($b['occurred_at'] ?? ''), (string) ($a['occurred_at'] ?? ''));
        });
        $items = array_slice($merged, $offset, $limit);

        return [
            'items' => $items,
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($items)) < $total,
            'lookback_days' => self::LOOKBACK_DAYS,
        ];
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchStateLogItems(
        int $pid,
        string $since,
        int $limit,
        int $offset,
        array $facilityFilter
    ): array {
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        $rows = QueryUtils::fetchRecords(
            "SELECT l.id, l.visit_id, l.from_state, l.to_state, l.reason, l.created_at,
                    v.queue_number, v.visit_date, v.state AS visit_state,
                    u.fname, u.lname
             FROM new_visit_state_log l
             INNER JOIN new_visit v ON v.id = l.visit_id
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE v.pid = ? AND l.created_at >= ?{$facilityFilter['sql']}
             ORDER BY l.created_at DESC, l.id DESC
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapFeedItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchLabResultReadyItems(
        int $pid,
        string $since,
        int $limit,
        int $offset,
        array $facilityFilter
    ): array {
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        $rows = QueryUtils::fetchRecords(
            "SELECT pr.procedure_report_id, pr.date_report,
                    pc.procedure_name, po.encounter_id,
                    nv.id AS visit_id, nv.queue_number
             FROM procedure_report pr
             INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
             INNER JOIN procedure_order_code pc
                ON pc.procedure_order_id = pr.procedure_order_id
                AND pc.procedure_order_seq = pr.procedure_order_seq
             LEFT JOIN new_visit v ON v.pid = po.patient_id AND v.encounter = po.encounter_id
             LEFT JOIN new_visit nv ON nv.pid = po.patient_id AND nv.encounter = po.encounter_id
             WHERE po.patient_id = ? AND pr.review_status = 'reviewed'
               AND pr.date_report >= ?{$facilityFilter['sql']}
             ORDER BY pr.date_report DESC, pr.procedure_report_id DESC
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapLabResultReadyItem($row), $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildActionRequired(int $pid): array
    {
        $visit = QueryUtils::querySingleRow(
            "SELECT id, state, queue_number, encounter, facility_id
             FROM new_visit
             WHERE pid = ? AND visit_date = CURDATE()
             AND state NOT IN ('completed', 'closed_unpaid', 'cancelled')
             ORDER BY id DESC LIMIT 1",
            [$pid]
        );

        if (!is_array($visit) || empty($visit['id'])) {
            return [];
        }

        $encounterId = (int) ($visit['encounter'] ?? 0);
        $state = (string) ($visit['state'] ?? '');
        if ($encounterId <= 0 || !in_array($state, EncounterSignService::UNSIGNED_REPORT_STATES, true)) {
            return [];
        }

        if ($this->signService->isEncounterDocumentationSigned($encounterId)) {
            return [];
        }

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $requireSign = $this->config->getInt('require_esign_before_complete_consult', 0, $facilityId) === 1;
        $webroot = $GLOBALS['webroot'] ?? '';

        return [[
            'type' => 'unsigned_encounter',
            'title' => 'Documentation unsigned',
            'message' => $requireSign
                ? 'Sign encounter documentation before completing the consult.'
                : 'Encounter documentation is unsigned — payment will be blocked until signed.',
            'badge' => 'Unsigned',
            'visit_id' => (int) $visit['id'],
            'queue_number' => (int) ($visit['queue_number'] ?? 0),
            'action_url' => EncounterSignService::buildEncounterUrl($webroot, $pid, $encounterId),
        ]];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapLabResultReadyItem(array $row): array
    {
        $procedureName = trim((string) ($row['procedure_name'] ?? 'Lab test'));
        $createdAt = (string) ($row['date_report'] ?? '');

        return [
            'event_type' => 'lab_result_ready',
            'title' => 'Lab result ready',
            'subtitle' => $procedureName . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => (int) ($row['visit_id'] ?? 0),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'procedure_name' => $procedureName,
                'procedure_report_id' => (int) ($row['procedure_report_id'] ?? 0),
                'encounter_id' => (int) ($row['encounter_id'] ?? 0),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapFeedItem(array $row): array
    {
        $fromState = $row['from_state'] ?? null;
        $toState = (string) ($row['to_state'] ?? '');
        $actor = trim(((string) ($row['fname'] ?? '')) . ' ' . ((string) ($row['lname'] ?? '')));
        if ($actor === '') {
            $actor = 'System';
        }

        $title = $fromState === null || $fromState === ''
            ? 'Visit started'
            : 'Visit: ' . $this->formatStateLabel((string) $fromState)
                . ' → ' . $this->formatStateLabel($toState);

        $createdAt = (string) ($row['created_at'] ?? '');

        return [
            'event_type' => $fromState === null || $fromState === '' ? 'visit_created' : 'state_changed',
            'title' => $title,
            'subtitle' => $actor . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => (int) ($row['visit_id'] ?? 0),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'from_state' => $fromState,
                'to_state' => $toState,
                'reason' => $row['reason'] ?? null,
                'visit_date' => $row['visit_date'] ?? null,
            ],
        ];
    }

    private function formatStateLabel(string $state): string
    {
        return ucwords(str_replace('_', ' ', $state));
    }

    private function relativeTime(string $datetime): string
    {
        if ($datetime === '') {
            return '—';
        }

        try {
            $then = new \DateTimeImmutable($datetime);
            $diff = $then->diff(new \DateTimeImmutable('now'));
            if ($diff->days > 0) {
                return $diff->days . 'd ago';
            }
            if ($diff->h > 0) {
                return $diff->h . 'h ago';
            }
            if ($diff->i > 0) {
                return $diff->i . 'm ago';
            }

            return 'just now';
        } catch (\Exception) {
            return $datetime;
        }
    }
}
