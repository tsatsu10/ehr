<?php

/**
 * Today-at-this-desk strip stats (PAGE_DESIGNS §7.2.8)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class FrontDeskStatsService
{
    public function __construct(
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array{
     *   visits_started_today: int,
     *   waiting_count: int,
     *   recent_starts: array<int, array<string, mixed>>
     * }
     */
    public function getDeskStats(int $actorUserId, int $facilityId): array
    {
        $this->visitScope->assertFacilityAccessible($facilityId);
        $today = $this->clinicDate->today();

        $startedRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM new_visit
             WHERE created_by = ? AND facility_id = ? AND visit_date = ?",
            [$actorUserId, $facilityId, $today]
        );
        $waitingRow = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM new_visit
             WHERE facility_id = ? AND visit_date = ? AND state = 'waiting'",
            [$facilityId, $today]
        );

        $recentRows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, v.queue_number, v.state, v.pid,
                    TRIM(CONCAT(pd.fname, ' ', pd.lname)) AS display_name,
                    pd.pubpid
             FROM new_visit v
             INNER JOIN patient_data pd ON pd.pid = v.pid
             WHERE v.created_by = ? AND v.facility_id = ? AND v.visit_date = ?
             ORDER BY v.started_at DESC, v.id DESC
             LIMIT 5",
            [$actorUserId, $facilityId, $today]
        ) ?: [];

        $recent = array_map(static function (array $row): array {
            return [
                'visit_id' => (int) ($row['visit_id'] ?? 0),
                'queue_number' => (int) ($row['queue_number'] ?? 0),
                'state' => (string) ($row['state'] ?? ''),
                'pid' => (int) ($row['pid'] ?? 0),
                'display_name' => (string) ($row['display_name'] ?? ''),
                'pubpid' => (string) ($row['pubpid'] ?? ''),
            ];
        }, $recentRows);

        return [
            'visits_started_today' => is_array($startedRow) ? (int) ($startedRow['cnt'] ?? 0) : 0,
            'waiting_count' => is_array($waitingRow) ? (int) ($waitingRow['cnt'] ?? 0) : 0,
            'recent_starts' => $recent,
        ];
    }

    /**
     * @return array{
     *   hourly_visits: list<array{hour: int, count: int}>,
     *   adherence: array{scheduled: int, arrived: int, no_show: int, pending: int},
     *   wait_avg_today_mins: int,
     *   wait_avg_yesterday_mins: int,
     * }
     */
    public function getFlowCharts(int $facilityId): array
    {
        $today = $this->clinicDate->today();
        $yesterday = date('Y-m-d', strtotime($today . ' -1 day'));

        // ── Hourly visit volume today ────────────────────────────────────────
        $hourlyRows = QueryUtils::fetchRecords(
            "SELECT HOUR(started_at) AS hr, COUNT(*) AS cnt
             FROM new_visit
             WHERE facility_id = ? AND visit_date = ? AND started_at IS NOT NULL
             GROUP BY HOUR(started_at)
             ORDER BY hr",
            [$facilityId, $today]
        ) ?: [];

        $hourlyMap = [];
        foreach ($hourlyRows as $row) {
            $hourlyMap[(int) $row['hr']] = (int) $row['cnt'];
        }

        $hourlyVisits = [];
        $openHour  = 6;
        $closeHour = 20;
        for ($h = $openHour; $h <= $closeHour; $h++) {
            $hourlyVisits[] = ['hour' => $h, 'count' => $hourlyMap[$h] ?? 0];
        }

        // ── Appointment adherence (today, this facility) ─────────────────────
        $apptRows = QueryUtils::fetchRecords(
            "SELECT pce.pc_apptstatus,
                    (SELECT COUNT(*) FROM new_visit nv
                     WHERE nv.pc_eid = pce.pc_eid AND nv.visit_date = ?) AS has_visit
             FROM openemr_postcalendar_events pce
             WHERE DATE(pce.pc_eventDate) = ?
               AND pce.pc_facility = ?
               AND pce.pc_apptstatus NOT IN ('~', 'x~')",
            [$today, $today, $facilityId]
        ) ?: [];

        $adherence = ['scheduled' => 0, 'arrived' => 0, 'no_show' => 0, 'pending' => 0];
        foreach ($apptRows as $row) {
            $adherence['scheduled']++;
            $status = trim((string) ($row['pc_apptstatus'] ?? ''));
            if ($status === 'x') {
                $adherence['no_show']++;
            } elseif ((int) ($row['has_visit'] ?? 0) > 0 || in_array($status, ['@', '$', '<'], true)) {
                $adherence['arrived']++;
            } else {
                $adherence['pending']++;
            }
        }

        // ── Average wait time (started_at → completed_at for completed visits) ─
        $avgToday = QueryUtils::querySingleRow(
            "SELECT AVG(TIMESTAMPDIFF(MINUTE, started_at, completed_at)) AS avg_wait
             FROM new_visit
             WHERE facility_id = ? AND visit_date = ?
               AND completed_at IS NOT NULL AND started_at IS NOT NULL",
            [$facilityId, $today]
        );
        $avgYesterday = QueryUtils::querySingleRow(
            "SELECT AVG(TIMESTAMPDIFF(MINUTE, started_at, completed_at)) AS avg_wait
             FROM new_visit
             WHERE facility_id = ? AND visit_date = ?
               AND completed_at IS NOT NULL AND started_at IS NOT NULL",
            [$facilityId, $yesterday]
        );

        return [
            'hourly_visits'           => $hourlyVisits,
            'adherence'               => $adherence,
            'wait_avg_today_mins'     => is_array($avgToday) ? (int) round((float) ($avgToday['avg_wait'] ?? 0)) : 0,
            'wait_avg_yesterday_mins' => is_array($avgYesterday) ? (int) round((float) ($avgYesterday['avg_wait'] ?? 0)) : 0,
        ];
    }
}
