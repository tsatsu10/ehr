<?php

/**
 * S1-F09 full scheduling analytics — slot→check-in latency and provider utilization
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportsSchedulingAnalyticsService
{
    public const ON_TIME_WINDOW_MINUTES = 15;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_scheduling_full_analytics', 0, $facilityId) === 1;
    }

    /**
     * @return array<string, mixed>
     */
    public function buildPayload(int $facilityId, string $visitDate): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);

        return [
            'enabled' => true,
            'visit_date' => $visitDate,
            'on_time_window_minutes' => self::ON_TIME_WINDOW_MINUTES,
            'check_in_latency' => $this->checkInLatency($facilityId, $visitDate),
            'provider_utilization' => $this->providerUtilization($facilityId, $visitDate),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function checkInLatency(int $facilityId, string $visitDate): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT nv.id AS visit_id,
                    nv.started_at,
                    TIMESTAMPDIFF(
                        MINUTE,
                        STR_TO_DATE(
                            CONCAT(pce.pc_eventDate, ' ', COALESCE(NULLIF(pce.pc_startTime, ''), '00:00:00')),
                            '%Y-%m-%d %H:%i:%s'
                        ),
                        nv.started_at
                    ) AS latency_minutes
             FROM new_visit nv
             INNER JOIN openemr_postcalendar_events pce ON pce.pc_eid = nv.pc_eid
             WHERE nv.facility_id = ?
               AND nv.visit_date = ?
               AND nv.pc_eid IS NOT NULL AND nv.pc_eid > 0
               AND nv.state NOT IN ('cancelled')
               AND pce.pc_apptstatus = '@'
               AND nv.started_at IS NOT NULL
               AND pce.pc_eventDate = nv.appt_date",
            [$facilityId, $visitDate]
        ) ?: [];

        $latencies = array_values(array_map(
            static fn (array $row): int => (int) ($row['latency_minutes'] ?? 0),
            $rows
        ));

        return $this->summarizeLatencies($latencies);
    }

    /**
     * @param array<int, int> $latencies
     * @return array<string, mixed>
     */
    public function summarizeLatencies(array $latencies): array
    {
        $sampleCount = count($latencies);
        if ($sampleCount === 0) {
            return [
                'sample_count' => 0,
                'median_minutes' => null,
                'p90_minutes' => null,
                'average_minutes' => null,
                'on_time_count' => 0,
                'on_time_pct' => 0.0,
                'early_count' => 0,
                'late_count' => 0,
            ];
        }

        sort($latencies, SORT_NUMERIC);
        $onTimeCount = 0;
        $earlyCount = 0;
        $lateCount = 0;
        $sum = 0;

        foreach ($latencies as $minutes) {
            $sum += $minutes;
            if ($minutes < 0) {
                $earlyCount++;
                $onTimeCount++;
            } elseif ($minutes <= self::ON_TIME_WINDOW_MINUTES) {
                $onTimeCount++;
            } else {
                $lateCount++;
            }
        }

        return [
            'sample_count' => $sampleCount,
            'median_minutes' => self::percentile($latencies, 50),
            'p90_minutes' => self::percentile($latencies, 90),
            'average_minutes' => round($sum / $sampleCount, 1),
            'on_time_count' => $onTimeCount,
            'on_time_pct' => round(($onTimeCount / $sampleCount) * 100, 1),
            'early_count' => $earlyCount,
            'late_count' => $lateCount,
        ];
    }

    /**
     * @param array<int, int> $sortedValues
     */
    public static function percentile(array $sortedValues, int $percentile): int
    {
        if ($sortedValues === []) {
            return 0;
        }

        $index = (int) ceil(($percentile / 100) * count($sortedValues)) - 1;
        $index = max(0, min($index, count($sortedValues) - 1));

        return (int) $sortedValues[$index];
    }

    /**
     * @return array<string, mixed>
     */
    public function providerUtilization(int $facilityId, string $visitDate): array
    {
        $bind = [$facilityId, $visitDate];
        $facilitySql = ' AND (pce.pc_facility = ? OR pce.pc_facility = 0)';
        $bind[] = $facilityId;

        $rows = QueryUtils::fetchRecords(
            "SELECT u.id AS provider_id,
                    TRIM(CONCAT(COALESCE(u.fname, ''), ' ', COALESCE(u.lname, ''))) AS provider_name,
                    COUNT(DISTINCT pce.pc_eid) AS booked,
                    SUM(CASE WHEN pce.pc_apptstatus = '@' THEN 1 ELSE 0 END) AS arrived,
                    COUNT(DISTINCT nv.id) AS visits_started
             FROM openemr_postcalendar_events pce
             LEFT JOIN users u ON u.id = pce.pc_aid
             LEFT JOIN new_visit nv ON nv.pc_eid = pce.pc_eid
                AND nv.visit_date = pce.pc_eventDate
                AND nv.facility_id = ?
                AND nv.state NOT IN ('cancelled')
             WHERE pce.pc_eventDate = ?
               AND pce.pc_eventstatus = 1
               AND pce.pc_pid IS NOT NULL AND pce.pc_pid != '' AND pce.pc_pid != '0'
               AND pce.pc_aid IS NOT NULL AND pce.pc_aid > 0
               {$facilitySql}
             GROUP BY u.id, u.fname, u.lname
             ORDER BY booked DESC, provider_name ASC",
            $bind
        ) ?: [];

        $providers = [];
        foreach ($rows as $row) {
            $booked = (int) ($row['booked'] ?? 0);
            $arrived = (int) ($row['arrived'] ?? 0);
            $visitsStarted = (int) ($row['visits_started'] ?? 0);
            $name = trim((string) ($row['provider_name'] ?? ''));
            if ($name === '') {
                $name = 'Provider #' . (int) ($row['provider_id'] ?? 0);
            }

            $providers[] = [
                'provider_id' => (int) ($row['provider_id'] ?? 0),
                'provider_name' => $name,
                'booked' => $booked,
                'arrived' => $arrived,
                'visits_started' => $visitsStarted,
                'arrival_pct' => $booked > 0 ? round(($arrived / $booked) * 100, 1) : 0.0,
                'visit_start_pct' => $arrived > 0 ? round(($visitsStarted / $arrived) * 100, 1) : 0.0,
            ];
        }

        return [
            'providers' => $providers,
            'provider_count' => count($providers),
        ];
    }
}
