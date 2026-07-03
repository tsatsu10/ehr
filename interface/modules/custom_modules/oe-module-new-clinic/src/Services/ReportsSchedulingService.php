<?php

/**
 * M7-F16 scheduling funnel metrics (orthogonal to visit throughput)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReportsSchedulingService
{
    public function __construct(
        private readonly ScheduledIntegrationService $scheduledIntegration = new ScheduledIntegrationService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
        private readonly QueueBridgeSurfaceService $queueBridgeSurface = new QueueBridgeSurfaceService(),
        private readonly ReportsSchedulingAnalyticsService $fullAnalytics = new ReportsSchedulingAnalyticsService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getReport(int $facilityId, ?string $visitDate = null): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $visitDate = $visitDate ?? $this->clinicDate->today();

        if (!$this->scheduledIntegration->isEnabled($facilityId)) {
            return [
                'enabled' => false,
                'visit_date' => $visitDate,
            ];
        }

        $weekStart = date('Y-m-d', strtotime('monday this week', strtotime($visitDate)));
        $weekEnd = date('Y-m-d', strtotime('sunday this week', strtotime($visitDate)));

        $booked = $this->countAppointments($facilityId, $visitDate, null);
        $bookedWeek = $this->countAppointmentsRange($facilityId, $weekStart, $weekEnd, null);
        $arrived = $this->countAppointments($facilityId, $visitDate, '@');
        $noShow = $this->countAppointments($facilityId, $visitDate, '?');
        $visitMix = $this->visitMix($facilityId, $visitDate);
        $recallFunnel = $this->recallFunnel($facilityId, $visitDate);

        $payload = [
            'enabled' => true,
            'visit_date' => $visitDate,
            'booked_today' => $booked,
            'booked_week' => $bookedWeek,
            'week_range' => ['start' => $weekStart, 'end' => $weekEnd],
            'arrival_funnel' => [
                'booked' => $booked,
                'arrived' => $arrived,
                'no_show' => $noShow,
            ],
            'walk_in_vs_scheduled' => $visitMix,
            'recall_funnel' => $recallFunnel,
            'orthogonality_note' => 'Scheduling counts appointments; Visits tab counts clinical queue — do not add them together.',
            'queue_bridge' => $this->queueBridgeSurface->schedulingFooter($facilityId),
            'full_analytics' => [
                'enabled' => $this->fullAnalytics->isEnabled($facilityId),
            ],
        ];

        if ($this->fullAnalytics->isEnabled($facilityId)) {
            $payload['full_analytics'] = $this->fullAnalytics->buildPayload($facilityId, $visitDate);
        }

        return $payload;
    }

    private function countAppointments(int $facilityId, string $date, ?string $status): int
    {
        return $this->countAppointmentsRange($facilityId, $date, $date, $status);
    }

    private function countAppointmentsRange(int $facilityId, string $startDate, string $endDate, ?string $status): int
    {
        $bind = [$startDate, $endDate];
        $facilitySql = '';
        if ($facilityId > 0) {
            $facilitySql = ' AND (pce.pc_facility = ? OR pce.pc_facility = 0)';
            $bind[] = $facilityId;
        }
        $statusSql = '';
        if ($status !== null) {
            $statusSql = ' AND pce.pc_apptstatus = ?';
            $bind[] = $status;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt
             FROM openemr_postcalendar_events pce
             WHERE pce.pc_eventDate BETWEEN ? AND ?
               AND pce.pc_eventstatus = 1
               AND pce.pc_pid IS NOT NULL AND pce.pc_pid != '' AND pce.pc_pid != '0'
               {$facilitySql}
               {$statusSql}",
            $bind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array{scheduled: int, walk_in: int, scheduled_pct: float}
     */
    private function visitMix(int $facilityId, string $date): array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT
                SUM(CASE WHEN pc_eid IS NOT NULL AND pc_eid > 0 THEN 1 ELSE 0 END) AS scheduled_cnt,
                SUM(CASE WHEN pc_eid IS NULL OR pc_eid = 0 THEN 1 ELSE 0 END) AS walk_in_cnt
             FROM new_visit
             WHERE facility_id = ? AND visit_date = ?
               AND state NOT IN ('cancelled')",
            [$facilityId, $date]
        ) ?: ['scheduled_cnt' => 0, 'walk_in_cnt' => 0];

        $scheduled = (int) ($row['scheduled_cnt'] ?? 0);
        $walkIn = (int) ($row['walk_in_cnt'] ?? 0);
        $total = $scheduled + $walkIn;
        $pct = $total > 0 ? round(($scheduled / $total) * 100, 1) : 0.0;

        return [
            'scheduled' => $scheduled,
            'walk_in' => $walkIn,
            'scheduled_pct' => $pct,
        ];
    }

    /**
     * @return array{due: int, booked: int, completed: int, overdue: int}
     */
    private function recallFunnel(int $facilityId, string $today): array
    {
        $facilitySql = '';
        $bind = [$today, $today];
        if ($facilityId > 0) {
            $facilitySql = ' AND mr.r_facility = ?';
            $bind[] = $facilityId;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT
                SUM(CASE WHEN mr.r_eventDate = ? AND IFNULL(meta.status, 'open') NOT IN ('completed','declined','unreachable') THEN 1 ELSE 0 END) AS due_cnt,
                SUM(CASE WHEN meta.produced_eid IS NOT NULL AND meta.produced_eid > 0 AND IFNULL(meta.status, 'open') = 'scheduled' THEN 1 ELSE 0 END) AS booked_cnt,
                SUM(CASE WHEN IFNULL(meta.status, 'open') = 'completed' THEN 1 ELSE 0 END) AS completed_cnt,
                SUM(CASE WHEN mr.r_eventDate < ? AND IFNULL(meta.status, 'open') NOT IN ('completed','declined','unreachable','scheduled') THEN 1 ELSE 0 END) AS overdue_cnt
             FROM medex_recalls mr
             LEFT JOIN new_clinic_recall_meta meta ON meta.recall_id = mr.r_ID
             INNER JOIN patient_data pat ON pat.pid = mr.r_pid AND IFNULL(pat.deceased_date, 0) = 0
             WHERE 1=1 {$facilitySql}",
            $bind
        ) ?: [];

        return [
            'due' => (int) ($row['due_cnt'] ?? 0),
            'booked' => (int) ($row['booked_cnt'] ?? 0),
            'completed' => (int) ($row['completed_cnt'] ?? 0),
            'overdue' => (int) ($row['overdue_cnt'] ?? 0),
        ];
    }
}
