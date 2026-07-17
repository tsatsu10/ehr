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
use OpenEMR\Modules\NewClinic\Support\ApptStatusLabel;
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

    private ?SchedulingProviderColorService $providerColors = null;

    /** Lazy — avoid eager-constructing a second service tree (constructor-cycle guard). */
    private function providerColorService(): SchedulingProviderColorService
    {
        return $this->providerColors ??= new SchedulingProviderColorService();
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
        // One bootstrap read per range load — providers drive the row labels,
        // the payload list, and the colour map. getBootstrapPayload() isn't
        // cached and runs on every 30s poll, so never fetch it twice.
        $providers = $this->shell->getBootstrapPayload($facilityId)['providers'];
        $providerLabels = [];
        $providerIds = [];
        foreach ($providers as $provider) {
            $id = (int) ($provider['id'] ?? 0);
            if ($id > 0) {
                $providerLabels[$id] = (string) ($provider['label'] ?? ('Provider ' . $id));
                $providerIds[] = $id;
            }
        }

        // Visit types drive the chip colour + the "what is this appointment"
        // label. The unification collapsed every type onto one pc_catid, so the
        // only per-appointment signal is pc_title — match that back to a visit
        // type by (case-insensitive) label.
        $visitTypesForDesk = $this->visitTypes->listForDesk($facilityId);
        $visitTypeIdByLabel = [];
        foreach ($visitTypesForDesk as $vt) {
            $key = mb_strtolower(trim((string) ($vt['label'] ?? '')));
            if ($key !== '') {
                $visitTypeIdByLabel[$key] = (int) ($vt['id'] ?? 0);
            }
        }

        $events = [];
        foreach ($appointments as $row) {
            $event = $this->mapCalendarRow($row, $statusLabels, $providerLabels, $visitTypeIdByLabel);
            if ($event !== null) {
                $events[] = $event;
            }
        }
        // Clinic/group blocks (no patient) — fetchAppointments hard-excludes
        // pc_pid='' rows, so pull them separately and render as read-only chips.
        foreach ($this->fetchBlockEvents($startDate, $endDate, $facilityId, $providerId) as $blockRow) {
            $block = $this->mapBlockRow($blockRow, $providerLabels, $visitTypeIdByLabel);
            if ($block !== null) {
                $events[] = $block;
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
        $revision = $this->computeRangeSignature($facilityId, $startDate, $endDate, $providerId);
        $providerColors = $this->providerColorService()->resolveColors($providerIds, $facilityId);
        $visitTypeColors = $this->resolveVisitTypeColors($visitTypesForDesk);

        return [
            'view' => $view,
            'anchor_date' => $anchorDate,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'date' => $anchorDate,
            'facility_id' => $facilityId,
            'provider_id' => $providerId,
            'interval_minutes' => $this->resolveIntervalMinutes(),
            // Clinic day bounds so the grid spans real hours, not a fixed 08–18.
            'open_hour' => $this->resolveClinicHours()[0],
            'close_hour' => $this->resolveClinicHours()[1],
            'events' => $events,
            'revision' => $revision,
            // "categories" is booking-sheet vocabulary for historical reasons; the
            // options are visit types (Admin → Clinic Setup, same list Front Desk's
            // Start Visit uses) so adding one type makes it bookable in both places.
            'categories' => array_map(static function (array $vt): array {
                return [
                    'id' => (int) ($vt['id'] ?? 0),
                    'label' => (string) ($vt['label'] ?? ''),
                ];
            }, $visitTypesForDesk),
            'default_visit_type_id' => $this->resolveDefaultVisitTypeId($visitTypesForDesk),
            'providers' => $providers,
            // providerId => "#rrggbb" — provider identity (the small dot on
            // multi-doctor days). Chip FILL is coloured by visit type instead.
            'provider_colors' => $providerColors,
            // visitTypeId => "#rrggbb" — the chip fill colour, so a single-
            // doctor clinic's week still reads by appointment type at a glance.
            'visit_type_colors' => $visitTypeColors,
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
        // Cheap change-detection FIRST: one aggregate query over the range's
        // event rows produces the same signature getRangeView stamps as its
        // revision. When it matches the client's, skip the whole rebuild
        // (getBootstrapPayload, fetchAppointments, blocks, colours) — the poll
        // costs ~one small query instead of the full payload every 30s.
        $this->access->assertHubAccess();
        $resolvedFacilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);
        $view = in_array($view, ['day', 'week', 'month'], true) ? $view : 'day';
        [$startDate, $endDate] = $this->resolveViewDateRange($anchorDate, $view);
        $signature = $this->computeRangeSignature($resolvedFacilityId, $startDate, $endDate, $providerId);
        $pollMs = max(30000, (int) ($GLOBALS['pat_trkr_timer'] ?? 20) * 1000);

        if ($clientRevision !== '' && $clientRevision === $signature) {
            return [
                'unchanged' => true,
                'revision' => $signature,
                'poll_interval_ms' => $pollMs,
            ];
        }

        $range = $this->getRangeView($facilityId, $anchorDate, $view, $providerId);
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
     * Cancel a (non-recurring) appointment from the calendar peek: sets the
     * event to a hidden/cancelled status so it drops off the calendar — and off
     * the flow board too, which discards CLOSED_STATUSES appointments on its
     * own (no tracker write needed; patient_tracker has no status column — the
     * status lives in patient_tracker_element). Recurring series are out of
     * scope here (cancel those from the appointment editor).
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function cancelAppointment(int $facilityId, array $input, int $actorUserId): array
    {
        $this->access->assertHubAccess();
        if (!$this->access->canBookAppointment()) {
            throw new \RuntimeException('Appointment write permission denied', 403);
        }

        $pcEid = (int) ($input['pc_eid'] ?? 0);
        if ($pcEid <= 0) {
            throw new \InvalidArgumentException('Appointment id is required');
        }
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);

        $row = QueryUtils::querySingleRow(
            'SELECT pc_pid AS pid, pc_eventDate, pc_recurrtype, pc_facility
             FROM openemr_postcalendar_events WHERE pc_eid = ?',
            [$pcEid]
        );
        if (empty($row)) {
            throw new \InvalidArgumentException('Appointment not found');
        }
        if ($facilityId > 0 && (int) ($row['pc_facility'] ?? 0) !== $facilityId) {
            throw new \RuntimeException('Appointment is not in the selected facility', 403);
        }
        if ((int) ($row['pc_recurrtype'] ?? 0) !== 0) {
            throw new \InvalidArgumentException('Cancel a recurring series from the appointment editor');
        }

        QueryUtils::sqlStatementThrowException(
            "UPDATE openemr_postcalendar_events SET pc_apptstatus = 'x' WHERE pc_eid = ? AND pc_recurrtype = 0",
            [$pcEid]
        );

        $this->logSchedulingEvent($actorUserId, 'scheduling-calendar-cancel', 'pc_eid=' . $pcEid);

        $view = (string) ($input['view'] ?? 'day');
        $anchorDate = trim((string) ($input['anchor_date'] ?? ''));
        $anchor = $anchorDate !== '' ? $anchorDate : (string) ($row['pc_eventDate'] ?? date('Y-m-d'));

        return $this->getRangeView(
            $facilityId,
            $anchor,
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
        $visitTypeId = (int) ($input['visit_type_id'] ?? 0);
        $providerId = (int) ($input['provider_id'] ?? 0);
        $date = trim((string) ($input['date'] ?? ''));
        $time = trim((string) ($input['time'] ?? ''));
        $duration = (int) ($input['duration_minutes'] ?? 0);
        $comments = trim((string) ($input['comments'] ?? ''));

        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient is required');
        }
        if ($visitTypeId <= 0) {
            throw new \InvalidArgumentException('Visit type is required');
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

        $visitType = $this->visitTypes->getVisitTypeForBooking($visitTypeId, $facilityId);
        if ($visitType === null) {
            throw new \InvalidArgumentException('Invalid visit type');
        }
        $catId = $visitType['pc_catid'];
        $categoryName = $visitType['label'];

        $startTime = $time . ':00';
        $durationSeconds = $duration * 60;
        $startTs = strtotime($date . ' ' . $startTime);
        if ($startTs === false) {
            throw new \InvalidArgumentException('Invalid date/time');
        }
        $endTime = date('H:i:s', $startTs + $durationSeconds);
        // Conflict check is against the first occurrence only (recurring series
        // aren't hard-blocked — matches move/resize behaviour).
        $this->assertNoProviderConflict(0, $providerId, $facilityId, $date, $startTime, $endTime);

        $repeat = strtolower(trim((string) ($input['repeat'] ?? 'none')));
        if ($repeat !== '' && $repeat !== 'none') {
            $eid = $this->insertRecurringBooking(
                $pid,
                (int) $catId,
                (string) $categoryName,
                $duration,
                $comments,
                $date,
                $startTime,
                $endTime,
                $facilityId,
                $providerId,
                $repeat,
                trim((string) ($input['repeat_until'] ?? ''))
            );
        } else {
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
        }

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
     * repeat option → [event_repeat_freq, event_repeat_freq_type] for a
     * pc_recurrtype=1 series. freq_type: 1=week, 2=month (library/appointments.inc.php).
     *
     * @return array{0: int, 1: int}
     */
    private function resolveRepeatSpec(string $repeat): array
    {
        return match ($repeat) {
            'weekly' => [1, 1],
            'biweekly' => [2, 1],
            'monthly' => [1, 2],
            default => throw new \InvalidArgumentException('Unsupported repeat option'),
        };
    }

    /**
     * Insert a repeating appointment as ONE recurring master row (pc_recurrtype=1);
     * fetchEvents expands the occurrences on read, so no per-occurrence rows are
     * stored. AppointmentService::insert() only writes single events, hence the
     * direct insert here.
     */
    private function insertRecurringBooking(
        int $pid,
        int $catId,
        string $title,
        int $durationMinutes,
        string $comments,
        string $date,
        string $startTime,
        string $endTime,
        int $facilityId,
        int $providerId,
        string $repeat,
        string $repeatUntil
    ): int {
        [$freq, $freqType] = $this->resolveRepeatSpec($repeat);

        if ($repeatUntil === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $repeatUntil)) {
            throw new \InvalidArgumentException('A repeat-until date is required for a repeating appointment');
        }
        if ($repeatUntil < $date) {
            throw new \InvalidArgumentException('The repeat-until date must be on or after the appointment date');
        }
        // Cap the horizon so a mistyped year can't create a decades-long series.
        $maxUntil = date('Y-m-d', (int) strtotime($date . ' +2 years'));
        if ($repeatUntil > $maxUntil) {
            $repeatUntil = $maxUntil;
        }

        $recurrspec = serialize([
            'event_repeat_freq' => (string) $freq,
            'event_repeat_freq_type' => (string) $freqType,
            'event_repeat_on_num' => '1',
            'event_repeat_on_day' => '0',
            'event_repeat_on_freq' => '0',
            'exdate' => '',
        ]);

        return (int) QueryUtils::sqlInsert(
            'INSERT INTO openemr_postcalendar_events
             (pc_catid, pc_aid, pc_pid, pc_title, pc_hometext, pc_eventDate, pc_endDate, pc_duration,
              pc_recurrtype, pc_recurrspec, pc_startTime, pc_endTime, pc_apptstatus, pc_facility,
              pc_billing_location, pc_time, pc_informant, pc_eventstatus, pc_sharing)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, NOW(), 1, 1, 1)',
            [
                $catId,
                $providerId,
                $pid,
                $title,
                $comments,
                $date,
                $repeatUntil,
                $durationMinutes * 60,
                $recurrspec,
                $startTime,
                $endTime,
                '-',
                $facilityId,
                $facilityId,
            ]
        );
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, string> $statusLabels
     * @param array<int, string> $providerLabels
     * @param array<string, int> $visitTypeIdByLabel label(lowercased) => visit type id
     * @return array<string, mixed>|null
     */
    private function mapCalendarRow(array $row, array $statusLabels, array $providerLabels, array $visitTypeIdByLabel): ?array
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
        // The visit type is carried on pc_title (the shared pc_catname is always
        // "Office Visit" post-unification, so it can't distinguish types).
        [$visitTypeId, $visitTypeLabel] = $this->resolveEventVisitType($row, $visitTypeIdByLabel);

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
            'category_label' => $visitTypeLabel,
            'visit_type_id' => $visitTypeId,
            'is_block' => false,
            'status' => $status,
            'status_label' => $statusLabels[$status] ?? $status,
            'is_recurring' => (int) ($row['pc_recurrtype'] ?? 0) !== 0,
            'comments' => (string) ($row['pc_hometext'] ?? ''),
        ];
    }

    /**
     * A clinic/group block (no patient) → a read-only labelled chip. Blocks
     * carry no pid/MRN and aren't draggable; the calendar renders them muted.
     *
     * @param array<string, mixed> $row
     * @param array<int, string> $providerLabels
     * @param array<string, int> $visitTypeIdByLabel
     * @return array<string, mixed>|null
     */
    private function mapBlockRow(array $row, array $providerLabels, array $visitTypeIdByLabel): ?array
    {
        $pcEid = (int) ($row['pc_eid'] ?? 0);
        if ($pcEid <= 0) {
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
        $providerId = (int) ($row['pc_aid'] ?? 0);
        [$visitTypeId, $visitTypeLabel] = $this->resolveEventVisitType($row, $visitTypeIdByLabel);
        $title = trim((string) ($row['pc_title'] ?? ''));
        if ($title === '') {
            $title = trim((string) ($row['pc_catname'] ?? '')) ?: 'Reserved';
        }

        return [
            'pc_eid' => $pcEid,
            'pid' => 0,
            'pubpid' => '',
            'patient_name' => $title,
            'event_date' => (string) ($row['pc_eventDate'] ?? ''),
            'start_time' => $startLabel,
            'end_time' => $endLabel,
            'duration_minutes' => max(1, (int) round($durationSeconds / 60)),
            'provider_id' => $providerId,
            'provider_label' => $providerLabels[$providerId] ?? '',
            'category_id' => (int) ($row['pc_catid'] ?? 0),
            'category_label' => $visitTypeLabel,
            'visit_type_id' => $visitTypeId,
            'is_block' => true,
            'status' => $status,
            'status_label' => '',
            'is_recurring' => false,
            'comments' => (string) ($row['pc_hometext'] ?? ''),
        ];
    }

    /**
     * Resolve an event's visit type from pc_title. Returns [id, label] where id
     * is 0 when the title doesn't match a current visit type (legacy/block),
     * and label falls back to the shared category name then a generic word.
     *
     * @param array<string, mixed> $row
     * @param array<string, int> $visitTypeIdByLabel
     * @return array{0: int, 1: string}
     */
    private function resolveEventVisitType(array $row, array $visitTypeIdByLabel): array
    {
        $title = trim((string) ($row['pc_title'] ?? ''));
        $label = $title !== '' ? $title : trim((string) ($row['pc_catname'] ?? ''));
        $id = $visitTypeIdByLabel[mb_strtolower($title)] ?? 0;

        return [$id, $label];
    }

    /**
     * Non-patient clinic/group blocks in the range. fetchAppointments() filters
     * `pc_pid != ''` in SQL, so these need their own bounded query. Restricted
     * to appointment-type categories (pc_cattype = 0) so provider-availability
     * markers (In/Out of office) don't flood the grid. Non-recurring only.
     *
     * @return list<array<string, mixed>>
     */
    private function fetchBlockEvents(string $startDate, string $endDate, int $facilityId, ?int $providerId): array
    {
        $where = [
            "(e.pc_pid = '' OR e.pc_pid = '0' OR e.pc_pid IS NULL)",
            'e.pc_eventDate BETWEEN ? AND ?',
            'e.pc_recurrtype = 0',
            "e.pc_apptstatus NOT IN ('*', '%', 'x', 'X')",
            '(c.pc_cattype = 0 OR c.pc_cattype IS NULL)',
        ];
        $bind = [$startDate, $endDate];
        if ($facilityId > 0) {
            $where[] = 'e.pc_facility = ?';
            $bind[] = $facilityId;
        }
        if ($providerId !== null && $providerId > 0) {
            $where[] = 'e.pc_aid = ?';
            $bind[] = $providerId;
        }

        return QueryUtils::fetchRecords(
            'SELECT e.pc_eid, e.pc_aid, e.pc_title, e.pc_hometext, e.pc_eventDate, e.pc_startTime,
                    e.pc_endTime, e.pc_duration, e.pc_apptstatus, e.pc_catid, c.pc_catname
             FROM openemr_postcalendar_events AS e
             LEFT JOIN openemr_postcalendar_categories AS c ON c.pc_catid = e.pc_catid
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY e.pc_eventDate, e.pc_startTime',
            $bind
        ) ?: [];
    }

    /**
     * Auto colour per visit type from the shared palette, by the type's
     * position in the (label-sorted) desk list — a stable, distinct fill per
     * type with no admin step. Mirrors the provider-colour default logic.
     *
     * @param array<int, array<string, mixed>> $visitTypesForDesk listForDesk() output
     * @return array<int, string> visitTypeId => "#rrggbb"
     */
    private function resolveVisitTypeColors(array $visitTypesForDesk): array
    {
        $colors = [];
        $index = 0;
        foreach ($visitTypesForDesk as $vt) {
            $id = (int) ($vt['id'] ?? 0);
            if ($id > 0) {
                $colors[$id] = SchedulingProviderColorService::defaultColorForIndex($index);
                $index++;
            }
        }

        return $colors;
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
                $labels[$code] = ApptStatusLabel::clean($code, (string) ($option['title'] ?? $code));
            }
        }

        return $labels;
    }

    /**
     * @param array<int, array<string, mixed>> $visitTypesForDesk listForDesk() output
     */
    private function resolveDefaultVisitTypeId(array $visitTypesForDesk): int
    {
        foreach ($visitTypesForDesk as $vt) {
            if (!empty($vt['is_default'])) {
                return (int) $vt['id'];
            }
        }

        return (int) ($visitTypesForDesk[0]['id'] ?? 0);
    }

    private function resolveIntervalMinutes(): int
    {
        $minutes = (int) ($GLOBALS['calendar_interval'] ?? 15);

        return max(5, min(60, $minutes > 0 ? $minutes : 15));
    }

    /**
     * Clinic open/close hour (0–24) from globals, so the calendar grid spans the
     * clinic's real day — not a hardcoded 08–18 that would hide out-of-hours
     * appointments. Same source the free-slot computation uses.
     *
     * @return array{0: int, 1: int} [openHour, closeHour], close always > open
     */
    private function resolveClinicHours(): array
    {
        $open = max(0, min(23, (int) ($GLOBALS['schedule_start'] ?? 8)));
        $close = max(1, min(24, (int) ($GLOBALS['schedule_end'] ?? 18)));
        if ($close <= $open) {
            $close = min(24, $open + 1);
        }

        return [$open, $close];
    }

    /**
     * Next open slots for the booking sheet's "Next free times" chips.
     * Suggestions only — save still runs assertNoProviderConflict(), so a
     * stale suggestion fails safely. Mirrors the conflict check's view of
     * "busy": non-recurring events at this provider+facility+date whose
     * status isn't cancelled/hidden.
     *
     * @param array<string, mixed> $input
     * @return array{slots: list<string>, interval_minutes: int}
     */
    public function getFreeSlots(int $facilityId, array $input, int $limit = 5): array
    {
        $this->access->assertHubAccess();
        $facilityId = $this->visitScope->resolveDeskFacilityId($facilityId > 0 ? $facilityId : null);

        $providerId = (int) ($input['provider_id'] ?? 0);
        $date = trim((string) ($input['date'] ?? ''));
        $duration = (int) ($input['duration_minutes'] ?? 0);
        $interval = $this->resolveIntervalMinutes();
        if ($duration <= 0) {
            $duration = $interval;
        }
        if ($providerId <= 0) {
            throw new \InvalidArgumentException('Provider is required');
        }
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException('Valid date is required');
        }

        $busyRows = QueryUtils::fetchRecords(
            "SELECT pc_startTime, pc_endTime FROM openemr_postcalendar_events
             WHERE pc_aid = ?
               AND pc_facility = ?
               AND pc_eventDate = ?
               AND pc_recurrtype = 0
               AND pc_apptstatus NOT IN ('*', '%', 'x', 'X')",
            [$providerId, $facilityId, $date]
        ) ?: [];
        $busy = [];
        foreach ($busyRows as $row) {
            $start = self::timeToMinutes((string) ($row['pc_startTime'] ?? ''));
            $end = self::timeToMinutes((string) ($row['pc_endTime'] ?? ''));
            if ($start !== null && $end !== null && $end > $start) {
                $busy[] = [$start, $end];
            }
        }

        [$openHour, $closeHour] = $this->resolveClinicHours();
        $openMinutes = $openHour * 60;
        $closeMinutes = $closeHour * 60;
        // Never suggest a time already in the past for today's bookings.
        $notBefore = $date === date('Y-m-d') ? ((int) date('G') * 60 + (int) date('i')) : null;

        return [
            'slots' => self::computeFreeSlots($busy, $openMinutes, $closeMinutes, $interval, $duration, $notBefore, $limit),
            'interval_minutes' => $interval,
        ];
    }

    /**
     * Pure slot computation, separated for unit testing.
     *
     * @param list<array{0: int, 1: int}> $busy [startMinutes, endMinutes) intervals
     * @return list<string> HH:MM start times
     */
    public static function computeFreeSlots(
        array $busy,
        int $openMinutes,
        int $closeMinutes,
        int $intervalMinutes,
        int $durationMinutes,
        ?int $notBeforeMinutes,
        int $limit = 5,
    ): array {
        $slots = [];
        $intervalMinutes = max(5, $intervalMinutes);
        $durationMinutes = max(1, $durationMinutes);
        for ($t = $openMinutes; $t + $durationMinutes <= $closeMinutes; $t += $intervalMinutes) {
            if ($notBeforeMinutes !== null && $t < $notBeforeMinutes) {
                continue;
            }
            $slotEnd = $t + $durationMinutes;
            $free = true;
            foreach ($busy as [$busyStart, $busyEnd]) {
                if ($t < $busyEnd && $slotEnd > $busyStart) {
                    $free = false;
                    break;
                }
            }
            if ($free) {
                $slots[] = sprintf('%02d:%02d', intdiv($t, 60), $t % 60);
                if (count($slots) >= $limit) {
                    break;
                }
            }
        }

        return $slots;
    }

    private static function timeToMinutes(string $time): ?int
    {
        if (!preg_match('/^(\d{1,2}):(\d{2})/', $time, $m)) {
            return null;
        }

        return ((int) $m[1]) * 60 + (int) $m[2];
    }

    /**
     * Cheap content signature for a range — one aggregate query, no row build.
     * Order-independent XOR of a CRC over each event's display-driving fields,
     * plus a COUNT (guards the rare case where two XOR deltas cancel). Uses the
     * same range WHERE as fetchEvents (so recurring masters that recur into the
     * window are included) and the same facility/provider filters as the view.
     * A superset of the visible events is fine: any change to a visible event
     * flips the signature; the worst case is an occasional extra repaint, never
     * a missed update. (Patient/visit-type renames aren't in the events table —
     * the old event-hash revision didn't catch those either.)
     */
    protected function computeRangeSignature(int $facilityId, string $startDate, string $endDate, ?int $providerId): string
    {
        $where = [
            '((e.pc_endDate >= ? AND e.pc_eventDate <= ? AND e.pc_recurrtype > 0)'
                . ' OR (e.pc_eventDate >= ? AND e.pc_eventDate <= ?))',
        ];
        $bind = [$startDate, $endDate, $startDate, $endDate];
        if ($facilityId > 0) {
            $where[] = 'e.pc_facility = ?';
            $bind[] = $facilityId;
        }
        if ($providerId !== null && $providerId > 0) {
            $where[] = 'e.pc_aid = ?';
            $bind[] = $providerId;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS n,
                    COALESCE(BIT_XOR(CRC32(CONCAT_WS(\'|\',
                        e.pc_eid, e.pc_eventDate, e.pc_startTime, e.pc_endTime, e.pc_duration,
                        e.pc_aid, e.pc_apptstatus, e.pc_recurrtype, e.pc_recurrspec,
                        e.pc_endDate, COALESCE(e.pc_title, \'\')))), 0) AS sig
             FROM openemr_postcalendar_events AS e
             WHERE ' . implode(' AND ', $where),
            $bind
        ) ?: [];

        return 'v2:' . (int) ($row['n'] ?? 0) . ':' . (string) ($row['sig'] ?? '0');
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
