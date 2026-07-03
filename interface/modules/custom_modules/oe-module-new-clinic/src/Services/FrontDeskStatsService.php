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
}
