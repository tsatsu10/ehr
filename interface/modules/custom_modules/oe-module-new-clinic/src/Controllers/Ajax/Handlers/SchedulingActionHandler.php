<?php

/**
 * scheduling.* ajax actions (AUDIT-10k).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\SchedulingCalendarService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardLaneMapService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardPrefsService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardService;
use OpenEMR\Modules\NewClinic\Services\SchedulingRecallsService;

final class SchedulingActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'scheduling.flow_board.list',
        'scheduling.flow_board.poll',
        'scheduling.flow_board.advance',
        'scheduling.flow_board.room',
        'scheduling.flow_board.prefs',
        'scheduling.flow_board.prefs.save',
        'scheduling.flow_board.lane_map',
        'scheduling.flow_board.lane_map.save',
        'scheduling.calendar.range',
        'scheduling.calendar.poll',
        'scheduling.calendar.move',
        'scheduling.calendar.resize',
        'scheduling.calendar.book',
        'scheduling.recalls.list',
        'scheduling.recalls.save',
        'scheduling.recalls.delete',
        'scheduling.recalls.update_status',
        'scheduling.recalls.snooze',
        'scheduling.recalls.send_reminder',
        'scheduling.recalls.flag_follow_up'
    ];

    public function __construct(
        private readonly AjaxController $host,
    ) {
    }

    public function supports(string $action): bool
    {
        return in_array($action, self::ACTIONS, true);
    }

    public function handle(string $action, string $method, int $userId): void
    {
        switch ($action) {
                case 'scheduling.flow_board.list':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    try {
                        $board = $this->host->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $this->host->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                        );
                        $this->host->respond(true, 'ok', $board);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.poll':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    try {
                        $board = $this->host->svc(SchedulingFlowBoardService::class)->pollBoard(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $this->host->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['revision'] ?? ''),
                        );
                        $this->host->respond(true, 'ok', $board);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.advance':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $this->host->svc(SchedulingFlowBoardService::class)->advanceStatus(
                            $facilityId,
                            (int) ($body['pc_eid'] ?? 0),
                            (string) ($body['status'] ?? ''),
                            $userId
                        );
                        $board = $this->host->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($body['date'] ?? date('Y-m-d')),
                            $this->host->parseOptionalPositiveInt($body['provider_id'] ?? null),
                        );
                        $this->host->respond(true, 'ok', $board);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.room':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $this->host->svc(SchedulingFlowBoardService::class)->updateRoom(
                            $facilityId,
                            (int) ($body['pc_eid'] ?? 0),
                            (string) ($body['room'] ?? ''),
                            $userId
                        );
                        $board = $this->host->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($body['date'] ?? date('Y-m-d')),
                            $this->host->parseOptionalPositiveInt($body['provider_id'] ?? null),
                        );
                        $this->host->respond(true, 'ok', $board);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.prefs':
                    try {
                        $prefs = $this->host->svc(SchedulingFlowBoardPrefsService::class)->getPrefs($userId);
                        $this->host->respond(true, 'ok', $prefs);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.prefs.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $collapsed = is_array($body['collapsed'] ?? null) ? $body['collapsed'] : [];
                        $order = is_array($body['order'] ?? null) ? $body['order'] : [];
                        $prefs = $this->host->svc(SchedulingFlowBoardPrefsService::class)->savePrefs($userId, $collapsed, $order);
                        $this->host->respond(true, 'ok', $prefs);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.lane_map':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    try {
                        $config = $this->host->svc(SchedulingFlowBoardLaneMapService::class)->getAdminConfig($facilityId);
                        $this->host->respond(true, 'ok', $config);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.lane_map.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $facilityId = $this->host->resolveRequestFacilityId();
                    try {
                        $rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];
                        $config = $this->host->svc(SchedulingFlowBoardLaneMapService::class)->saveAdminConfig($facilityId, $rows);
                        $this->host->respond(true, 'ok', $config);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.range':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    try {
                        $view = (string) ($_REQUEST['view'] ?? 'day');
                        $range = $this->host->svc(SchedulingCalendarService::class)->getRangeView(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $view,
                            $this->host->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                        );
                        $this->host->respond(true, 'ok', $range);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.poll':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    try {
                        $view = (string) ($_REQUEST['view'] ?? 'day');
                        $range = $this->host->svc(SchedulingCalendarService::class)->pollRangeView(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $view,
                            $this->host->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['revision'] ?? ''),
                        );
                        $this->host->respond(true, 'ok', $range);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.move':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $payload = $this->host->svc(SchedulingCalendarService::class)->moveAppointment($facilityId, $body, $userId);
                        $this->host->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.resize':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $payload = $this->host->svc(SchedulingCalendarService::class)->resizeAppointment($facilityId, $body, $userId);
                        $this->host->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.book':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $day = $this->host->svc(SchedulingCalendarService::class)->bookAppointment($facilityId, $body, $userId);
                        $this->host->respond(true, 'ok', $day);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.list':
                    $facilityId = $this->host->resolveRequestFacilityId();
                    try {
                        $worklist = $this->host->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->host->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['bucket'] ?? 'due'),
                            $this->host->parseOptionalPositiveInt($_REQUEST['pid'] ?? null),
                            trim((string) ($_REQUEST['q'] ?? '')),
                        );
                        $this->host->respond(true, 'ok', $worklist);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.save':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $worklist = $this->host->svc(SchedulingRecallsService::class)->saveRecall($facilityId, $body, $userId);
                        $this->host->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.delete':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $this->host->svc(SchedulingRecallsService::class)->deleteRecall((int) ($body['recall_id'] ?? 0), $userId);
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $worklist = $this->host->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->host->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                        );
                        $this->host->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.update_status':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $result = $this->host->svc(SchedulingRecallsService::class)->updateStatus(
                            (int) ($body['recall_id'] ?? 0),
                            (string) ($body['status'] ?? ''),
                            isset($body['note']) ? (string) $body['note'] : null,
                            $userId,
                        );
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $worklist = $this->host->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->host->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                        );
                        $this->host->respond(true, 'ok', ['status' => $result, 'worklist' => $worklist]);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.snooze':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $this->host->svc(SchedulingRecallsService::class)->snoozeRecall(
                            (int) ($body['recall_id'] ?? 0),
                            (int) ($body['days'] ?? 7),
                            $userId,
                            isset($body['note']) ? (string) $body['note'] : '',
                        );
                        $facilityId = $this->host->resolveRequestFacilityId();
                        $worklist = $this->host->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->host->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                            $this->host->parseOptionalPositiveInt($body['pid'] ?? null),
                        );
                        $this->host->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.send_reminder':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    try {
                        $result = $this->host->svc(SchedulingRecallsService::class)->sendRecallReminder(
                            (int) ($body['recall_id'] ?? 0),
                            $userId,
                        );
                        $this->host->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.flag_follow_up':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    // Confirm the target patient is accessible in the user's facility
                    // scope before writing a recall for them (same guard every
                    // chart-depth write uses); 404s otherwise.
                    $this->host->assertPatientChartPid($pid);
                    try {
                        $result = $this->host->svc(SchedulingRecallsService::class)->flagFollowUp(
                            $pid,
                            (string) ($body['due_date'] ?? ''),
                            (string) ($body['reason'] ?? ''),
                            $userId,
                        );
                        $this->host->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;

            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
