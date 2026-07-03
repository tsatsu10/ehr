<?php

/**
 * M7-F19 documentation integrity report (V1.1-OPS)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportsDocumentationIntegrityService
{
    public function __construct(
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getReport(int $facilityId, ?string $startDate = null, ?string $endDate = null): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        [$startDate, $endDate] = $this->normalizeDateRange($startDate, $endDate);

        $visits = $this->fetchVisitsInRange($facilityId, $startDate, $endDate);
        $visitIds = array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $visits);
        $encounterIds = array_values(array_filter(
            array_map(static fn (array $row): int => (int) ($row['encounter'] ?? 0), $visits),
            static fn (int $id): bool => $id > 0
        ));

        $esignByEncounter = $this->fetchEsignEventsByEncounter($encounterIds);
        $reopenByVisit = $this->fetchReopenEventsByVisit($visitIds);
        $overrideByVisit = $this->fetchOverrideEventsByVisit($visitIds);

        $webroot = $GLOBALS['webroot'] ?? '';
        $rows = [];
        $summary = [
            'visits_with_events' => 0,
            'esign_events' => 0,
            'amendment_events' => 0,
            'reopen_events' => 0,
            'override_events' => 0,
        ];

        foreach ($visits as $visit) {
            $visitId = (int) ($visit['id'] ?? 0);
            $encounterId = (int) ($visit['encounter'] ?? 0);
            $esignEvents = $encounterId > 0 ? ($esignByEncounter[$encounterId] ?? []) : [];
            $reopenEvents = $reopenByVisit[$visitId] ?? [];
            $overrideEvents = $overrideByVisit[$visitId] ?? [];

            if ($esignEvents === [] && $reopenEvents === [] && $overrideEvents === []) {
                continue;
            }

            $summary['visits_with_events']++;
            $summary['esign_events'] += count($esignEvents);
            $summary['amendment_events'] += count(array_filter(
                $esignEvents,
                static fn (array $event): bool => ($event['event_type'] ?? '') === 'amendment'
            ));
            $summary['reopen_events'] += count($reopenEvents);
            $summary['override_events'] += count($overrideEvents);

            $fname = (string) ($visit['fname'] ?? '');
            $lname = (string) ($visit['lname'] ?? '');
            $rows[] = [
                'visit_id' => $visitId,
                'visit_date' => (string) ($visit['visit_date'] ?? ''),
                'queue_number' => (int) ($visit['queue_number'] ?? 0),
                'pubpid' => (string) ($visit['pubpid'] ?? ''),
                'display_name' => trim($fname . ' ' . $lname),
                'encounter_id' => $encounterId > 0 ? $encounterId : null,
                'encounter_url' => $encounterId > 0
                    ? EncounterSignService::buildEncounterUrl($webroot, (int) ($visit['pid'] ?? 0), $encounterId)
                    : null,
                'esign_events' => $esignEvents,
                'reopened_events' => $reopenEvents,
                'esign_override_events' => $overrideEvents,
            ];
        }

        return [
            'enabled' => true,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'summary' => $summary,
            'rows' => $rows,
        ];
    }

    /**
     * @return array{filename: string, content: string, row_count: int}
     */
    public function exportCsv(int $facilityId, ?string $startDate = null, ?string $endDate = null): array
    {
        $report = $this->getReport($facilityId, $startDate, $endDate);
        $rows = is_array($report['rows'] ?? null) ? $report['rows'] : [];

        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Could not open CSV buffer');
        }

        fputcsv($handle, [
            'visit_id',
            'visit_date',
            'queue_number',
            'pubpid',
            'patient_name',
            'encounter_id',
            'event_category',
            'event_type',
            'event_datetime',
            'actor',
            'is_lock',
            'amendment_note',
            'override_reason',
            'reopened_from_state',
            'reopened_reason',
            'encounter_url',
        ]);

        $flatCount = 0;
        foreach ($rows as $visitRow) {
            $base = [
                (int) ($visitRow['visit_id'] ?? 0),
                (string) ($visitRow['visit_date'] ?? ''),
                (int) ($visitRow['queue_number'] ?? 0),
                (string) ($visitRow['pubpid'] ?? ''),
                (string) ($visitRow['display_name'] ?? ''),
                $visitRow['encounter_id'] ?? '',
                (string) ($visitRow['encounter_url'] ?? ''),
            ];

            foreach ((array) ($visitRow['esign_events'] ?? []) as $event) {
                fputcsv($handle, [
                    $base[0],
                    $base[1],
                    $base[2],
                    $base[3],
                    $base[4],
                    $base[5],
                    'esign',
                    (string) ($event['event_type'] ?? ''),
                    (string) ($event['datetime'] ?? ''),
                    (string) ($event['signer_name'] ?? ''),
                    (int) ($event['is_lock'] ?? 0),
                    (string) ($event['amendment'] ?? ''),
                    '',
                    '',
                    '',
                    $base[6],
                ]);
                $flatCount++;
            }

            foreach ((array) ($visitRow['reopened_events'] ?? []) as $event) {
                fputcsv($handle, [
                    $base[0],
                    $base[1],
                    $base[2],
                    $base[3],
                    $base[4],
                    $base[5],
                    'reopened',
                    'reopened',
                    (string) ($event['datetime'] ?? ''),
                    (string) ($event['actor_name'] ?? ''),
                    '',
                    '',
                    '',
                    (string) ($event['from_state'] ?? ''),
                    (string) ($event['reason'] ?? ''),
                    $base[6],
                ]);
                $flatCount++;
            }

            foreach ((array) ($visitRow['esign_override_events'] ?? []) as $event) {
                fputcsv($handle, [
                    $base[0],
                    $base[1],
                    $base[2],
                    $base[3],
                    $base[4],
                    $base[5],
                    'esign_override',
                    'esign_override',
                    (string) ($event['datetime'] ?? ''),
                    (string) ($event['actor_name'] ?? ''),
                    '',
                    '',
                    (string) ($event['reason'] ?? ''),
                    '',
                    '',
                    $base[6],
                ]);
                $flatCount++;
            }
        }

        rewind($handle);
        $content = (string) stream_get_contents($handle);
        fclose($handle);

        $start = (string) ($report['start_date'] ?? $startDate ?? '');
        $end = (string) ($report['end_date'] ?? $endDate ?? $start);

        return [
            'filename' => sprintf('documentation-integrity-%s-to-%s.csv', $start, $end),
            'content' => $content,
            'row_count' => $flatCount,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchVisitsInRange(int $facilityId, string $startDate, string $endDate): array
    {
        return QueryUtils::fetchRecords(
            "SELECT nv.id, nv.pid, nv.visit_date, nv.queue_number, nv.encounter,
                    pat.fname, pat.lname, pat.pubpid
             FROM new_visit nv
             INNER JOIN patient_data pat ON pat.pid = nv.pid
             WHERE nv.facility_id = ?
               AND nv.visit_date BETWEEN ? AND ?
               AND nv.state NOT IN ('cancelled')
             ORDER BY nv.visit_date ASC, nv.queue_number ASC, nv.id ASC",
            [$facilityId, $startDate, $endDate]
        ) ?: [];
    }

    /**
     * @param array<int, int> $encounterIds
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function fetchEsignEventsByEncounter(array $encounterIds): array
    {
        $encounterIds = array_values(array_unique(array_filter($encounterIds, static fn (int $id): bool => $id > 0)));
        if ($encounterIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($encounterIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT es.id, es.tid, es.`table`, es.uid, es.datetime, es.is_lock, es.amendment,
                    u.fname, u.lname, f.encounter AS form_encounter_id
             FROM esign_signatures es
             LEFT JOIN users u ON u.id = es.uid
             LEFT JOIN forms f ON f.id = es.tid AND es.`table` = 'forms'
             WHERE (es.`table` = 'form_encounter' AND es.tid IN ($placeholders))
                OR (es.`table` = 'forms' AND f.encounter IN ($placeholders))
             ORDER BY es.datetime ASC, es.id ASC",
            array_merge($encounterIds, $encounterIds)
        ) ?: [];

        $grouped = [];
        foreach ($rows as $row) {
            $encounterId = (string) ($row['table'] ?? '') === 'form_encounter'
                ? (int) ($row['tid'] ?? 0)
                : (int) ($row['form_encounter_id'] ?? 0);
            if ($encounterId <= 0) {
                continue;
            }

            $amendment = trim((string) ($row['amendment'] ?? ''));
            $isLock = (int) ($row['is_lock'] ?? 0);
            $eventType = $amendment !== '' ? 'amendment' : ($isLock === 1 ? 'lock' : 'signature');

            $signer = trim(((string) ($row['fname'] ?? '')) . ' ' . ((string) ($row['lname'] ?? '')));
            $grouped[$encounterId][] = [
                'datetime' => (string) ($row['datetime'] ?? ''),
                'signer_name' => $signer !== '' ? $signer : null,
                'event_type' => $eventType,
                'is_lock' => $isLock,
                'amendment' => $amendment !== '' ? $amendment : null,
                'table' => (string) ($row['table'] ?? ''),
            ];
        }

        return $grouped;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function fetchReopenEventsByVisit(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, static fn (int $id): bool => $id > 0)));
        if ($visitIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT l.visit_id, l.from_state, l.to_state, l.reason, l.created_at,
                    u.fname, u.lname
             FROM new_visit_state_log l
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE l.visit_id IN ($placeholders)
               AND l.is_reverse = 1
             ORDER BY l.created_at ASC, l.id ASC",
            $visitIds
        ) ?: [];

        $grouped = [];
        foreach ($rows as $row) {
            $visitId = (int) ($row['visit_id'] ?? 0);
            if ($visitId <= 0) {
                continue;
            }
            $actor = trim(((string) ($row['fname'] ?? '')) . ' ' . ((string) ($row['lname'] ?? '')));
            $grouped[$visitId][] = [
                'datetime' => (string) ($row['created_at'] ?? ''),
                'actor_name' => $actor !== '' ? $actor : null,
                'from_state' => (string) ($row['from_state'] ?? ''),
                'to_state' => (string) ($row['to_state'] ?? ''),
                'reason' => (string) ($row['reason'] ?? ''),
            ];
        }

        return $grouped;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, array<int, array<string, mixed>>>
     */
    private function fetchOverrideEventsByVisit(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, static fn (int $id): bool => $id > 0)));
        if ($visitIds === []) {
            return [];
        }

        $visitIdSet = array_fill_keys($visitIds, true);
        $rows = QueryUtils::fetchRecords(
            "SELECT l.date, l.user, l.groupname, l.success, l.comments, l.category
             FROM log l
             WHERE (l.category = 'new_visit'
                    AND (l.success = 'esign_override' OR l.user = 'esign_override'))
                OR l.category = 'esign_override'
             ORDER BY l.date ASC, l.id ASC"
        ) ?: [];

        $grouped = [];
        foreach ($rows as $row) {
            $visitId = $this->parseVisitIdFromLogComments((string) ($row['comments'] ?? ''));
            if ($visitId === null || !isset($visitIdSet[$visitId])) {
                continue;
            }

            $payload = $this->parseJsonPayloadFromLogComments((string) ($row['comments'] ?? ''));
            $reason = trim((string) ($payload['reason'] ?? ''));
            $grouped[$visitId][] = [
                'datetime' => (string) ($row['date'] ?? ''),
                'actor_name' => $this->resolveLogActor($row),
                'reason' => $reason !== '' ? $reason : null,
                'encounter_id' => isset($payload['encounter_id']) ? (int) $payload['encounter_id'] : null,
            ];
        }

        return $grouped;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function resolveLogActor(array $row): ?string
    {
        $user = (string) ($row['user'] ?? '');
        $success = (string) ($row['success'] ?? '');

        // Legacy rows logged before sp41 swapped user/success — actor landed in success.
        if ($user === 'esign_override' && $success !== '' && $success !== 'new_visit') {
            return $success;
        }
        if ($user === 'esign_override') {
            $actor = trim((string) ($row['groupname'] ?? ''));
            return $actor !== '' ? $actor : 'system';
        }

        return $user !== '' ? $user : 'system';
    }

    private function parseVisitIdFromLogComments(string $comments): ?int
    {
        $decoded = $this->decodeLogComments($comments);
        if (preg_match('/visit_id=(\d+)/', $decoded, $matches) === 1) {
            return (int) $matches[1];
        }

        $payload = json_decode($decoded, true);
        if (is_array($payload) && isset($payload['visit_id'])) {
            return (int) $payload['visit_id'];
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function parseJsonPayloadFromLogComments(string $comments): array
    {
        $decoded = $this->decodeLogComments($comments);
        if (preg_match('/;\s*(\{.*\})\s*$/', $decoded, $matches) === 1) {
            $payload = json_decode($matches[1], true);
            return is_array($payload) ? $payload : [];
        }

        $payload = json_decode($decoded, true);
        return is_array($payload) ? $payload : [];
    }

    private function decodeLogComments(string $raw): string
    {
        if ($raw === '') {
            return '';
        }
        if (str_starts_with($raw, 'pid=') || str_starts_with($raw, '{')) {
            return $raw;
        }

        $decoded = base64_decode($raw, true);
        if (is_string($decoded) && $decoded !== '') {
            return $decoded;
        }

        return $raw;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function normalizeDateRange(?string $startDate, ?string $endDate): array
    {
        $today = $this->clinicDate->today();
        $startDate = $this->normalizeDate($startDate) ?? $today;
        $endDate = $this->normalizeDate($endDate) ?? $startDate;

        if ($endDate < $startDate) {
            throw new \InvalidArgumentException('end_date must be on or after start_date');
        }

        return [$startDate, $endDate];
    }

    private function normalizeDate(?string $date): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException('Invalid date format');
        }

        return $date;
    }
}
