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

    public const MAX_LOOKBACK_DAYS = 365;

    public const OLDER_HISTORY_MESSAGE = 'Older history — use Visits tab';

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
        bool $patientAlreadyVerified = false,
        ?int $visitId = null,
        ?int $lookbackDays = null,
    ): array {
        if (!$patientAlreadyVerified) {
            $this->facilityScope->assertPatientAccessible($pid);
        }

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $lookbackDays = $this->resolveLookbackDays($lookbackDays);
        $since = (new \DateTimeImmutable('today'))
            ->modify('-' . $lookbackDays . ' days')
            ->format('Y-m-d 00:00:00');
        $facilityFilter = $this->facilityScope->getVisitFacilityFilterClause('v');

        $actionRequired = $this->buildActionRequired($pid);
        $suppressKeys = $this->buildFeedSuppressKeys($pid, $actionRequired);

        $merged = array_merge(
            $this->fetchStateLogItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchVitalsSavedItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchLabOrderedItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchLabResultReadyItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchRxPrescribedItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchPharmacyDispensedItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchPaymentPostedItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchEncounterSignedItems($pid, $since, $facilityFilter, $visitId),
            $this->fetchHardAssignedItems($pid, $since, $facilityFilter, $visitId),
        );

        usort($merged, static function (array $a, array $b): int {
            return strcmp((string) ($b['occurred_at'] ?? ''), (string) ($a['occurred_at'] ?? ''));
        });

        $filtered = array_values(array_filter(
            $merged,
            static function (array $item) use ($suppressKeys): bool {
                $key = (string) ($item['event_id'] ?? '');
                if ($key === '') {
                    return true;
                }

                return !isset($suppressKeys[$key]);
            }
        ));

        $total = count($filtered);
        $items = array_slice($filtered, $offset, $limit);
        $hasMoreInWindow = ($offset + count($items)) < $total;
        $canExtendLookback = !$hasMoreInWindow && $lookbackDays < self::MAX_LOOKBACK_DAYS;
        $maxLookbackReached = !$hasMoreInWindow && $lookbackDays >= self::MAX_LOOKBACK_DAYS;

        return [
            'items' => $items,
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => $hasMoreInWindow || $canExtendLookback,
            'lookback_days' => $lookbackDays,
            'max_lookback_days' => self::MAX_LOOKBACK_DAYS,
            'can_extend_lookback' => $canExtendLookback,
            'older_history_message' => $maxLookbackReached ? self::OLDER_HISTORY_MESSAGE : null,
        ];
    }

    private function resolveLookbackDays(?int $requested): int
    {
        if ($requested !== null && $requested > 0) {
            return min($requested, self::MAX_LOOKBACK_DAYS);
        }

        $configured = $this->config->getInt('mrd_activity_feed_days', self::LOOKBACK_DAYS);

        return min(max($configured, 1), self::MAX_LOOKBACK_DAYS);
    }

    /**
     * @param array<int, array<string, mixed>> $actionRequired
     * @return array<string, true>
     */
    private function buildFeedSuppressKeys(int $pid, array $actionRequired): array
    {
        $keys = [];

        foreach ($actionRequired as $row) {
            $type = (string) ($row['type'] ?? '');
            $visitId = (int) ($row['visit_id'] ?? 0);
            $entityId = (int) ($row['entity_id'] ?? 0);
            if ($visitId <= 0) {
                continue;
            }

            if ($type === 'unsigned_encounter') {
                $keys['encounter_signed:' . $visitId . ':0'] = true;
            } elseif ($type === 'open_lab_order' && $entityId > 0) {
                $keys['lab_ordered:' . $visitId . ':' . $entityId] = true;
            } elseif ($type === 'open_rx' && $entityId > 0) {
                $keys['rx_prescribed:' . $visitId . ':' . $entityId] = true;
            }
        }

        $activeVisit = $this->resolveActiveVisit($pid);
        if ($activeVisit !== null) {
            $visitId = (int) ($activeVisit['id'] ?? 0);
            $encounterId = (int) ($activeVisit['encounter'] ?? 0);
            $state = (string) ($activeVisit['state'] ?? '');

            if (
                $encounterId > 0
                && in_array($state, EncounterSignService::UNSIGNED_REPORT_STATES, true)
                && !$this->signService->isEncounterDocumentationSigned($encounterId)
            ) {
                $keys['encounter_signed:' . $visitId . ':0'] = true;
            }
        }

        return $keys;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveActiveVisit(int $pid): ?array
    {
        $visit = QueryUtils::querySingleRow(
            "SELECT id, pid, state, queue_number, encounter, facility_id
             FROM new_visit
             WHERE pid = ?
             AND state NOT IN ('completed', 'closed_unpaid', 'cancelled')
             ORDER BY id DESC LIMIT 1",
            [$pid]
        );

        return is_array($visit) && !empty($visit['id']) ? $visit : null;
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchStateLogItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND v.id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT l.id, l.visit_id, l.from_state, l.to_state, l.reason, l.created_at,
                    v.queue_number, v.visit_date, v.state AS visit_state,
                    u.fname, u.lname
             FROM new_visit_state_log l
             INNER JOIN new_visit v ON v.id = l.visit_id
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE v.pid = ? AND l.created_at >= ?{$facilityFilter['sql']}{$visitSql}
             ORDER BY l.created_at DESC, l.id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapStateFeedItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchVitalsSavedItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND nv.id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT fv.id AS vitals_id, fv.bps, fv.bpd, fv.pulse, fv.temperature, fv.oxygen_saturation,
                    fv.respiration, fv.date AS occurred_at, f.encounter AS encounter_id,
                    nv.id AS visit_id, nv.queue_number, u.fname, u.lname
             FROM form_vitals fv
             INNER JOIN forms f ON f.form_id = fv.id AND f.formdir = 'vitals' AND f.deleted = 0
             LEFT JOIN new_visit nv ON nv.pid = f.pid AND nv.encounter = f.encounter
             LEFT JOIN new_visit v ON v.id = nv.id
             WHERE f.pid = ? AND fv.date >= ?{$facilityFilter['sql']}{$visitSql}
             ORDER BY fv.date DESC, fv.id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapVitalsSavedItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchLabOrderedItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND nv.id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT po.procedure_order_id, po.date_ordered, po.encounter_id,
                    poc.procedure_name, nv.id AS visit_id, nv.queue_number
             FROM procedure_order po
             LEFT JOIN procedure_order_code poc
                ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
             LEFT JOIN new_visit v ON v.pid = po.patient_id AND v.encounter = po.encounter_id
             LEFT JOIN new_visit nv ON nv.pid = po.patient_id AND nv.encounter = po.encounter_id
             WHERE po.patient_id = ? AND po.activity = 1 AND po.date_ordered >= DATE(?){$facilityFilter['sql']}{$visitSql}
             ORDER BY po.date_ordered DESC, po.procedure_order_id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapLabOrderedItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchLabResultReadyItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND nv.id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT pr.procedure_report_id, pr.date_report,
                    poc.procedure_name, po.encounter_id,
                    nv.id AS visit_id, nv.queue_number
             FROM procedure_report pr
             INNER JOIN procedure_order po ON po.procedure_order_id = pr.procedure_order_id
             INNER JOIN procedure_order_code poc
                ON poc.procedure_order_id = pr.procedure_order_id
                AND poc.procedure_order_seq = pr.procedure_order_seq
             LEFT JOIN new_visit v ON v.pid = po.patient_id AND v.encounter = po.encounter_id
             LEFT JOIN new_visit nv ON nv.pid = po.patient_id AND nv.encounter = po.encounter_id
             WHERE po.patient_id = ? AND pr.review_status = 'reviewed'
               AND pr.date_report >= ?{$facilityFilter['sql']}{$visitSql}
             ORDER BY pr.date_report DESC, pr.procedure_report_id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapLabResultReadyItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchRxPrescribedItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND nv.id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT rx.id AS prescription_id, rx.drug, rx.date_added, rx.encounter AS encounter_id,
                    nv.id AS visit_id, nv.queue_number
             FROM prescriptions rx
             LEFT JOIN new_visit v ON v.pid = rx.patient_id AND v.encounter = rx.encounter
             LEFT JOIN new_visit nv ON nv.pid = rx.patient_id AND nv.encounter = rx.encounter
             WHERE rx.patient_id = ? AND rx.active = 1 AND rx.date_added >= DATE(?){$facilityFilter['sql']}{$visitSql}
             ORDER BY rx.date_added DESC, rx.id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapRxPrescribedItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchPharmacyDispensedItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND nv.id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT ds.sale_id, ds.sale_date, ds.quantity, ds.prescription_id,
                    d.name AS drug_name,
                    nv.id AS visit_id, nv.queue_number
             FROM drug_sales ds
             INNER JOIN drugs d ON d.drug_id = ds.drug_id
             LEFT JOIN new_visit v ON v.pid = ds.pid AND v.encounter = ds.encounter
             LEFT JOIN new_visit nv ON nv.pid = ds.pid AND nv.encounter = ds.encounter
             WHERE ds.pid = ? AND ds.prescription_id > 0 AND ds.trans_type = 1
               AND ds.sale_date >= DATE(?){$facilityFilter['sql']}{$visitSql}
             ORDER BY ds.sale_date DESC, ds.sale_id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapPharmacyDispensedItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchPaymentPostedItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND r.visit_id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT r.id, r.receipt_number, r.amount_paid, r.created_at, r.visit_id, r.encounter,
                    v.queue_number, u.fname, u.lname
             FROM new_receipt r
             LEFT JOIN new_visit v ON v.id = r.visit_id
             LEFT JOIN users u ON u.id = r.actor_user_id
             WHERE r.pid = ? AND r.created_at >= ?{$facilityFilter['sql']}{$visitSql}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapPaymentPostedItem($row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchEncounterSignedItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $visitSql = $visitId !== null && $visitId > 0 ? ' AND nv.id = ?' : '';
        $bind = array_merge([$pid, $since], $facilityFilter['bind']);
        if ($visitSql !== '') {
            $bind[] = $visitId;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT es.id AS signature_id, es.datetime AS occurred_at, es.user,
                    f.encounter AS encounter_id, nv.id AS visit_id, nv.queue_number,
                    u.fname, u.lname
             FROM esign_signatures es
             INNER JOIN forms f ON f.id = es.tid AND es.`table` = 'forms'
             LEFT JOIN new_visit nv ON nv.pid = f.pid AND nv.encounter = f.encounter
             LEFT JOIN new_visit v ON v.id = nv.id
             LEFT JOIN users u ON u.username = es.user
             WHERE f.pid = ? AND es.is_lock = 1 AND es.datetime >= ?{$facilityFilter['sql']}{$visitSql}
             ORDER BY es.datetime DESC, es.id DESC
             LIMIT 500",
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapEncounterSignedItem($pid, $row), $rows);
    }

    /**
     * @param array{sql: string, bind: array<int, mixed>} $facilityFilter
     * @return array<int, array<string, mixed>>
     */
    private function fetchHardAssignedItems(
        int $pid,
        string $since,
        array $facilityFilter,
        ?int $visitId,
    ): array {
        $rows = QueryUtils::fetchRecords(
            "SELECT l.id, l.date AS occurred_at, l.comments, l.user
             FROM log l
             WHERE l.category = 'new_visit'
               AND l.success = 'hard_assigned'
               AND l.comments LIKE ?
               AND l.date >= ?
             ORDER BY l.date DESC, l.id DESC
             LIMIT 200",
            ['pid=' . $pid . ';%', $since]
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $parsedVisitId = $this->parseVisitIdFromLogComments((string) ($row['comments'] ?? ''));
            if ($visitId !== null && $visitId > 0 && $parsedVisitId !== $visitId) {
                continue;
            }

            $visitRow = $parsedVisitId > 0
                ? QueryUtils::querySingleRow(
                    "SELECT v.id, v.queue_number FROM new_visit v
                     WHERE v.id = ? AND v.pid = ?{$facilityFilter['sql']}",
                    array_merge([$parsedVisitId, $pid], $facilityFilter['bind'])
                )
                : null;

            if ($parsedVisitId > 0 && !is_array($visitRow)) {
                continue;
            }

            $items[] = $this->mapHardAssignedItem($row, $parsedVisitId, is_array($visitRow) ? $visitRow : []);
        }

        return $items;
    }

    private function parseVisitIdFromLogComments(string $comments): int
    {
        if (preg_match('/visit_id=(\d+)/', $comments, $matches) === 1) {
            return (int) ($matches[1] ?? 0);
        }

        return 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildActionRequired(int $pid): array
    {
        $visit = $this->resolveActiveVisit($pid);
        if ($visit === null) {
            return [];
        }

        $visitId = (int) ($visit['id'] ?? 0);
        $encounterId = (int) ($visit['encounter'] ?? 0);
        $state = (string) ($visit['state'] ?? '');
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $webroot = $GLOBALS['webroot'] ?? '';
        $items = [];

        if (
            $encounterId > 0
            && in_array($state, EncounterSignService::UNSIGNED_REPORT_STATES, true)
            && !$this->signService->isEncounterDocumentationSigned($encounterId)
        ) {
            $requireSign = $this->config->getInt('require_esign_before_complete_consult', 0, $facilityId) === 1;
            $items[] = [
                'type' => 'unsigned_encounter',
                'title' => 'Documentation unsigned',
                'message' => $requireSign
                    ? 'Sign encounter documentation before completing the consult.'
                    : 'Encounter documentation is unsigned — payment will be blocked until signed.',
                'badge' => 'Unsigned',
                'visit_id' => $visitId,
                'entity_id' => $encounterId,
                'queue_number' => (int) ($visit['queue_number'] ?? 0),
                'action_url' => EncounterSignService::buildEncounterUrl($webroot, $pid, $encounterId),
            ];
        }

        if ($encounterId > 0) {
            $openLabOrders = QueryUtils::fetchRecords(
                "SELECT po.procedure_order_id, poc.procedure_name
                 FROM procedure_order po
                 LEFT JOIN procedure_order_code poc
                    ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
                 WHERE po.patient_id = ? AND po.encounter_id = ? AND po.activity = 1
                   AND LOWER(COALESCE(po.order_status, '')) NOT IN ('complete', 'completed', 'cancelled')
                 ORDER BY po.date_ordered DESC
                 LIMIT 5",
                [(int) ($visit['pid'] ?? $pid), $encounterId]
            ) ?: [];

            foreach ($openLabOrders as $orderRow) {
                $orderId = (int) ($orderRow['procedure_order_id'] ?? 0);
                $label = trim((string) ($orderRow['procedure_name'] ?? ''));
                if ($label === '') {
                    $label = 'Lab order #' . $orderId;
                }
                $items[] = [
                    'type' => 'open_lab_order',
                    'title' => 'Open lab order',
                    'message' => $label,
                    'badge' => 'Pending',
                    'visit_id' => $visitId,
                    'entity_id' => $orderId,
                    'queue_number' => (int) ($visit['queue_number'] ?? 0),
                    'action_url' => EncounterSignService::buildEncounterUrl(
                        $webroot,
                        $pid,
                        $encounterId
                    ),
                ];
            }

            $openRxRows = QueryUtils::fetchRecords(
                "SELECT id, drug
                 FROM prescriptions
                 WHERE patient_id = ? AND encounter = ? AND active = 1
                   AND (filled_date IS NULL OR filled_date = '' OR filled_date = '0000-00-00')
                 ORDER BY id DESC
                 LIMIT 5",
                [(int) ($visit['pid'] ?? $pid), $encounterId]
            ) ?: [];

            foreach ($openRxRows as $rxRow) {
                $rxId = (int) ($rxRow['id'] ?? 0);
                $items[] = [
                    'type' => 'open_rx',
                    'title' => 'Prescription to dispense',
                    'message' => trim((string) ($rxRow['drug'] ?? 'Medication')),
                    'badge' => 'Rx',
                    'visit_id' => $visitId,
                    'entity_id' => $rxId,
                    'queue_number' => (int) ($visit['queue_number'] ?? 0),
                    'action_url' => EncounterSignService::buildEncounterUrl(
                        $webroot,
                        $pid,
                        $encounterId
                    ),
                ];
            }
        }

        return $items;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapStateFeedItem(array $row): array
    {
        $fromState = $row['from_state'] ?? null;
        $toState = (string) ($row['to_state'] ?? '');
        $reason = trim((string) ($row['reason'] ?? ''));
        $actor = trim(((string) ($row['fname'] ?? '')) . ' ' . ((string) ($row['lname'] ?? '')));
        if ($actor === '') {
            $actor = 'System';
        }

        $visitId = (int) ($row['visit_id'] ?? 0);
        $logId = (int) ($row['id'] ?? 0);
        $eventType = $this->resolveStateEventType(
            $fromState === null || $fromState === '' ? null : (string) $fromState,
            $toState,
            $reason
        );
        $createdAt = (string) ($row['created_at'] ?? '');

        $title = match ($eventType) {
            'visit_created' => 'Visit started',
            'visit_cancelled' => 'Visit cancelled',
            'routing_confirmed' => 'Consult routing confirmed',
            'lab_complete' => 'Lab complete',
            'pharmacy_complete' => 'Pharmacy complete',
            default => 'Visit: ' . $this->formatStateLabel((string) $fromState)
                . ' → ' . $this->formatStateLabel($toState),
        };

        return [
            'event_type' => $eventType,
            'event_id' => $eventType . ':' . $visitId . ':' . $logId,
            'title' => $title,
            'subtitle' => $actor . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'from_state' => $fromState,
                'to_state' => $toState,
                'reason' => $reason !== '' ? $reason : null,
                'visit_date' => $row['visit_date'] ?? null,
            ],
            'primary_action' => [
                'label' => 'Details',
                'kind' => 'expand',
            ],
            'secondary_action' => [
                'label' => 'View on Visit Board',
                'kind' => 'board',
            ],
        ];
    }

    private function resolveStateEventType(?string $fromState, string $toState, string $reason): string
    {
        if ($toState === 'cancelled') {
            return 'visit_cancelled';
        }

        if ($fromState === null || $fromState === '') {
            return 'visit_created';
        }

        if ($fromState === 'with_doctor' && in_array($toState, ['ready_for_lab', 'ready_for_pharmacy', 'ready_for_payment'], true)) {
            return 'routing_confirmed';
        }

        if ($toState === 'lab_complete') {
            return 'lab_complete';
        }

        if ($toState === 'pharmacy_complete') {
            return 'pharmacy_complete';
        }

        if (str_contains($reason, 'complete_consult')) {
            return 'routing_confirmed';
        }

        return 'state_changed';
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapVitalsSavedItem(array $row): array
    {
        $visitId = (int) ($row['visit_id'] ?? 0);
        $vitalsId = (int) ($row['vitals_id'] ?? 0);
        $createdAt = (string) ($row['occurred_at'] ?? '');
        $summaryParts = array_filter([
            !empty($row['bps']) || !empty($row['bpd']) ? trim((string) ($row['bps'] ?? '') . '/' . (string) ($row['bpd'] ?? '')) . ' mmHg' : null,
            !empty($row['pulse']) ? 'HR ' . $row['pulse'] : null,
            !empty($row['temperature']) ? 'T ' . $row['temperature'] : null,
            !empty($row['oxygen_saturation']) ? 'SpO₂ ' . $row['oxygen_saturation'] : null,
            !empty($row['respiration']) ? 'RR ' . $row['respiration'] : null,
        ]);

        return [
            'event_type' => 'vitals_saved',
            'event_id' => 'vitals_saved:' . $visitId . ':' . $vitalsId,
            'title' => 'Vitals recorded',
            'subtitle' => ($summaryParts !== [] ? implode(' · ', $summaryParts) . ' · ' : '')
                . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'encounter_id' => (int) ($row['encounter_id'] ?? 0),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'summary' => implode(' · ', $summaryParts),
            ],
            'primary_action' => [
                'label' => 'Details',
                'kind' => 'expand',
            ],
            'secondary_action' => [
                'label' => 'Open vitals',
                'kind' => 'tab',
                'target' => 'clinical-vitals',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapLabOrderedItem(array $row): array
    {
        $visitId = (int) ($row['visit_id'] ?? 0);
        $orderId = (int) ($row['procedure_order_id'] ?? 0);
        $procedureName = trim((string) ($row['procedure_name'] ?? 'Lab test'));
        $createdAt = (string) ($row['date_ordered'] ?? '');

        return [
            'event_type' => 'lab_ordered',
            'event_id' => 'lab_ordered:' . $visitId . ':' . $orderId,
            'title' => 'Lab order placed',
            'subtitle' => $procedureName . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'encounter_id' => (int) ($row['encounter_id'] ?? 0),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'procedure_name' => $procedureName,
                'procedure_order_id' => $orderId,
            ],
            'primary_action' => [
                'label' => 'Open labs',
                'kind' => 'tab',
                'target' => 'clinical-labs',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapLabResultReadyItem(array $row): array
    {
        $procedureName = trim((string) ($row['procedure_name'] ?? 'Lab test'));
        $visitId = (int) ($row['visit_id'] ?? 0);
        $reportId = (int) ($row['procedure_report_id'] ?? 0);
        $createdAt = (string) ($row['date_report'] ?? '');

        return [
            'event_type' => 'lab_result_ready',
            'event_id' => 'lab_result_ready:' . $visitId . ':' . $reportId,
            'title' => 'Lab result ready',
            'subtitle' => $procedureName . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'procedure_name' => $procedureName,
                'procedure_report_id' => $reportId,
                'encounter_id' => (int) ($row['encounter_id'] ?? 0),
            ],
            'primary_action' => [
                'label' => 'Details',
                'kind' => 'expand',
            ],
            'secondary_action' => [
                'label' => 'Open labs',
                'kind' => 'tab',
                'target' => 'clinical-labs',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRxPrescribedItem(array $row): array
    {
        $visitId = (int) ($row['visit_id'] ?? 0);
        $rxId = (int) ($row['prescription_id'] ?? 0);
        $drugName = trim((string) ($row['drug'] ?? 'Medication'));
        $createdAt = (string) ($row['date_added'] ?? '');

        return [
            'event_type' => 'rx_prescribed',
            'event_id' => 'rx_prescribed:' . $visitId . ':' . $rxId,
            'title' => 'Prescription written',
            'subtitle' => $drugName . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'encounter_id' => (int) ($row['encounter_id'] ?? 0),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'drug_name' => $drugName,
                'prescription_id' => $rxId,
            ],
            'primary_action' => [
                'label' => 'Open medications',
                'kind' => 'tab',
                'target' => 'clinical-meds',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapPharmacyDispensedItem(array $row): array
    {
        $drugName = trim((string) ($row['drug_name'] ?? 'Medication'));
        $qty = (int) round((float) ($row['quantity'] ?? 0));
        $visitId = (int) ($row['visit_id'] ?? 0);
        $saleId = (int) ($row['sale_id'] ?? 0);
        $createdAt = (string) ($row['sale_date'] ?? '');

        return [
            'event_type' => 'pharmacy_dispensed',
            'event_id' => 'pharmacy_dispensed:' . $visitId . ':' . $saleId,
            'title' => 'Medication dispensed',
            'subtitle' => $drugName . ($qty > 0 ? ' × ' . $qty : '') . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'drug_name' => $drugName,
                'quantity' => $qty,
                'prescription_id' => (int) ($row['prescription_id'] ?? 0),
                'sale_id' => $saleId,
            ],
            'primary_action' => [
                'label' => 'Details',
                'kind' => 'expand',
            ],
            'secondary_action' => [
                'label' => 'Open medications',
                'kind' => 'tab',
                'target' => 'clinical-meds',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapPaymentPostedItem(array $row): array
    {
        $visitId = (int) ($row['visit_id'] ?? 0);
        $receiptId = (int) ($row['id'] ?? 0);
        $amount = number_format((float) ($row['amount_paid'] ?? 0), 2);
        $receiptNumber = trim((string) ($row['receipt_number'] ?? ''));
        $createdAt = (string) ($row['created_at'] ?? '');
        $cashier = trim(((string) ($row['fname'] ?? '')) . ' ' . ((string) ($row['lname'] ?? '')));

        return [
            'event_type' => 'payment_posted',
            'event_id' => 'payment_posted:' . $visitId . ':' . $receiptId,
            'title' => 'Payment posted',
            'subtitle' => ($receiptNumber !== '' ? '#' . $receiptNumber . ' · ' : '')
                . $amount
                . ($cashier !== '' ? ' · ' . $cashier : '')
                . ' · '
                . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'encounter_id' => (int) ($row['encounter'] ?? 0),
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'receipt_number' => $receiptNumber,
                'amount_paid' => $amount,
                'cashier' => $cashier !== '' ? $cashier : null,
            ],
            'primary_action' => [
                'label' => 'View payments',
                'kind' => 'tab',
                'target' => 'profile',
            ],
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapEncounterSignedItem(int $pid, array $row): array
    {
        $visitId = (int) ($row['visit_id'] ?? 0);
        $signatureId = (int) ($row['signature_id'] ?? 0);
        $encounterId = (int) ($row['encounter_id'] ?? 0);
        $createdAt = (string) ($row['occurred_at'] ?? '');
        $signer = trim(((string) ($row['fname'] ?? '')) . ' ' . ((string) ($row['lname'] ?? '')));
        if ($signer === '') {
            $signer = trim((string) ($row['user'] ?? 'Staff'));
        }
        $webroot = $GLOBALS['webroot'] ?? '';

        return [
            'event_type' => 'encounter_signed',
            'event_id' => 'encounter_signed:' . $visitId . ':' . $signatureId,
            'title' => 'Documentation signed',
            'subtitle' => $signer . ' · ' . $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'encounter_id' => $encounterId,
            'queue_number' => (int) ($row['queue_number'] ?? 0),
            'expand' => [
                'signer' => $signer,
                'encounter_id' => $encounterId,
            ],
            'primary_action' => [
                'label' => 'Details',
                'kind' => 'expand',
            ],
            'secondary_action' => $encounterId > 0 ? [
                'label' => 'Open encounter',
                'kind' => 'core',
                'target' => EncounterSignService::buildEncounterUrl($webroot, $pid, $encounterId),
            ] : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $visitRow
     * @return array<string, mixed>
     */
    private function mapHardAssignedItem(array $row, int $visitId, array $visitRow): array
    {
        $logId = (int) ($row['id'] ?? 0);
        $createdAt = (string) ($row['occurred_at'] ?? '');
        $payload = [];
        $comments = (string) ($row['comments'] ?? '');
        if (preg_match('/\{.*\}$/s', $comments, $matches) === 1) {
            $decoded = json_decode($matches[0], true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }

        $providerId = (int) ($payload['hard_assigned_provider_id'] ?? 0);
        $providerName = 'Assigned provider';
        if ($providerId > 0) {
            $provider = QueryUtils::querySingleRow(
                'SELECT fname, lname FROM users WHERE id = ?',
                [$providerId]
            );
            if (is_array($provider)) {
                $name = trim(((string) ($provider['fname'] ?? '')) . ' ' . ((string) ($provider['lname'] ?? '')));
                if ($name !== '') {
                    $providerName = 'Dr ' . $name;
                }
            }
        }

        return [
            'event_type' => 'hard_assigned',
            'event_id' => 'hard_assigned:' . $visitId . ':' . $logId,
            'title' => 'Assigned: ' . $providerName,
            'subtitle' => $this->relativeTime($createdAt),
            'occurred_at' => $createdAt,
            'visit_id' => $visitId,
            'queue_number' => (int) ($visitRow['queue_number'] ?? 0),
            'expand' => [
                'provider_id' => $providerId,
                'provider_name' => $providerName,
            ],
            'primary_action' => [
                'label' => 'Details',
                'kind' => 'expand',
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
