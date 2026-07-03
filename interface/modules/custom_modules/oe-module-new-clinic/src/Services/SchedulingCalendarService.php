<?php

/**
 * S1 Calendar lens — day agenda/grid data and booking (PRD §6 H2)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\AppointmentService;
use OpenEMR\Services\ListService;

class SchedulingCalendarService
{
    /** @var list<string> */
    private const HIDDEN_STATUSES = ['*', '%', 'x', 'X'];

    private static bool $legacyLoaded = false;

    public function __construct(
        private readonly SchedulingAccessService $access = new SchedulingAccessService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly VisitTypeAdminService $visitTypes = new VisitTypeAdminService(),
        private readonly SchedulingShellService $shell = new SchedulingShellService(),
        private readonly SchedulingRecallsService $recalls = new SchedulingRecallsService(),
        private readonly SchedulingCalendarNotifyService $notify = new SchedulingCalendarNotifyService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getDayView(int $facilityId, string $date, ?int $providerId = null): array
    {
        return $this->getRangeView($facilityId, $date, 'day', $providerId);
    }

    /**
     * @return array<string, mixed>
     */
    public function getRangeView(int $facilityId, string $anchorDate, string $view, ?int $providerId = null): array
    {
        $this->access->assertHubAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $view = in_array($view, ['day', 'week', 'month'], true) ? $view : 'day';
        [$startDate, $endDate] = $this->resolveViewDateRange($anchorDate, $view);
        $this->ensureLegacyIncludes();

        $appointments = fetchAppointments(
            $startDate,
            $endDate,
            null,
            $providerId !== null && $providerId > 0 ? $providerId : null,
            $facilityId > 0 ? $facilityId : null,
        ) ?: [];

        $statusLabels = $this->loadStatusLabels();
        $providerLabels = $this->providerLabelMap($facilityId);
        $events = [];

        foreach ($appointments as $row) {
            $event = $this->mapCalendarRow($row, $statusLabels, $providerLabels);
            if ($event !== null) {
                $events[] = $event;
            }
        }

        usort($events, static function (array $a, array $b): int {
            $dateCmp = strcmp((string) $a['event_date'], (string) $b['event_date']);
            if ($dateCmp !== 0) {
                return $dateCmp;
            }

            return strcmp((string) $a['start_time'], (string) $b['start_time']);
        });

        $pollMs = max(30000, (int) ($GLOBALS['pat_trkr_timer'] ?? 20) * 1000);
        $revision = $this->computeRangeRevision($events);

        return [
            'view' => $view,
            'anchor_date' => $anchorDate,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'date' => $anchorDate,
            'facility_id' => $facilityId,
            'provider_id' => $providerId,
            'interval_minutes' => $this->resolveIntervalMinutes(),
            'events' => $events,
            'revision' => $revision,
            'categories' => array_map(static function (array $cat): array {
                return [
                    'id' => (int) ($cat['pc_catid'] ?? 0),
                    'label' => (string) ($cat['name'] ?? ''),
                ];
            }, $this->visitTypes->listCalendarCategories()),
            'providers' => $this->shell->getBootstrapPayload($facilityId)['providers'],
            'poll_interval_ms' => $pollMs,
            'can_book' => $this->access->canBookAppointment(),
            'patient_notify' => [
                'medex_enabled' => $this->notify->isMedExEnabled(),
            ],
        ];
    }

    /**
     * Delta poll — returns unchanged=true when client revision matches.
     *
     * @return array<string, mixed>
     */
    public function pollRangeView(
        int $facilityId,
        string $anchorDate,
        string $view,
        ?int $providerId,
        string $clientRevision,
    ): array {
        $range = $this->getRangeView($facilityId, $anchorDate, $view, $providerId);
        if ($clientRevision !== '' && $clientRevision === (string) ($range['revision'] ?? '')) {
            return [
                'unchanged' => true,
                'revision' => $range['revision'],
                'poll_interval_ms' => $range['poll_interval_ms'],
            ];
        }

        $range['unchanged'] = false;

        return $range;
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function moveAppointment(int $facilityId, array $input, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Appointment write permission denied', 403);
        }

        $pcEid = (int) ($input['pc_eid'] ?? 0);
        $date = trim((string) ($input['date'] ?? ''));
        $time = trim((string) ($input['time'] ?? ''));
        $providerId = isset($input['provider_id']) ? (int) $input['provider_id'] : null;
        $view = (string) ($input['view'] ?? 'day');
        $anchorDate = trim((string) ($input['anchor_date'] ?? $date));

        if ($pcEid <= 0) {
            throw new \InvalidArgumentException('Appointment id is required');
        }
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException('Valid date is required');
        }
        if ($time === '' || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            throw new \InvalidArgumentException('Valid time is required (HH:MM)');
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $recurrScope = $this->normalizeRecurrScope($input['recurr_scope'] ?? null);
        $occurrenceDate = trim((string) ($input['occurrence_date'] ?? ''));
        $appt = $this->loadEditableAppointment($pcEid, $facilityId, $recurrScope, $occurrenceDate);
        $isRecurring = (int) ($appt['pc_recurrtype'] ?? 0) !== 0;

        $durationSeconds = (int) ($appt['pc_duration'] ?? 0);
        if ($durationSeconds <= 0) {
            $durationSeconds = $this->resolveIntervalMinutes() * 60;
        }

        $startTime = $time . ':00';
        $startTs = strtotime($date . ' ' . $startTime);
        if ($startTs === false) {
            throw new \InvalidArgumentException('Invalid date/time');
        }
        $endTime = date('H:i:s', $startTs + $durationSeconds);

        $targetProviderId = ($providerId !== null && $providerId > 0)
            ? $providerId
            : (int) ($appt['pc_aid'] ?? 0);
        $this->assertNoProviderConflict($pcEid, $targetProviderId, $facilityId, $date, $startTime, $endTime);

        if ($isRecurring) {
            $this->applyRecurringModification(
                $appt,
                $occurrenceDate,
                $recurrScope,
                $date,
                $startTime,
                $endTime,
                $durationSeconds,
                $providerId !== null && $providerId > 0 ? $providerId : null
            );
        } else {
            $binds = [$date, $startTime, $endTime, $durationSeconds, $pcEid];
            $sql = 'UPDATE openemr_postcalendar_events SET pc_eventDate = ?, pc_startTime = ?, pc_endTime = ?, pc_duration = ?';
            if ($providerId !== null && $providerId > 0) {
                $sql .= ', pc_aid = ?';
                $binds = [$date, $startTime, $endTime, $durationSeconds, $providerId, $pcEid];
            }
            $sql .= ' WHERE pc_eid = ? AND pc_recurrtype = 0';
            QueryUtils::sqlStatementThrowException($sql, $binds);

            $pid = (int) ($appt['pid'] ?? 0);
            if ($pid > 0) {
                QueryUtils::sqlStatementThrowException(
                    'UPDATE patient_tracker SET apptdate = ?, appttime = ? WHERE eid = ? AND pid = ?',
                    [$date, $startTime, $pcEid, $pid]
                );
            }
        }

        $pid = (int) ($appt['pid'] ?? 0);

        $this->logSchedulingEvent(
            $actorUserId,
            'scheduling-calendar-move',
            'pc_eid=' . $pcEid . ' date=' . $date . ' time=' . $time . ' provider_id=' . $targetProviderId
        );

        if (!empty($input['notify_patient'])) {
            $this->notify->queueRescheduleNotice($pcEid, $pid, 'move', $actorUserId);
        }

        return $this->getRangeView(
            $facilityId,
            $anchorDate !== '' ? $anchorDate : $date,
            in_array($view, ['day', 'week', 'month'], true) ? $view : 'day',
            isset($input['filter_provider_id']) ? (int) $input['filter_provider_id'] : null,
        );
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function resizeAppointment(int $facilityId, array $input, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Appointment write permission denied', 403);
        }

        $pcEid = (int) ($input['pc_eid'] ?? 0);
        $durationMinutes = (int) ($input['duration_minutes'] ?? 0);
        $view = (string) ($input['view'] ?? 'day');
        $anchorDate = trim((string) ($input['anchor_date'] ?? ''));

        if ($pcEid <= 0) {
            throw new \InvalidArgumentException('Appointment id is required');
        }
        if ($durationMinutes < 5 || $durationMinutes > 480) {
            throw new \InvalidArgumentException('Duration must be between 5 and 480 minutes');
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $recurrScope = $this->normalizeRecurrScope($input['recurr_scope'] ?? null);
        $occurrenceDate = trim((string) ($input['occurrence_date'] ?? ''));
        $appt = $this->loadEditableAppointment($pcEid, $facilityId, $recurrScope, $occurrenceDate);
        $isRecurring = (int) ($appt['pc_recurrtype'] ?? 0) !== 0;

        $date = (string) ($appt['pc_eventDate'] ?? '');
        if ($occurrenceDate !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $occurrenceDate)) {
            $date = $occurrenceDate;
        }
        $startTime = (string) ($appt['pc_startTime'] ?? '');
        $durationSeconds = $durationMinutes * 60;
        $startTs = strtotime($date . ' ' . $startTime);
        if ($startTs === false) {
            throw new \InvalidArgumentException('Invalid appointment start time');
        }
        $endTime = date('H:i:s', $startTs + $durationSeconds);

        $providerId = (int) ($appt['pc_aid'] ?? 0);
        $this->assertNoProviderConflict($pcEid, $providerId, $facilityId, $date, $startTime, $endTime);

        if ($isRecurring) {
            $this->applyRecurringModification(
                $appt,
                $occurrenceDate !== '' ? $occurrenceDate : $date,
                $recurrScope,
                $date,
                $startTime,
                $endTime,
                $durationSeconds,
                null
            );
        } else {
            QueryUtils::sqlStatementThrowException(
                'UPDATE openemr_postcalendar_events SET pc_endTime = ?, pc_duration = ? WHERE pc_eid = ? AND pc_recurrtype = 0',
                [$endTime, $durationSeconds, $pcEid]
            );
        }

        $this->logSchedulingEvent(
            $actorUserId,
            'scheduling-calendar-resize',
            'pc_eid=' . $pcEid . ' duration_minutes=' . $durationMinutes
        );

        $pid = (int) ($appt['pid'] ?? 0);
        if (!empty($input['notify_patient']) && $pid > 0) {
            $this->notify->queueRescheduleNotice($pcEid, $pid, 'resize', $actorUserId);
        }

        return $this->getRangeView(
            $facilityId,
            $anchorDate !== '' ? $anchorDate : $date,
            in_array($view, ['day', 'week', 'month'], true) ? $view : 'day',
            isset($input['filter_provider_id']) ? (int) $input['filter_provider_id'] : null,
        );
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function resolveViewDateRange(string $anchorDate, string $view): array
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $anchorDate)) {
            $anchorDate = date('Y-m-d');
        }

        if ($view === 'month') {
            $start = date('Y-m-01', strtotime($anchorDate));
            $end = date('Y-m-t', strtotime($anchorDate));

            return [$start, $end];
        }

        if ($view === 'week') {
            $ts = strtotime($anchorDate);
            $weekday = (int) date('N', $ts);
            $startTs = strtotime('-' . ($weekday - 1) . ' days', $ts);
            $endTs = strtotime('+' . (7 - $weekday) . ' days', $ts);

            return [date('Y-m-d', $startTs), date('Y-m-d', $endTs)];
        }

        return [$anchorDate, $anchorDate];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadEditableAppointment(
        int $pcEid,
        int $facilityId,
        ?string $recurrScope = null,
        ?string $occurrenceDate = null,
    ): array {
        $row = QueryUtils::querySingleRow(
            'SELECT pc_eid, pc_pid AS pid, pc_eventDate, pc_startTime, pc_endTime, pc_duration, pc_recurrtype,
                    pc_recurrspec, pc_endDate, pc_facility, pc_aid, pc_multiple, pc_catid, pc_title,
                    pc_hometext, pc_apptstatus, pc_billing_location, pc_room, pc_alldayevent, pc_prefcatid
             FROM openemr_postcalendar_events WHERE pc_eid = ?',
            [$pcEid]
        );
        if (empty($row)) {
            throw new \InvalidArgumentException('Appointment not found');
        }
        $isRecurring = (int) ($row['pc_recurrtype'] ?? 0) !== 0;
        if ($isRecurring) {
            $scope = $this->normalizeRecurrScope($recurrScope);
            if ($occurrenceDate === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $occurrenceDate)) {
                throw new \InvalidArgumentException('occurrence_date is required for recurring appointments');
            }
            if (!empty($row['pc_multiple'])) {
                throw new \InvalidArgumentException('Multi-provider recurring appointments cannot be modified here yet');
            }
            if ($scope === null) {
                throw new \InvalidArgumentException('recurr_scope is required for recurring appointments');
            }
        }
        if ($facilityId > 0 && (int) ($row['pc_facility'] ?? 0) !== $facilityId) {
            throw new \RuntimeException('Appointment is not in the selected facility', 403);
        }

        return $row;
    }

    private function assertNoProviderConflict(
        int $excludePcEid,
        int $providerId,
        int $facilityId,
        string $date,
        string $startTime,
        string $endTime,
    ): void {
        if ($providerId <= 0 || $facilityId <= 0) {
            return;
        }

        $conflict = QueryUtils::querySingleRow(
            "SELECT pc_eid FROM openemr_postcalendar_events
             WHERE pc_aid = ?
               AND pc_facility = ?
               AND pc_eventDate = ?
               AND pc_recurrtype = 0
               AND pc_apptstatus NOT IN ('*', '%', 'x', 'X')
               AND pc_eid != ?
               AND pc_startTime < ?
               AND pc_endTime > ?
             LIMIT 1",
            [$providerId, $facilityId, $date, $excludePcEid, $endTime, $startTime]
        );

        if (!empty($conflict)) {
            throw new \InvalidArgumentException('Provider already has an appointment in this time slot');
        }
    }

    private function logSchedulingEvent(int $actorUserId, string $eventType, string $comment): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            $eventType,
            $actorUserId,
            1,
            $comment
        );
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function bookAppointment(int $facilityId, array $input, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Appointment write permission denied', 403);
        }

        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $pid = (int) ($input['pid'] ?? 0);
        $catId = (int) ($input['pc_catid'] ?? 0);
        $providerId = (int) ($input['provider_id'] ?? 0);
        $date = trim((string) ($input['date'] ?? ''));
        $time = trim((string) ($input['time'] ?? ''));
        $duration = (int) ($input['duration_minutes'] ?? 0);
        $comments = trim((string) ($input['comments'] ?? ''));

        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
        if ($catId <= 0) {
            throw new \InvalidArgumentException('Category is required');
        }
        if ($providerId <= 0) {
            throw new \InvalidArgumentException('Provider is required');
        }
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException('Valid date is required');
        }
        if ($time === '' || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            throw new \InvalidArgumentException('Valid time is required (HH:MM)');
        }
        if ($duration <= 0) {
            $duration = $this->resolveIntervalMinutes();
        }

        $categories = $this->visitTypes->listCalendarCategories();
        $categoryName = '';
        foreach ($categories as $cat) {
            if ((int) ($cat['pc_catid'] ?? 0) === $catId) {
                $categoryName = (string) ($cat['name'] ?? 'Appointment');
                break;
            }
        }
        if ($categoryName === '') {
            throw new \InvalidArgumentException('Invalid calendar category');
        }

        $startTime = $time . ':00';
        $durationSeconds = $duration * 60;
        $startTs = strtotime($date . ' ' . $startTime);
        if ($startTs === false) {
            throw new \InvalidArgumentException('Invalid date/time');
        }
        $endTime = date('H:i:s', $startTs + $durationSeconds);
        $this->assertNoProviderConflict(0, $providerId, $facilityId, $date, $startTime, $endTime);

        $appointmentService = new AppointmentService();
        $startDateTime = $date . ' ' . $startTime;
        $eid = $appointmentService->insert($pid, [
            'pc_catid' => $catId,
            'pc_title' => $categoryName,
            'pc_duration' => $duration * 60,
            'pc_hometext' => $comments,
            'pc_eventDate' => $date,
            'pc_apptstatus' => '-',
            'pc_startTime' => $startDateTime,
            'pc_facility' => $facilityId,
            'pc_billing_location' => $facilityId,
            'pc_aid' => $providerId,
        ]);

        if (empty($eid)) {
            throw new \RuntimeException('Failed to save appointment');
        }

        $recallId = (int) ($input['recall_id'] ?? 0);
        if ($recallId > 0) {
            $this->recalls->linkProducedAppointment($recallId, (int) $eid, $actorUserId);
        }

        $this->logSchedulingEvent(
            $actorUserId,
            'scheduling-calendar-book',
            'pc_eid=' . (int) $eid . ' pid=' . $pid . ' date=' . $date . ' time=' . $time
        );

        return $this->getDayView(
            $facilityId,
            $date,
            isset($input['provider_id']) && (int) $input['provider_id'] > 0 ? (int) $input['provider_id'] : null
        );
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, string> $statusLabels
     * @param array<int, string> $providerLabels
     * @return array<string, mixed>|null
     */
    private function mapCalendarRow(array $row, array $statusLabels, array $providerLabels): ?array
    {
        $pid = (int) ($row['pid'] ?? 0);
        $pcEid = (int) ($row['pc_eid'] ?? 0);
        if ($pid <= 0 || $pcEid <= 0) {
            return null;
        }

        $status = (string) ($row['pc_apptstatus'] ?? '');
        if (in_array($status, self::HIDDEN_STATUSES, true)) {
            return null;
        }

        $startTime = (string) ($row['pc_startTime'] ?? '');
        $durationSeconds = (int) ($row['pc_duration'] ?? 0);
        $startLabel = $startTime !== '' ? substr($startTime, 0, 5) : '';
        $endLabel = '';
        if ($startTime !== '' && $durationSeconds > 0) {
            $endTs = strtotime($startTime) + $durationSeconds;
            $endLabel = $endTs !== false ? date('H:i', $endTs) : '';
        }

        $fname = trim((string) ($row['fname'] ?? ''));
        $lname = trim((string) ($row['lname'] ?? ''));
        $providerId = (int) ($row['pc_aid'] ?? $row['uprovider_id'] ?? 0);

        return [
            'pc_eid' => $pcEid,
            'pid' => $pid,
            'pubpid' => (string) ($row['pubpid'] ?? ''),
            'patient_name' => trim($fname . ' ' . $lname) ?: ('PID ' . $pid),
            'event_date' => (string) ($row['pc_eventDate'] ?? ''),
            'start_time' => $startLabel,
            'end_time' => $endLabel,
            'duration_minutes' => max(1, (int) round($durationSeconds / 60)),
            'provider_id' => $providerId,
            'provider_label' => $providerLabels[$providerId] ?? ('Provider ' . $providerId),
            'category_id' => (int) ($row['pc_catid'] ?? 0),
            'category_label' => (string) ($row['pc_catname'] ?? ''),
            'status' => $status,
            'status_label' => $statusLabels[$status] ?? $status,
            'is_recurring' => (int) ($row['pc_recurrtype'] ?? 0) !== 0,
            'comments' => (string) ($row['pc_hometext'] ?? ''),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function loadStatusLabels(): array
    {
        $listService = new ListService();
        $options = $listService->getOptionsByListName('apptstat', ['activity' => 1]) ?: [];
        $labels = [];
        foreach ($options as $option) {
            $code = (string) ($option['option_id'] ?? '');
            if ($code !== '') {
                $labels[$code] = (string) ($option['title'] ?? $code);
            }
        }

        return $labels;
    }

    /**
     * @return array<int, string>
     */
    private function providerLabelMap(int $facilityId): array
    {
        $map = [];
        foreach ($this->shell->getBootstrapPayload($facilityId)['providers'] as $provider) {
            $id = (int) ($provider['id'] ?? 0);
            if ($id > 0) {
                $map[$id] = (string) ($provider['label'] ?? ('Provider ' . $id));
            }
        }

        return $map;
    }

    private function resolveIntervalMinutes(): int
    {
        $minutes = (int) ($GLOBALS['calendar_interval'] ?? 15);

        return max(5, min(60, $minutes > 0 ? $minutes : 15));
    }

    /**
     * @param list<array<string, mixed>> $events
     */
    private function computeRangeRevision(array $events): string
    {
        $parts = [];
        foreach ($events as $event) {
            $parts[] = implode('|', [
                (int) ($event['pc_eid'] ?? 0),
                (string) ($event['event_date'] ?? ''),
                (string) ($event['start_time'] ?? ''),
                (int) ($event['duration_minutes'] ?? 0),
                (int) ($event['provider_id'] ?? 0),
                (string) ($event['status'] ?? ''),
            ]);
        }

        return sha1(implode(';', $parts));
    }

    private function ensureLegacyIncludes(): void
    {
        if (self::$legacyLoaded) {
            return;
        }

        $root = dirname(__DIR__, 6);
        require_once $root . '/library/appointments.inc.php';
        require_once $root . '/library/encounter_events.inc.php';
        self::$legacyLoaded = true;
    }

    private function normalizeRecurrScope(mixed $scope): ?string
    {
        if ($scope === null || $scope === '') {
            return null;
        }
        $scope = strtolower(trim((string) $scope));
        if (!in_array($scope, ['current', 'future', 'all'], true)) {
            throw new \InvalidArgumentException('recurr_scope must be current, future, or all');
        }

        return $scope;
    }

    /**
     * @param array<string, mixed> $master
     */
    private function applyRecurringModification(
        array $master,
        string $occurrenceDate,
        string $recurrScope,
        string $targetDate,
        string $startTime,
        string $endTime,
        int $durationSeconds,
        ?int $providerId,
    ): void {
        $pcEid = (int) ($master['pc_eid'] ?? 0);
        if ($pcEid <= 0) {
            throw new \InvalidArgumentException('Appointment not found');
        }

        if ($recurrScope === 'all') {
            $binds = [$targetDate, $startTime, $endTime, $durationSeconds, $pcEid];
            $sql = 'UPDATE openemr_postcalendar_events
                    SET pc_eventDate = ?, pc_startTime = ?, pc_endTime = ?, pc_duration = ?';
            if ($providerId !== null && $providerId > 0) {
                $sql .= ', pc_aid = ?';
                $binds = [$targetDate, $startTime, $endTime, $durationSeconds, $providerId, $pcEid];
            }
            $sql .= ' WHERE pc_eid = ?';
            QueryUtils::sqlStatementThrowException($sql, $binds);

            return;
        }

        if ($recurrScope === 'current') {
            $recurrspec = $this->appendExdate((string) ($master['pc_recurrspec'] ?? ''), $occurrenceDate);
            QueryUtils::sqlStatementThrowException(
                'UPDATE openemr_postcalendar_events SET pc_recurrspec = ? WHERE pc_eid = ?',
                [$recurrspec, $pcEid]
            );
            $this->insertNonRecurringClone($master, $targetDate, $startTime, $endTime, $durationSeconds, $providerId);

            return;
        }

        $endBefore = date('Ymd', strtotime($occurrenceDate . ' -1 day'));
        QueryUtils::sqlStatementThrowException(
            'UPDATE openemr_postcalendar_events SET pc_endDate = ? WHERE pc_eid = ?',
            [$endBefore, $pcEid]
        );
        $this->insertRecurringClone($master, $targetDate, $startTime, $endTime, $durationSeconds, $providerId);
    }

    private function appendExdate(string $recurrspecSerialized, string $occurrenceDate): string
    {
        $spec = @unserialize($recurrspecSerialized, ['allowed_classes' => false]);
        if (!is_array($spec)) {
            $spec = ['exdate' => ''];
        }
        $exdate = date('Ymd', strtotime($occurrenceDate));
        $existing = trim((string) ($spec['exdate'] ?? ''));
        $spec['exdate'] = $existing !== '' ? ($existing . ',' . $exdate) : $exdate;

        return serialize($spec);
    }

    /**
     * @param array<string, mixed> $master
     */
    private function insertNonRecurringClone(
        array $master,
        string $eventDate,
        string $startTime,
        string $endTime,
        int $durationSeconds,
        ?int $providerId,
    ): void {
        $noRecurrspec = serialize([
            'event_repeat_freq' => '',
            'event_repeat_freq_type' => '',
            'event_repeat_on_num' => '1',
            'event_repeat_on_day' => '0',
            'event_repeat_on_freq' => '0',
            'exdate' => '',
        ]);

        QueryUtils::sqlStatementThrowException(
            'INSERT INTO openemr_postcalendar_events
             (pc_catid, pc_aid, pc_pid, pc_title, pc_hometext, pc_eventDate, pc_endDate, pc_duration,
              pc_recurrtype, pc_recurrspec, pc_startTime, pc_endTime, pc_apptstatus, pc_facility,
              pc_billing_location, pc_room, pc_alldayevent, pc_prefcatid, pc_informant, pc_time,
              pc_eventstatus, pc_sharing)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1, 1)',
            [
                (int) ($master['pc_catid'] ?? 0),
                $providerId !== null && $providerId > 0 ? $providerId : (int) ($master['pc_aid'] ?? 0),
                (int) ($master['pid'] ?? 0),
                (string) ($master['pc_title'] ?? ''),
                (string) ($master['pc_hometext'] ?? ''),
                $eventDate,
                '0000-00-00',
                $durationSeconds,
                $noRecurrspec,
                $startTime,
                $endTime,
                (string) ($master['pc_apptstatus'] ?? '-'),
                (int) ($master['pc_facility'] ?? 0),
                (int) ($master['pc_billing_location'] ?? 0),
                (string) ($master['pc_room'] ?? ''),
                (int) ($master['pc_alldayevent'] ?? 0),
                (int) ($master['pc_prefcatid'] ?? 0),
                (int) ($_SESSION['authUserID'] ?? 0),
            ]
        );
    }

    /**
     * @param array<string, mixed> $master
     */
    private function insertRecurringClone(
        array $master,
        string $eventDate,
        string $startTime,
        string $endTime,
        int $durationSeconds,
        ?int $providerId,
    ): void {
        QueryUtils::sqlStatementThrowException(
            'INSERT INTO openemr_postcalendar_events
             (pc_catid, pc_aid, pc_pid, pc_title, pc_hometext, pc_eventDate, pc_endDate, pc_duration,
              pc_recurrtype, pc_recurrspec, pc_startTime, pc_endTime, pc_apptstatus, pc_facility,
              pc_billing_location, pc_room, pc_alldayevent, pc_prefcatid, pc_informant, pc_time,
              pc_eventstatus, pc_sharing)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1, 1)',
            [
                (int) ($master['pc_catid'] ?? 0),
                $providerId !== null && $providerId > 0 ? $providerId : (int) ($master['pc_aid'] ?? 0),
                (int) ($master['pid'] ?? 0),
                (string) ($master['pc_title'] ?? ''),
                (string) ($master['pc_hometext'] ?? ''),
                $eventDate,
                (string) ($master['pc_endDate'] ?? '0000-00-00'),
                $durationSeconds,
                (int) ($master['pc_recurrtype'] ?? 0),
                (string) ($master['pc_recurrspec'] ?? ''),
                $startTime,
                $endTime,
                (string) ($master['pc_apptstatus'] ?? '-'),
                (int) ($master['pc_facility'] ?? 0),
                (int) ($master['pc_billing_location'] ?? 0),
                (string) ($master['pc_room'] ?? ''),
                (int) ($master['pc_alldayevent'] ?? 0),
                (int) ($master['pc_prefcatid'] ?? 0),
                (int) ($_SESSION['authUserID'] ?? 0),
            ]
        );
    }
}
