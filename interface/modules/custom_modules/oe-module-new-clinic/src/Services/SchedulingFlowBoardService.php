<?php

/**
 * S1 Flow Board lens — kanban data and status writes (PRD §6.7 H2/H4)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Support\ApptStatusLabel;
use OpenEMR\Services\AppointmentService;
use OpenEMR\Services\ListService;
use OpenEMR\Services\PatientTrackerService;

class SchedulingFlowBoardService
{
    /** @var list<string> */
    private const CLOSED_STATUSES = ['*', '%', 'x', 'X'];

    private static bool $legacyLoaded = false;

    // Lazy — QueueBridgeSurfaceService eagerly builds QueueBridgeService, which eagerly builds
    // SchedulingShellService AND SchedulingRecallsService (a Scheduling service reaching back
    // into two other Scheduling services through a third module). No active cycle today, but
    // it means every Flow Board load/poll constructs 15-20 objects even when queue bridge is
    // off, and one future edit anywhere in that graph turns this into the eager-ctor-cycle
    // crash class (CLAUDE.md §6). Built only on first actual use.
    private ?QueueBridgeSurfaceService $queueBridge = null;

    public function __construct(
        private readonly SchedulingAccessService $access = new SchedulingAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        ?QueueBridgeSurfaceService $queueBridge = null,
        private readonly SchedulingFlowBoardLaneMapService $laneMap = new SchedulingFlowBoardLaneMapService(),
    ) {
        $this->queueBridge = $queueBridge;
    }

    private function getQueueBridge(): QueueBridgeSurfaceService
    {
        if ($this->queueBridge === null) {
            $this->queueBridge = new QueueBridgeSurfaceService();
        }

        return $this->queueBridge;
    }

    /**
     * @return array<string, mixed>
     */
    public function getBoard(int $facilityId, string $date, ?int $providerId = null): array
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $this->access->assertHubAccess($facilityId);
        $this->ensureLegacyIncludes();

        $statuses = $this->loadStatusMeta();
        $laneConfig = $this->laneMap->getResolvedLanes($facilityId);
        $appointments = fetchAppointments(
            $date,
            $date,
            null,
            $providerId !== null && $providerId > 0 ? $providerId : null,
            $facilityId > 0 ? $facilityId : null,
            null,
            null,
            null,
            null,
            true
        ) ?: [];

        $ex01Map = $this->buildEx01Map($facilityId, $date);
        // "Running late" is only meaningful for today, measured against the wall
        // clock at load time.
        $nowMinutes = $date === date('Y-m-d') ? ((int) date('G') * 60 + (int) date('i')) : null;
        $cards = [];
        foreach ($appointments as $row) {
            $card = $this->mapAppointmentRow($row, $statuses, $ex01Map, $laneConfig, $nowMinutes);
            if ($card !== null) {
                $cards[] = $card;
            }
        }

        $lanes = $this->groupCardsIntoLanes($laneConfig, $statuses, $cards);
        $pollMs = max(10000, (int) ($GLOBALS['pat_trkr_timer'] ?? 20) * 1000);
        $revision = $this->computeBoardRevision($lanes);

        return [
            'date' => $date,
            'facility_id' => $facilityId,
            'provider_id' => $providerId,
            'lanes' => $lanes,
            'revision' => $revision,
            'poll_interval_ms' => $pollMs,
            'can_advance' => $this->access->canBookAppointment(),
            'queue_bridge_enabled' => $this->getQueueBridge()->isSurfaceEnabled($facilityId),
        ];
    }

    /**
     * Delta poll — returns unchanged=true when client revision matches (no lane payload).
     *
     * @return array<string, mixed>
     */
    public function pollBoard(
        int $facilityId,
        string $date,
        ?int $providerId,
        string $clientRevision,
    ): array {
        $board = $this->getBoard($facilityId, $date, $providerId);
        if ($clientRevision !== '' && $clientRevision === (string) ($board['revision'] ?? '')) {
            return [
                'unchanged' => true,
                'revision' => $board['revision'],
                'poll_interval_ms' => $board['poll_interval_ms'],
            ];
        }

        $board['unchanged'] = false;

        return $board;
    }

    public function advanceStatus(int $facilityId, int $pcEid, string $status, int $actorUserId): void
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $this->access->assertHubAccess($facilityId);
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Appointment write permission denied', 403);
        }

        $this->assertAppointmentInFacility($pcEid, $facilityId);

        $appointmentService = new AppointmentService();
        if (!$appointmentService->isValidAppointmentStatus($status)) {
            throw new \InvalidArgumentException('Invalid appointment status');
        }

        $appointmentService->updateAppointmentStatus($pcEid, $status, $actorUserId, '');
    }

    public function updateRoom(int $facilityId, int $pcEid, string $room, int $actorUserId): void
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $this->access->assertHubAccess($facilityId);
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Appointment write permission denied', 403);
        }

        $this->assertAppointmentInFacility($pcEid, $facilityId);

        $room = trim($room);
        if (strlen($room) > 20) {
            throw new \InvalidArgumentException('Room value too long');
        }

        $appointmentService = new AppointmentService();
        $rows = $appointmentService->getAppointment($pcEid);
        if (empty($rows)) {
            throw new \InvalidArgumentException('Appointment not found');
        }

        $appt = $rows[0];
        $pid = (int) ($appt['pid'] ?? 0);
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Appointment has no patient');
        }

        $apptDate = (string) ($appt['pc_eventDate'] ?? '');
        $apptTime = (string) ($appt['pc_startTime'] ?? '');
        $status = $this->resolveEffectiveTrackerStatus($pcEid, $pid, (string) ($appt['pc_apptstatus'] ?? '-'));

        $trackerService = new PatientTrackerService();
        $result = $trackerService->manage_tracker_status(
            $apptDate,
            $apptTime,
            $pcEid,
            $pid,
            (string) $actorUserId,
            $status,
            $room,
            ''
        );
        if ($result === false) {
            throw new \InvalidArgumentException('Room cannot be updated for recurring appointments');
        }
    }

    private function resolveEffectiveTrackerStatus(int $pcEid, int $pid, string $fallbackStatus): string
    {
        $row = QueryUtils::querySingleRow(
            "SELECT patient_tracker_element.status AS laststatus
             FROM patient_tracker
             LEFT JOIN patient_tracker_element
               ON patient_tracker.id = patient_tracker_element.pt_tracker_id
              AND patient_tracker.lastseq = patient_tracker_element.seq
             WHERE patient_tracker.eid = ?
               AND patient_tracker.pid = ?
             LIMIT 1",
            [$pcEid, $pid]
        ) ?: [];

        $trackerStatus = trim((string) ($row['laststatus'] ?? ''));
        if ($trackerStatus !== '') {
            return $trackerStatus;
        }

        return $fallbackStatus !== '' ? $fallbackStatus : '-';
    }

    /**
     * @param list<array<string, mixed>> $laneConfig resolved lane map — drives
     *   next_status (advance to the next lane's representative status).
     * @param int|null $nowMinutes minutes-since-midnight now, or null when the
     *   board isn't today's (running-late only applies to today).
     * @return array<string, mixed>
     */
    private function mapAppointmentRow(array $row, array $statuses, array $ex01Map, array $laneConfig, ?int $nowMinutes = null): ?array
    {
        // fetchAppointments(tracker_board: true) SELECTs both p.pid and t.pid, and
        // the LEFT-JOINed tracker's pid wins the assoc key. For a booked-but-not-
        // arrived appointment there IS no tracker row, so `pid` comes back NULL and
        // the card used to be dropped — silently killing the whole "Booked" lane.
        // The event's own pc_pid is authoritative.
        $pid = (int) ($row['pc_pid'] ?? $row['pid'] ?? 0);
        $pcEid = (int) ($row['pc_eid'] ?? 0);
        if ($pid <= 0 || $pcEid <= 0) {
            return null;
        }

        $apptStatus = (string) ($row['pc_apptstatus'] ?? '');
        if (in_array($apptStatus, self::CLOSED_STATUSES, true)) {
            return null;
        }

        $trackerStatus = (string) ($row['status'] ?? '');
        $effectiveStatus = $trackerStatus !== '' ? $trackerStatus : $apptStatus;
        if ($effectiveStatus === '') {
            $effectiveStatus = '-';
        }

        $statusMeta = $statuses[$effectiveStatus] ?? null;
        $minutesInStatus = $this->minutesInCurrentStatus($row);
        $alertMinutes = (int) ($statusMeta['alert_minutes'] ?? 0);
        $alertLevel = $this->alertLevel($minutesInStatus, $alertMinutes);

        $fname = trim((string) ($row['fname'] ?? ''));
        $lname = trim((string) ($row['lname'] ?? ''));
        $startTime = (string) ($row['pc_startTime'] ?? '');
        $ex01Key = $pid . ':' . $pcEid;
        // Booked but not arrived ("-" is the pre-check-in status) past the appt
        // time on today's board = running late.
        $runningLate = $nowMinutes !== null
            && $effectiveStatus === '-'
            && $this->startMinutes($startTime) !== null
            && $this->startMinutes($startTime) < $nowMinutes;

        return [
            'pc_eid' => $pcEid,
            'pid' => $pid,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'patient_name' => trim($fname . ' ' . $lname) ?: ('PID ' . $pid),
            'appt_time_label' => $startTime !== '' ? substr($startTime, 0, 5) : null,
            // The visit type lives on pc_title; pc_catname is the shared legacy
            // category ("Office Visit") every type collapses onto, so it told the
            // user nothing. Same fix the calendar already carries.
            'category_label' => trim((string) ($row['pc_title'] ?? '')) !== ''
                ? trim((string) $row['pc_title'])
                : trim((string) ($row['pc_catname'] ?? '')),
            'status' => $effectiveStatus,
            'status_label' => (string) ($statusMeta['label'] ?? $effectiveStatus),
            'room' => (string) ($row['room'] ?? $row['pc_room'] ?? ''),
            'status_since' => $this->formatStatusSince($row),
            'minutes_in_status' => $minutesInStatus,
            'alert_minutes' => $alertMinutes,
            'alert_level' => $alertLevel,
            'running_late' => $runningLate,
            'is_recurring' => (int) ($row['pc_recurrtype'] ?? 0) !== 0,
            'has_tracker' => !empty($row['id']),
            'next_status' => $this->nextStatusCode($effectiveStatus, $statuses, $laneConfig),
            'check_in_status' => $this->checkInStatusCode($statuses),
            'queue_bridge_ex01' => isset($ex01Map[$ex01Key]),
            'queue_bridge_fix_url' => $ex01Map[$ex01Key] ?? null,
        ];
    }

    /** Minutes since midnight for an "HH:MM(:SS)" start time, or null if unparseable. */
    private function startMinutes(string $startTime): ?int
    {
        if (!preg_match('/^(\d{1,2}):(\d{2})/', $startTime, $m)) {
            return null;
        }

        return ((int) $m[1]) * 60 + (int) $m[2];
    }

    /**
     * @param list<array<string, mixed>> $laneConfig
     * @param array<string, array<string, mixed>> $statuses
     * @param list<array<string, mixed>> $cards
     * @return list<array<string, mixed>>
     */
    private function groupCardsIntoLanes(array $laneConfig, array $statuses, array $cards): array
    {
        $byLane = [];
        foreach ($laneConfig as $lane) {
            $key = (string) ($lane['lane_key'] ?? '');
            if ($key === '') {
                continue;
            }
            $byLane[$key] = [
                'lane_key' => $key,
                'status' => (string) ($lane['representative_status'] ?? $key),
                'label' => (string) ($lane['label'] ?? $key),
                'count' => 0,
                'cards' => [],
            ];
        }

        foreach ($cards as $card) {
            $code = (string) ($card['status'] ?? '-');
            $laneKey = $this->laneKeyForStatus($code, $laneConfig);
            if ($laneKey === null || !isset($byLane[$laneKey])) {
                $laneKey = $code;
                if (!isset($byLane[$laneKey])) {
                    $meta = $statuses[$code] ?? null;
                    $byLane[$laneKey] = [
                        'lane_key' => $laneKey,
                        'status' => $code,
                        'label' => (string) ($meta['label'] ?? $code),
                        'count' => 0,
                        'cards' => [],
                    ];
                }
            }
            $byLane[$laneKey]['cards'][] = $card;
            $byLane[$laneKey]['count']++;
        }

        $lanes = [];
        foreach ($laneConfig as $lane) {
            $key = (string) ($lane['lane_key'] ?? '');
            if ($key === '' || !isset($byLane[$key])) {
                continue;
            }
            $entry = $byLane[$key];
            if ($entry['count'] === 0 && empty($lane['always_show'])) {
                continue;
            }
            $lanes[] = $entry;
        }

        foreach ($byLane as $key => $entry) {
            if ($entry['count'] === 0) {
                continue;
            }
            $already = false;
            foreach ($lanes as $lane) {
                if (($lane['lane_key'] ?? '') === $key) {
                    $already = true;
                    break;
                }
            }
            if (!$already) {
                $lanes[] = $entry;
            }
        }

        return $lanes;
    }

    /**
     * @param list<array<string, mixed>> $laneConfig
     */
    private function laneKeyForStatus(string $status, array $laneConfig): ?string
    {
        foreach ($laneConfig as $lane) {
            $codes = $lane['status_codes'] ?? [];
            if (is_array($codes) && in_array($status, $codes, true)) {
                return (string) ($lane['lane_key'] ?? null);
            }
        }

        return null;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadStatusMeta(): array
    {
        $listService = new ListService();
        $options = $listService->getOptionsByListName('apptstat', ['activity' => 1]) ?: [];
        $lanes = [];
        foreach ($options as $option) {
            $code = (string) ($option['option_id'] ?? '');
            if ($code === '') {
                continue;
            }
            $settings = PatientTrackerService::collectApptStatusSettings($code);
            $alertMinutes = is_array($settings) ? (int) ($settings['time_alert'] ?? 0) : 0;
            $lanes[$code] = [
                'label' => ApptStatusLabel::clean($code, (string) ($option['title'] ?? $code)),
                'seq' => (int) ($option['seq'] ?? 0),
                'is_check_in' => AppointmentService::isCheckInStatus($code),
                'is_check_out' => AppointmentService::isCheckOutStatus($code),
                'alert_minutes' => $alertMinutes,
                'always_show' => AppointmentService::isCheckInStatus($code)
                    || AppointmentService::isCheckOutStatus($code),
            ];
        }

        uasort($lanes, static fn (array $a, array $b): int => ($a['seq'] ?? 0) <=> ($b['seq'] ?? 0));

        return $lanes;
    }

    /**
     * @param array<string, array<string, mixed>> $statuses
     * @param list<array<string, mixed>> $laneConfig
     */
    private function nextStatusCode(string $current, array $statuses, array $laneConfig): ?string
    {
        $currentLaneIdx = null;
        foreach ($laneConfig as $i => $lane) {
            $codes = $lane['status_codes'] ?? [];
            if (is_array($codes) && in_array($current, $codes, true)) {
                $currentLaneIdx = $i;
                break;
            }
        }

        if ($currentLaneIdx !== null && isset($laneConfig[$currentLaneIdx + 1])) {
            return (string) ($laneConfig[$currentLaneIdx + 1]['representative_status'] ?? null);
        }

        $codes = array_keys($statuses);
        $index = array_search($current, $codes, true);
        if ($index === false) {
            return $codes[0] ?? null;
        }

        return $codes[$index + 1] ?? null;
    }

    /**
     * @param array<string, array<string, mixed>> $statuses
     */
    private function checkInStatusCode(array $statuses): ?string
    {
        foreach ($statuses as $code => $meta) {
            if (!empty($meta['is_check_in'])) {
                return $code;
            }
        }

        return null;
    }

    /**
     * @return array<string, string>
     */
    private function buildEx01Map(int $facilityId, string $date): array
    {
        if (!$this->getQueueBridge()->isSurfaceEnabled($facilityId) || $date !== date('Y-m-d')) {
            return [];
        }

        $map = [];
        foreach ($this->getQueueBridge()->flowBoardChips($facilityId) as $chip) {
            $key = (int) ($chip['pid'] ?? 0) . ':' . (int) ($chip['pc_eid'] ?? 0);
            $map[$key] = (string) ($chip['fix_url'] ?? '');
        }

        return $map;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function minutesInCurrentStatus(array $row): int
    {
        $start = (string) ($row['start_datetime'] ?? '');
        if ($start === '') {
            return 0;
        }
        $ts = strtotime($start);

        return $ts === false ? 0 : max(0, (int) floor((time() - $ts) / 60));
    }

    /**
     * @param array<string, mixed> $row
     */
    private function formatStatusSince(array $row): ?string
    {
        $start = trim((string) ($row['start_datetime'] ?? ''));
        if ($start === '') {
            return null;
        }
        $ts = strtotime($start);

        return $ts === false ? null : gmdate('c', $ts);
    }

    private function alertLevel(int $minutes, int $alertMinutes): string
    {
        if ($alertMinutes <= 0 || $minutes <= 0) {
            return 'ok';
        }
        if ($minutes >= $alertMinutes) {
            return 'over';
        }
        if ($minutes >= (int) floor($alertMinutes * 0.75)) {
            return 'warn';
        }

        return 'ok';
    }

    /**
     * @param list<array<string, mixed>> $lanes
     */
    private function computeBoardRevision(array $lanes): string
    {
        $parts = [];
        foreach ($lanes as $lane) {
            foreach ($lane['cards'] as $card) {
                $parts[] = implode('|', [
                    (int) ($card['pc_eid'] ?? 0),
                    (string) ($card['status'] ?? ''),
                    (string) ($card['room'] ?? ''),
                    !empty($card['has_tracker']) ? '1' : '0',
                    !empty($card['queue_bridge_ex01']) ? '1' : '0',
                ]);
            }
        }

        return sha1(implode(';', $parts));
    }

    private function assertAppointmentInFacility(int $pcEid, int $facilityId): void
    {
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        if ($facilityId <= 0) {
            return;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT pc_facility FROM openemr_postcalendar_events WHERE pc_eid = ?',
            [$pcEid]
        );
        if (empty($row)) {
            throw new \InvalidArgumentException('Appointment not found');
        }
        if ((int) ($row['pc_facility'] ?? 0) !== $facilityId) {
            throw new \RuntimeException('Appointment is not in the selected facility', 403);
        }
    }

    private function ensureLegacyIncludes(): void
    {
        if (self::$legacyLoaded) {
            return;
        }

        $root = dirname(__DIR__, 6);
        require_once $root . '/library/appointments.inc.php';
        require_once $root . '/library/patient_tracker.inc.php';
        self::$legacyLoaded = true;
    }
}
