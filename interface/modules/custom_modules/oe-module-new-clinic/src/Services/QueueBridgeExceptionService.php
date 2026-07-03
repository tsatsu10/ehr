<?php

/**
 * M18 — Schedule vs queue exception detectors (EX-01–EX-07, M18-F14 EX-05/06)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class QueueBridgeExceptionService
{
  /** @var list<string> */
    private const TERMINAL_STATES = ['completed', 'closed_unpaid', 'cancelled'];

  /** @var list<string> */
    private const ARRIVED_STATUSES = ['@'];

  /** @var list<string> */
    private const CLOSED_APPT_STATUSES = ['*', '%', '?', 'x', 'X'];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function detectToday(int $facilityId, string $today): array
    {
        $facilityId = $facilityId > 0 ? $facilityId : 0;
        $rows = [];
        $rows = array_merge($rows, $this->detectEx01($facilityId, $today));
        $rows = array_merge($rows, $this->detectEx02($facilityId, $today));
        $rows = array_merge($rows, $this->detectEx03($facilityId, $today));
        if ($this->config->getInt('queue_bridge_show_recurring_info', 1, $facilityId) === 1) {
            $rows = array_merge($rows, $this->detectEx04($facilityId, $today));
        }
        $rows = array_merge($rows, $this->detectEx05($facilityId, $today));
        $rows = array_merge($rows, $this->detectEx06($facilityId, $today));
        $rows = array_merge($rows, $this->detectEx07($facilityId, $today));

        return $this->dedupeRows($rows);
    }

    /**
     * Run only the requested detectors (avoids full detectToday for surface badges/chips).
     *
     * @param list<string> $codes
     * @return list<array<string, mixed>>
     */
    public function detectExceptionCodes(int $facilityId, string $today, array $codes): array
    {
        if ($codes === []) {
            return [];
        }

        $want = array_fill_keys($codes, true);
        $rows = [];

        if (isset($want['EX-01'])) {
            $rows = array_merge($rows, $this->detectEx01($facilityId, $today));
        }
        if (isset($want['EX-02'])) {
            $rows = array_merge($rows, $this->detectEx02($facilityId, $today));
        }
        if (isset($want['EX-03'])) {
            $rows = array_merge($rows, $this->detectEx03($facilityId, $today));
        }
        if (isset($want['EX-04']) && $this->config->getInt('queue_bridge_show_recurring_info', 1, $facilityId) === 1) {
            $rows = array_merge($rows, $this->detectEx04($facilityId, $today));
        }
        if (isset($want['EX-05'])) {
            $rows = array_merge($rows, $this->detectEx05($facilityId, $today));
        }
        if (isset($want['EX-06'])) {
            $rows = array_merge($rows, $this->detectEx06($facilityId, $today));
        }
        if (isset($want['EX-07'])) {
            $rows = array_merge($rows, $this->detectEx07($facilityId, $today));
        }

        return $this->dedupeRows($rows);
    }

    /**
     * EX-01 rows for a single patient (Front Desk guard).
     *
     * @return list<array<string, mixed>>
     */
    public function detectEx01ForPatient(int $pid, int $facilityId, string $today): array
    {
        if ($pid <= 0) {
            return [];
        }

        return array_values(array_filter(
            $this->detectEx01($facilityId, $today),
            static fn (array $row): bool => (int) ($row['pid'] ?? 0) === $pid
        ));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx01(int $facilityId, string $today): array
    {
        $bind = [$today, $today];
        $facilitySql = '';
        if ($facilityId > 0) {
            $facilitySql = ' AND (pce.pc_facility = ? OR pce.pc_facility = 0)';
            $bind[] = $facilityId;
        }

        $terminal = implode("','", self::TERMINAL_STATES);
        $arrived = implode("','", self::ARRIVED_STATUSES);
        $sql = "SELECT pce.pc_eid, pce.pc_pid, pce.pc_startTime, pce.pc_eventDate, pce.pc_apptstatus,
                       pce.pc_recurrtype, pd.fname, pd.lname
                FROM openemr_postcalendar_events pce
                INNER JOIN patient_data pd ON pd.pid = CAST(pce.pc_pid AS UNSIGNED)
                LEFT JOIN new_visit nv ON nv.pc_eid = pce.pc_eid
                    AND nv.appt_date = pce.pc_eventDate
                    AND nv.visit_date = ?
                    AND nv.state NOT IN ('{$terminal}')
                WHERE pce.pc_eventDate = ?
                  AND pce.pc_eventstatus = 1
                  AND pce.pc_apptstatus IN ('{$arrived}')
                  AND pce.pc_pid IS NOT NULL AND pce.pc_pid != '' AND pce.pc_pid != '0'
                  AND nv.id IS NULL
                  {$facilitySql}
                ORDER BY pce.pc_startTime ASC";
        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];

        return array_map(function (array $row): array {
            return $this->rowPayload(
                'EX-01',
                'action',
                (int) ($row['pc_pid'] ?? 0),
                (int) ($row['pc_eid'] ?? 0),
                null,
                $row,
                'Arrived on schedule — no clinical visit',
                ['start_visit_checkin', 'open_flow_board', 'open_scheduling']
            );
        }, $records);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx02(int $facilityId, string $today): array
    {
        $bind = [$today, $facilityId];
        $terminal = implode("','", self::TERMINAL_STATES);
        $arrived = implode("','", self::ARRIVED_STATUSES);
        $closed = implode("','", self::CLOSED_APPT_STATUSES);

        $sql = "SELECT nv.id AS visit_id, nv.pid, nv.pc_eid, nv.queue_number, nv.state,
                       pce.pc_startTime, pce.pc_eventDate, pce.pc_apptstatus, pce.pc_recurrtype,
                       pd.fname, pd.lname
                FROM new_visit nv
                INNER JOIN patient_data pd ON pd.pid = nv.pid
                INNER JOIN openemr_postcalendar_events pce ON pce.pc_eid = nv.pc_eid
                WHERE nv.visit_date = ?
                  AND nv.facility_id = ?
                  AND nv.state NOT IN ('{$terminal}')
                  AND nv.pc_eid IS NOT NULL AND nv.pc_eid > 0
                  AND pce.pc_eventDate = nv.appt_date
                  AND pce.pc_apptstatus NOT IN ('{$arrived}')
                  AND pce.pc_apptstatus NOT IN ('{$closed}')
                  AND (pce.pc_recurrtype IS NULL OR pce.pc_recurrtype = 0)";

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];

        return array_map(function (array $row): array {
            return $this->rowPayload(
                'EX-02',
                'action',
                (int) ($row['pid'] ?? 0),
                (int) ($row['pc_eid'] ?? 0),
                (int) ($row['visit_id'] ?? 0),
                $row,
                'Visit active — appointment not marked arrived',
                ['mark_arrived', 'open_visit_board']
            );
        }, $records);
    }

    /**
     * Targeted lookup for visit detail modal (avoids full detectToday scan).
     *
     * @return array<string, mixed>|null
     */
    public function findTodayExceptionForVisit(
        int $visitId,
        int $facilityId,
        string $exceptionCode,
        string $today
    ): ?array {
        if ($visitId <= 0) {
            return null;
        }

        if ($exceptionCode === 'EX-03') {
            $rows = $this->detectEx03ForVisit($visitId, $facilityId, $today);

            return $rows[0] ?? null;
        }

        foreach ($this->detectExceptionCodes($facilityId, $today, [$exceptionCode]) as $row) {
            if ((int) ($row['visit_id'] ?? 0) === $visitId) {
                return $row;
            }
        }

        return null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx03ForVisit(int $visitId, int $facilityId, string $today): array
    {
        $bind = [$today, $today, $facilityId, $visitId];
        $terminal = implode("','", self::TERMINAL_STATES);
        $arrived = implode("','", self::ARRIVED_STATUSES);
        $closed = implode("','", self::CLOSED_APPT_STATUSES);

        $sql = "SELECT nv.id AS visit_id, nv.pid, nv.queue_number, nv.state,
                       pce.pc_eid, pce.pc_startTime, pce.pc_eventDate,
                       pd.fname, pd.lname
                FROM new_visit nv
                INNER JOIN patient_data pd ON pd.pid = nv.pid
                INNER JOIN openemr_postcalendar_events pce ON pce.pc_pid = CAST(nv.pid AS CHAR)
                    AND pce.pc_eventDate = ?
                WHERE nv.visit_date = ?
                  AND nv.facility_id = ?
                  AND nv.id = ?
                  AND nv.state NOT IN ('{$terminal}')
                  AND (nv.pc_eid IS NULL OR nv.pc_eid = 0)
                  AND pce.pc_eventstatus = 1
                  AND pce.pc_apptstatus NOT IN ('{$arrived}')
                  AND pce.pc_apptstatus NOT IN ('{$closed}')
                ORDER BY pce.pc_startTime ASC
                LIMIT 1";

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];

        return array_map(function (array $row): array {
            return $this->rowPayload(
                'EX-03',
                'action',
                (int) ($row['pid'] ?? 0),
                (int) ($row['pc_eid'] ?? 0),
                (int) ($row['visit_id'] ?? 0),
                $row,
                'Visit active — appointment still booked',
                ['mark_arrived', 'link_appointment', 'open_visit_board', 'dismiss']
            );
        }, $records);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx03(int $facilityId, string $today): array
    {
        $bind = [$today, $facilityId];
        $terminal = implode("','", self::TERMINAL_STATES);
        $arrived = implode("','", self::ARRIVED_STATUSES);
        $closed = implode("','", self::CLOSED_APPT_STATUSES);

        $sql = "SELECT nv.id AS visit_id, nv.pid, nv.queue_number, nv.state,
                       pce.pc_eid, pce.pc_startTime, pce.pc_eventDate,
                       pd.fname, pd.lname
                FROM new_visit nv
                INNER JOIN patient_data pd ON pd.pid = nv.pid
                INNER JOIN openemr_postcalendar_events pce ON pce.pc_pid = CAST(nv.pid AS CHAR)
                    AND pce.pc_eventDate = ?
                WHERE nv.visit_date = ?
                  AND nv.facility_id = ?
                  AND nv.state NOT IN ('{$terminal}')
                  AND (nv.pc_eid IS NULL OR nv.pc_eid = 0)
                  AND pce.pc_eventstatus = 1
                  AND pce.pc_apptstatus NOT IN ('{$arrived}')
                  AND pce.pc_apptstatus NOT IN ('{$closed}')
                ORDER BY nv.queue_number ASC, pce.pc_startTime ASC";

        $bind = [$today, $today, $facilityId];
        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $seen = [];

        $rows = [];
        foreach ($records as $row) {
            $visitId = (int) ($row['visit_id'] ?? 0);
            if (isset($seen[$visitId])) {
                continue;
            }
            $seen[$visitId] = true;
            $rows[] = $this->rowPayload(
                'EX-03',
                'action',
                (int) ($row['pid'] ?? 0),
                (int) ($row['pc_eid'] ?? 0),
                $visitId,
                $row,
                'Visit active — appointment still booked',
                ['mark_arrived', 'link_appointment', 'open_visit_board', 'dismiss']
            );
        }

        return $rows;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx04(int $facilityId, string $today): array
    {
        $bind = [$today, $facilityId];
        $terminal = implode("','", self::TERMINAL_STATES);
        $arrived = implode("','", self::ARRIVED_STATUSES);

        $sql = "SELECT nv.id AS visit_id, nv.pid, nv.pc_eid, nv.queue_number,
                       pce.pc_startTime, pce.pc_apptstatus, pce.pc_recurrtype,
                       pd.fname, pd.lname
                FROM new_visit nv
                INNER JOIN patient_data pd ON pd.pid = nv.pid
                INNER JOIN openemr_postcalendar_events pce ON pce.pc_eid = nv.pc_eid
                WHERE nv.visit_date = ?
                  AND nv.facility_id = ?
                  AND nv.state NOT IN ('{$terminal}')
                  AND nv.pc_eid IS NOT NULL AND nv.pc_eid > 0
                  AND pce.pc_eventDate = nv.appt_date
                  AND pce.pc_recurrtype > 0
                  AND pce.pc_apptstatus NOT IN ('{$arrived}')";

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];

        return array_map(function (array $row): array {
            return $this->rowPayload(
                'EX-04',
                'info',
                (int) ($row['pid'] ?? 0),
                (int) ($row['pc_eid'] ?? 0),
                (int) ($row['visit_id'] ?? 0),
                $row,
                'Recurring series — visit OK; calendar not marked arrived',
                ['dismiss', 'open_visit_board']
            );
        }, $records);
    }

    /**
     * Nearest same-day appointment to a visit check-in time (M18-F14 EX-06 resolve).
     *
     * @return array{pc_eid: int, pc_eventDate: string, pc_startTime: string}|null
     */
    public function findNearestAppointmentToday(int $pid, string $today, string $startedAt): ?array
    {
        if ($pid <= 0 || trim($startedAt) === '') {
            return null;
        }

        $closed = implode("','", self::CLOSED_APPT_STATUSES);
        $appts = QueryUtils::fetchRecords(
            "SELECT pc_eid, pc_eventDate, pc_startTime
             FROM openemr_postcalendar_events
             WHERE pc_pid = ? AND pc_eventDate = ?
               AND pc_eventstatus = 1
               AND pc_apptstatus NOT IN ('{$closed}')
               AND (pc_recurrtype IS NULL OR pc_recurrtype = 0)
             ORDER BY pc_startTime ASC",
            [(string) $pid, $today]
        ) ?: [];

        return $this->pickNearestAppointment($appts, $startedAt);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx05(int $facilityId, string $today): array
    {
        $bind = [$today, $facilityId];
        $terminal = implode("','", self::TERMINAL_STATES);
        $closed = implode("','", self::CLOSED_APPT_STATUSES);

        $sql = "SELECT nv.id AS visit_id, nv.pid, nv.pc_eid, nv.queue_number, nv.state,
                       pce.pc_startTime, pce.pc_eventDate, pce.pc_apptstatus,
                       pd.fname, pd.lname
                FROM new_visit nv
                INNER JOIN patient_data pd ON pd.pid = nv.pid
                INNER JOIN openemr_postcalendar_events pce ON pce.pc_eid = nv.pc_eid
                WHERE nv.visit_date = ?
                  AND nv.facility_id = ?
                  AND nv.state NOT IN ('{$terminal}')
                  AND nv.pc_eid IS NOT NULL AND nv.pc_eid > 0
                  AND pce.pc_eventDate = nv.appt_date
                  AND pce.pc_apptstatus IN ('{$closed}')
                  AND (pce.pc_recurrtype IS NULL OR pce.pc_recurrtype = 0)";

        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];

        return array_map(function (array $row): array {
            return $this->rowPayload(
                'EX-05',
                'action',
                (int) ($row['pid'] ?? 0),
                (int) ($row['pc_eid'] ?? 0),
                (int) ($row['visit_id'] ?? 0),
                $row,
                'Appointment cancelled on schedule — visit still active',
                ['cancel_visit', 'unlink_appointment', 'open_visit_board', 'dismiss']
            );
        }, $records);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx06(int $facilityId, string $today): array
    {
        $bind = [$today, $facilityId];
        $terminal = implode("','", self::TERMINAL_STATES);
        $closed = implode("','", self::CLOSED_APPT_STATUSES);

        $sql = "SELECT nv.id AS visit_id, nv.pid, nv.pc_eid, nv.queue_number, nv.started_at,
                       pd.fname, pd.lname
                FROM new_visit nv
                INNER JOIN patient_data pd ON pd.pid = nv.pid
                WHERE nv.visit_date = ?
                  AND nv.facility_id = ?
                  AND nv.state NOT IN ('{$terminal}')
                  AND nv.pc_eid IS NOT NULL AND nv.pc_eid > 0
                  AND nv.started_at IS NOT NULL";

        $visits = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $rows = [];

        foreach ($visits as $visit) {
            $pid = (int) ($visit['pid'] ?? 0);
            $visitId = (int) ($visit['visit_id'] ?? 0);
            $linkedEid = (int) ($visit['pc_eid'] ?? 0);
            $startedAt = (string) ($visit['started_at'] ?? '');

            $appts = QueryUtils::fetchRecords(
                "SELECT pc_eid, pc_eventDate, pc_startTime
                 FROM openemr_postcalendar_events
                 WHERE pc_pid = ? AND pc_eventDate = ?
                   AND pc_eventstatus = 1
                   AND pc_apptstatus NOT IN ('{$closed}')
                   AND (pc_recurrtype IS NULL OR pc_recurrtype = 0)
                 ORDER BY pc_startTime ASC",
                [(string) $pid, $today]
            ) ?: [];

            if (count($appts) < 2) {
                continue;
            }

            $nearest = $this->pickNearestAppointment($appts, $startedAt);
            if ($nearest === null) {
                continue;
            }

            $nearestEid = (int) ($nearest['pc_eid'] ?? 0);
            if ($nearestEid <= 0 || $nearestEid === $linkedEid) {
                continue;
            }

            $rows[] = $this->rowPayload(
                'EX-06',
                'info',
                $pid,
                $linkedEid,
                $visitId,
                array_merge($visit, $nearest),
                'Multiple appointments today — linked appointment may not match check-in time',
                ['relink_nearest_appointment', 'open_visit_board']
            );
        }

        return $rows;
    }

    /**
     * @param list<array<string, mixed>> $appts
     * @return array<string, mixed>|null
     */
    private function pickNearestAppointment(array $appts, string $startedAt): ?array
    {
        $startedTs = strtotime($startedAt);
        if ($startedTs === false) {
            return null;
        }

        $best = null;
        $bestDiff = PHP_INT_MAX;
        foreach ($appts as $appt) {
            $date = (string) ($appt['pc_eventDate'] ?? '');
            $time = (string) ($appt['pc_startTime'] ?? '');
            if ($date === '' || $time === '') {
                continue;
            }
            $apptTs = strtotime($date . ' ' . $time);
            if ($apptTs === false) {
                continue;
            }
            $diff = abs($apptTs - $startedTs);
            if ($diff < $bestDiff) {
                $bestDiff = $diff;
                $best = $appt;
            }
        }

        return $best;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detectEx07(int $facilityId, string $today): array
    {
        $bind = [$today, $facilityId];
        $terminal = implode("','", self::TERMINAL_STATES);
        $closed = implode("','", self::CLOSED_APPT_STATUSES);

        $sql = "SELECT nv.id AS visit_id, nv.pid, nv.queue_number, nv.service_profile,
                       pce.pc_eid, pce.pc_startTime, pce.pc_catid,
                       pd.fname, pd.lname
                FROM new_visit nv
                INNER JOIN patient_data pd ON pd.pid = nv.pid
                INNER JOIN openemr_postcalendar_events pce ON pce.pc_pid = CAST(nv.pid AS CHAR)
                    AND pce.pc_eventDate = ?
                INNER JOIN new_visit_type nvt ON nvt.pc_catid = pce.pc_catid AND nvt.is_active = 1
                WHERE nv.visit_date = ?
                  AND nv.facility_id = ?
                  AND nv.state NOT IN ('{$terminal}')
                  AND nv.service_profile IN ('lab_direct', 'pharmacy_walkin')
                  AND nvt.service_profile = 'full_opd'
                  AND pce.pc_eventstatus = 1
                  AND pce.pc_apptstatus NOT IN ('{$closed}')";

        $bind = [$today, $today, $facilityId];
        $records = QueryUtils::fetchRecords($sql, $bind) ?: [];
        $seen = [];

        $rows = [];
        foreach ($records as $row) {
            $visitId = (int) ($row['visit_id'] ?? 0);
            if (isset($seen[$visitId])) {
                continue;
            }
            $seen[$visitId] = true;
            $rows[] = $this->rowPayload(
                'EX-07',
                'info',
                (int) ($row['pid'] ?? 0),
                (int) ($row['pc_eid'] ?? 0),
                $visitId,
                $row,
                'Ancillary visit today — OPD appointment also on calendar',
                ['dismiss', 'open_visit_board']
            );
        }

        return $rows;
    }

    /**
     * @param array<string, mixed> $row
     * @param list<string> $actions
     * @return array<string, mixed>
     */
    private function rowPayload(
        string $code,
        string $severity,
        int $pid,
        ?int $pcEid,
        ?int $visitId,
        array $row,
        string $summary,
        array $actions
    ): array {
        $fname = trim((string) ($row['fname'] ?? ''));
        $lname = trim((string) ($row['lname'] ?? ''));
        $patientName = trim($fname . ' ' . $lname);
        $start = (string) ($row['pc_startTime'] ?? '');
        $timeLabel = $start !== '' ? substr($start, 0, 5) : null;

        return [
            'exception_code' => $code,
            'severity' => $severity,
            'pid' => $pid,
            'pc_eid' => $pcEid,
            'visit_id' => $visitId,
            'patient_name' => $patientName !== '' ? $patientName : ('PID ' . $pid),
            'queue_number' => isset($row['queue_number']) ? (int) $row['queue_number'] : null,
            'appt_time_label' => $timeLabel,
            'summary' => $summary,
            'available_actions' => $actions,
            'dedupe_key' => strtolower($code . ':' . $pid . ':' . ($pcEid ?? 0) . ':' . ($visitId ?? 0)),
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private function dedupeRows(array $rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            $map[(string) ($row['dedupe_key'] ?? '')] = $row;
        }

        return array_values($map);
    }
}
