<?php

/**
 * Today's appointment lookup for Front Desk chips (M0-F16 / PAGE_DESIGNS §7.2)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class AppointmentTodayService
{
    public function __construct(
        private readonly ScheduledIntegrationService $scheduledIntegration = new ScheduledIntegrationService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>|null Chip payload for search/preview when appointment exists today
     */
    public function chipForPatient(int $pid, ?int $facilityId = null): ?array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId);
        if (!$this->scheduledIntegration->isEnabled($facilityId)) {
            return null;
        }

        $appointment = $this->findNearestTodayAppointment($pid, $facilityId);
        if ($appointment === null) {
            return null;
        }

        $providerName = trim((string) ($appointment['provider_fname'] ?? '') . ' ' . (string) ($appointment['provider_lname'] ?? ''));
        $isRecurring = (int) ($appointment['pc_recurrtype'] ?? 0) !== 0;
        $defaultVisitTypeId = $this->resolveVisitTypeIdForCategory(
            (int) ($appointment['pc_catid'] ?? 0),
            $facilityId
        );

        return [
            'pc_eid' => (int) ($appointment['pc_eid'] ?? 0),
            'appt_date' => (string) ($appointment['pc_eventDate'] ?? ''),
            'pc_catid' => (int) ($appointment['pc_catid'] ?? 0),
            'is_recurring' => $isRecurring,
            'provider_name' => $providerName !== '' ? $providerName : null,
            'start_time_label' => $this->formatStartTime($appointment['pc_startTime'] ?? null),
            'default_visit_type_id' => $defaultVisitTypeId,
            'tooltip' => $isRecurring
                ? xl('Recurring booking — today\'s visit starts normally; the series is not marked arrived automatically.')
                : null,
        ];
    }

    public function countTodayAtFacility(int $facilityId): int
    {
        if (!$this->scheduledIntegration->isEnabled($facilityId)) {
            return 0;
        }

        $bind = [];
        $sql = "SELECT COUNT(*) AS cnt
                FROM openemr_postcalendar_events pce
                WHERE pce.pc_eventDate = CURDATE()
                  AND pce.pc_eventstatus = 1
                  AND pce.pc_apptstatus NOT IN ('*', '%', 'x', 'X')
                  AND pce.pc_pid IS NOT NULL AND pce.pc_pid != '' AND pce.pc_pid != '0'";

        if ($facilityId > 0) {
            $sql .= ' AND (pce.pc_facility = ? OR pce.pc_facility = 0)';
            $bind[] = $facilityId;
        }

        $row = QueryUtils::querySingleRow($sql, $bind);

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * Today's scheduled patients for Front Desk search idle state (M1a).
     *
     * @return array<int, array<string, mixed>>
     */
    public function listTodayAppointments(int $facilityId, int $limit = 50): array
    {
        $facilityId = $this->visitScope->resolveActorFacilityId($facilityId);
        if (!$this->scheduledIntegration->isEnabled($facilityId)) {
            return [];
        }

        $this->visitScope->assertFacilityAccessible($facilityId);
        $limit = max(1, min($limit, 100));

        $bind = [];
        $sql = "SELECT pce.pc_eid, pce.pc_pid, pce.pc_startTime,
                       TRIM(CONCAT(pd.fname, ' ', pd.lname)) AS display_name,
                       pd.pubpid,
                       u.fname AS provider_fname, u.lname AS provider_lname
                FROM openemr_postcalendar_events pce
                INNER JOIN patient_data pd ON pd.pid = pce.pc_pid
                LEFT JOIN users u ON u.id = pce.pc_aid
                WHERE pce.pc_eventDate = CURDATE()
                  AND pce.pc_eventstatus = 1
                  AND pce.pc_apptstatus NOT IN ('*', '%', 'x', 'X')
                  AND pce.pc_pid IS NOT NULL AND pce.pc_pid != '' AND pce.pc_pid != '0'";

        if ($facilityId > 0) {
            $sql .= ' AND (pce.pc_facility = ? OR pce.pc_facility = 0)';
            $bind[] = $facilityId;
        }

        $sql .= ' ORDER BY COALESCE(pce.pc_startTime, \'00:00:00\') ASC, pd.lname ASC, pd.fname ASC
                  LIMIT ' . $limit;

        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];

        return array_map(function (array $row): array {
            $providerName = trim((string) ($row['provider_fname'] ?? '') . ' ' . (string) ($row['provider_lname'] ?? ''));

            return [
                'pid' => (int) ($row['pc_pid'] ?? 0),
                'display_name' => (string) ($row['display_name'] ?? ''),
                'pubpid' => (string) ($row['pubpid'] ?? ''),
                'pc_eid' => (int) ($row['pc_eid'] ?? 0),
                'start_time_label' => $this->formatStartTime($row['pc_startTime'] ?? null),
                'provider_name' => $providerName !== '' ? $providerName : null,
            ];
        }, $rows);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findNearestTodayAppointment(int $pid, int $facilityId): ?array
    {
        $bind = [(string) $pid];
        $sql = "SELECT pce.pc_eid, pce.pc_pid, pce.pc_catid, pce.pc_aid, pce.pc_eventDate,
                       pce.pc_startTime, pce.pc_apptstatus, pce.pc_recurrtype, pce.pc_facility,
                       u.fname AS provider_fname, u.lname AS provider_lname
                FROM openemr_postcalendar_events pce
                LEFT JOIN users u ON u.id = pce.pc_aid
                WHERE pce.pc_pid = ?
                  AND pce.pc_eventDate = CURDATE()
                  AND pce.pc_eventstatus = 1
                  AND pce.pc_apptstatus NOT IN ('*', '%', 'x', 'X')";

        if ($facilityId > 0) {
            $sql .= ' AND (pce.pc_facility = ? OR pce.pc_facility = 0)';
            $bind[] = $facilityId;
        }

        $sql .= ' ORDER BY ABS(TIMESTAMPDIFF(MINUTE, CONCAT(pce.pc_eventDate, \' \', COALESCE(pce.pc_startTime, \'00:00:00\')), NOW())) ASC
                  LIMIT 1';

        $row = QueryUtils::querySingleRow($sql, $bind);

        return empty($row['pc_eid']) ? null : $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getAppointmentForCheckIn(int $pid, int $pcEid, string $apptDate, int $facilityId): ?array
    {
        $row = QueryUtils::querySingleRow(
            "SELECT pce.pc_eid, pce.pc_pid, pce.pc_catid, pce.pc_aid, pce.pc_eventDate,
                    pce.pc_apptstatus, pce.pc_recurrtype, pce.pc_facility
             FROM openemr_postcalendar_events pce
             WHERE pce.pc_eid = ?
               AND pce.pc_eventDate = ?
               AND pce.pc_eventstatus = 1
               AND pce.pc_apptstatus NOT IN ('*', '%', 'x', 'X')",
            [$pcEid, $apptDate]
        );

        if (empty($row['pc_eid']) || (int) ($row['pc_pid'] ?? 0) !== $pid) {
            return null;
        }

        if ($facilityId > 0) {
            $apptFacility = (int) ($row['pc_facility'] ?? 0);
            if ($apptFacility > 0 && $apptFacility !== $facilityId) {
                return null;
            }
        }

        return $row;
    }

    public function resolveVisitTypeIdForCategory(int $pcCatid, int $facilityId): ?int
    {
        if ($pcCatid <= 0) {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT id FROM new_visit_type
             WHERE pc_catid = ? AND is_active = 1 AND service_profile = 'full_opd'
             AND (facility_id = 0 OR facility_id = ?)
             ORDER BY facility_id DESC, id ASC
             LIMIT 1",
            [$pcCatid, $facilityId]
        );

        return empty($row['id']) ? null : (int) $row['id'];
    }

    private function formatStartTime(mixed $startTime): ?string
    {
        if ($startTime === null || $startTime === '') {
            return null;
        }

        try {
            return (new \DateTime((string) $startTime))->format('g:i A');
        } catch (\Exception) {
            return null;
        }
    }
}
