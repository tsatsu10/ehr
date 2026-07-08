<?php

/**
 * Session-auth JSON API for New Clinic desks
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Csrf\CsrfUtils;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\AdminActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\CashierActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ChartDepthActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\DoctorActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\LabActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\FrontDeskActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PatientActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\PharmacyActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ProfileActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ReportsActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\TriageActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\VisitActionHandler;
use OpenEMR\Modules\NewClinic\Exceptions\EncounterSessionMismatchException;
use OpenEMR\Modules\NewClinic\Exceptions\StaleVisitException;
use OpenEMR\Modules\NewClinic\Exceptions\AllergiesUndocumentedException;
use OpenEMR\Modules\NewClinic\Exceptions\ExternalRxIncompleteException;
use OpenEMR\Modules\NewClinic\Exceptions\UndispensedRxException;
use OpenEMR\Modules\NewClinic\Exceptions\UnsignedEncounterException;
use OpenEMR\Modules\NewClinic\Exceptions\VisitNotTakeableException;
use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\CommunicationsHubService;
use OpenEMR\Modules\NewClinic\Services\CommHubUserSettingsService;
use OpenEMR\Modules\NewClinic\Services\CohortSavedFilterService;
use OpenEMR\Modules\NewClinic\Services\PatientCohortSearchService;
use OpenEMR\Modules\NewClinic\Services\RegistryAuditService;
use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\BillOpsChargeCorrectionService;
use OpenEMR\Modules\NewClinic\Services\BillOpsDaysheetService;
use OpenEMR\Modules\NewClinic\Services\BillOpsOutstandingService;
use OpenEMR\Modules\NewClinic\Services\BillOpsPaymentsSearchService;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\LabOpsOrderMetaService;
use OpenEMR\Modules\NewClinic\Services\LabOpsResultService;
use OpenEMR\Modules\NewClinic\Services\LabOpsSetupService;
use OpenEMR\Modules\NewClinic\Services\LabOpsWorklistService;
use OpenEMR\Modules\NewClinic\Services\PharmDrugMetaService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsControlledRegisterService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDestroyService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseLabelService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsOtcSaleService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReceiveService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsSetupService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsRxPrintService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsReportsService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsWorklistService;
use OpenEMR\Modules\NewClinic\Services\PaymentHistoryService;
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocAccessService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocFormOpenService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocLbfWizardService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocReferralHospitalLbfWizardService;
use OpenEMR\Modules\NewClinic\Services\ClinicalDocVisitSummaryService;
use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use OpenEMR\Modules\NewClinic\Services\PatientRegistrationService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\QuickAddService;
use OpenEMR\Modules\NewClinic\Services\QueueSlipService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeSurfaceService;
use OpenEMR\Modules\NewClinic\Services\SchedulingAccessService;
use OpenEMR\Modules\NewClinic\Services\SchedulingCalendarService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardLaneMapService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardService;
use OpenEMR\Modules\NewClinic\Services\SchedulingFlowBoardPrefsService;
use OpenEMR\Modules\NewClinic\Services\SchedulingRecallsService;
use OpenEMR\Modules\NewClinic\Services\VisitBoardService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitClaimLostService;
use OpenEMR\Modules\NewClinic\Services\SimilarSurnameQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;

class AjaxController
{
    /** @var array<string, mixed>|null */
    private ?array $jsonBodyCache = null;
    /** @var array<string, object> */
    private array $services = [];

    /**
     * Lazy, memoized service accessor — avoids eager ctor construction (AUDIT-10a).
     *
     * @template T of object
     * @param class-string<T> $class
     * @return T
     */
    public function svc(string $class): object
    {
        if (!isset($this->services[$class])) {
            $this->services[$class] = new $class();
        }

        return $this->services[$class];
    }

    public function handleRequest(): void
    {
        header('Content-Type: application/json');

        if (empty($_SESSION['authUserID'])) {
            $this->respond(false, 'Unauthorized', ['code' => 'unauthorized'], 401);
        }

        $action = $this->resolveRequestAction();
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $userId = (int) $_SESSION['authUserID'];

        if ($action === 'visit.transition') {
            $this->respond(
                false,
                'Use role-specific workflow actions (triage, doctor, cashier)',
                ['code' => 'deprecated'],
                410
            );
        }

        if ($action !== '' && !$this->svc(AjaxActionPolicy::class)->defersAuthorizationToHandler($action)) {
            $this->authorizeAction($action);
        }

        try {
            if ($this->dispatchToActionHandler($action, $method, $userId)) {
                return;
            }

            switch ($action) {
                case 'health':
                    $this->respond(true, 'ok', ['module' => 'oe-module-new-clinic']);
                    break;
                case 'queue_bridge.list':
                    $facilityId = $this->resolveRequestFacilityId();
                    $lens = (string) ($_REQUEST['lens'] ?? 'action');
                    $page = max(1, (int) ($_REQUEST['page'] ?? 1));
                    $this->respond(true, 'ok', $this->svc(QueueBridgeService::class)->listExceptions($facilityId, $lens, $page));
                    break;
                case 'queue_bridge.eod_export':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
                        $export = $this->svc(QueueBridgeService::class)->exportEodCsv($facilityId);
                        $this->respondCsv($export['filename'], $export['content']);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
                    }
                    break;
                case 'queue_bridge.resolve':
                case 'queue_bridge.link_appointment':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    $resolveAction = $action === 'queue_bridge.link_appointment'
                        ? 'link_appointment'
                        : (string) ($body['action'] ?? '');
                    try {
                        $result = $this->svc(QueueBridgeService::class)->resolve(
                            (string) ($body['exception_code'] ?? ''),
                            $resolveAction,
                            (int) ($body['pid'] ?? 0),
                            $facilityId,
                            $userId,
                            isset($body['pc_eid']) ? (int) $body['pc_eid'] : null,
                            isset($body['visit_id']) ? (int) $body['visit_id'] : null,
                            isset($body['appt_date']) ? (string) $body['appt_date'] : null,
                            isset($body['visit_type_id']) ? (int) $body['visit_type_id'] : null,
                            isset($body['cancel_reason']) ? (string) $body['cancel_reason'] : null,
                        );
                        $this->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.list':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $board = $this->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.poll':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $board = $this->svc(SchedulingFlowBoardService::class)->pollBoard(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['revision'] ?? ''),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.advance':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $this->svc(SchedulingFlowBoardService::class)->advanceStatus(
                            $facilityId,
                            (int) ($body['pc_eid'] ?? 0),
                            (string) ($body['status'] ?? ''),
                            $userId
                        );
                        $board = $this->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($body['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.room':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $this->svc(SchedulingFlowBoardService::class)->updateRoom(
                            $facilityId,
                            (int) ($body['pc_eid'] ?? 0),
                            (string) ($body['room'] ?? ''),
                            $userId
                        );
                        $board = $this->svc(SchedulingFlowBoardService::class)->getBoard(
                            $facilityId,
                            (string) ($body['date'] ?? date('Y-m-d')),
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $board);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.prefs':
                    try {
                        $prefs = $this->svc(SchedulingFlowBoardPrefsService::class)->getPrefs($userId);
                        $this->respond(true, 'ok', $prefs);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.prefs.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $collapsed = is_array($body['collapsed'] ?? null) ? $body['collapsed'] : [];
                        $order = is_array($body['order'] ?? null) ? $body['order'] : [];
                        $prefs = $this->svc(SchedulingFlowBoardPrefsService::class)->savePrefs($userId, $collapsed, $order);
                        $this->respond(true, 'ok', $prefs);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.lane_map':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $config = $this->svc(SchedulingFlowBoardLaneMapService::class)->getAdminConfig($facilityId);
                        $this->respond(true, 'ok', $config);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.flow_board.lane_map.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];
                        $config = $this->svc(SchedulingFlowBoardLaneMapService::class)->saveAdminConfig($facilityId, $rows);
                        $this->respond(true, 'ok', $config);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.range':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $view = (string) ($_REQUEST['view'] ?? 'day');
                        $range = $this->svc(SchedulingCalendarService::class)->getRangeView(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $view,
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                        );
                        $this->respond(true, 'ok', $range);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.poll':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $view = (string) ($_REQUEST['view'] ?? 'day');
                        $range = $this->svc(SchedulingCalendarService::class)->pollRangeView(
                            $facilityId,
                            (string) ($_REQUEST['date'] ?? date('Y-m-d')),
                            $view,
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['revision'] ?? ''),
                        );
                        $this->respond(true, 'ok', $range);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.move':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $payload = $this->svc(SchedulingCalendarService::class)->moveAppointment($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.resize':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $payload = $this->svc(SchedulingCalendarService::class)->resizeAppointment($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.calendar.book':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $day = $this->svc(SchedulingCalendarService::class)->bookAppointment($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $day);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.list':
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null),
                            (string) ($_REQUEST['bucket'] ?? 'due'),
                            $this->parseOptionalPositiveInt($_REQUEST['pid'] ?? null),
                            trim((string) ($_REQUEST['q'] ?? '')),
                        );
                        $this->respond(true, 'ok', $worklist);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->saveRecall($facilityId, $body, $userId);
                        $this->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.delete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $this->svc(SchedulingRecallsService::class)->deleteRecall((int) ($body['recall_id'] ?? 0), $userId);
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                        );
                        $this->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.update_status':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $result = $this->svc(SchedulingRecallsService::class)->updateStatus(
                            (int) ($body['recall_id'] ?? 0),
                            (string) ($body['status'] ?? ''),
                            isset($body['note']) ? (string) $body['note'] : null,
                            $userId,
                        );
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                        );
                        $this->respond(true, 'ok', ['status' => $result, 'worklist' => $worklist]);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.snooze':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $this->svc(SchedulingRecallsService::class)->snoozeRecall(
                            (int) ($body['recall_id'] ?? 0),
                            (int) ($body['days'] ?? 7),
                            $userId,
                            isset($body['note']) ? (string) $body['note'] : '',
                        );
                        $facilityId = $this->resolveRequestFacilityId();
                        $worklist = $this->svc(SchedulingRecallsService::class)->getWorklist(
                            $facilityId,
                            $this->parseOptionalPositiveInt($body['provider_id'] ?? null),
                            (string) ($body['bucket'] ?? 'due'),
                            $this->parseOptionalPositiveInt($body['pid'] ?? null),
                        );
                        $this->respond(true, 'ok', $worklist);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'scheduling.recalls.send_reminder':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $result = $this->svc(SchedulingRecallsService::class)->sendRecallReminder(
                            (int) ($body['recall_id'] ?? 0),
                            $userId,
                        );
                        $this->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'queue_bridge.dismiss':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $facilityId = $this->resolveRequestFacilityId();
                    try {
                        $result = $this->svc(QueueBridgeService::class)->dismiss(
                            (string) ($body['exception_code'] ?? ''),
                            (int) ($body['pid'] ?? 0),
                            $facilityId,
                            $userId,
                            (string) ($body['reason'] ?? ''),
                            isset($body['pc_eid']) ? (int) $body['pc_eid'] : null,
                            isset($body['visit_id']) ? (int) $body['visit_id'] : null,
                        );
                        $this->respond(true, 'ok', $result);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                    }
                    break;
                case 'clinical_doc.visit_summary':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                    if ($lens === '') {
                        $lens = null;
                    }
                    try {
                        $summary = $this->svc(ClinicalDocVisitSummaryService::class)->getVisitSummary($visitId, $userId, $lens);
                        $this->respond(true, 'ok', $summary);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 400);
                        $this->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                    }
                    break;
                case 'clinical_doc.catalog':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $facilityId = $this->resolveRequestFacilityId();
                    $lens = isset($_REQUEST['lens']) ? (string) $_REQUEST['lens'] : null;
                    if ($lens === '') {
                        $lens = null;
                    }
                    $this->respond(true, 'ok', $this->svc(ClinicalDocCatalogService::class)->getCatalog($lens, $facilityId));
                    break;
                case 'clinical_doc.sign_status':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    try {
                        $status = $this->svc(ClinicalDocVisitSummaryService::class)->getSignStatus($visitId);
                        $this->respond(true, 'ok', $status);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 400);
                        $this->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                    }
                    break;
                case 'clinical_doc.open_form':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $result = $this->svc(ClinicalDocFormOpenService::class)->openForm($body, $userId);
                        $this->respond(true, 'ok', $result);
                    } catch (EncounterSessionMismatchException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'session_mismatch'], 409);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.get':
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($visitId <= 0) {
                        $this->respond(false, 'visit_id required', [], 400);
                    }
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->get($visitId, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->save($body, $userId);
                        $this->respond(true, 'Saved', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.prefill':
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($visitId <= 0) {
                        $this->respond(false, 'visit_id required', [], 400);
                    }
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->prefill($visitId, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.validate':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->validate($body, $userId);
                        $this->respond(true, 'ok', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.sign':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->sign($body, $userId);
                        $this->respond(true, 'Signed', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'encounter_note.unlock':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $payload = $this->svc(EncounterNoteService::class)->unlockForClinicalCorrection($body, $userId);
                        $this->respond(true, 'Unlocked', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 403);
                        $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], $code);
                    }
                    break;
                case 'clinical_doc.favorites':
                    $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($visitId <= 0) {
                        $this->respond(false, 'visit_id required', [], 400);
                    }
                    try {
                        $favorites = $this->svc(ClinicalDocVisitSummaryService::class)->getFavorites($visitId, $userId);
                        $this->respond(true, 'ok', $favorites);
                    } catch (\RuntimeException $e) {
                        $code = (int) ($e->getCode() ?: 400);
                        $this->respond(false, $e->getMessage(), ['code' => $code === 409 ? 'no_encounter_on_visit' : 'error'], $code);
                    }
                    break;
                case 'clinical_doc.import_ghana_pack':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $setAsConsultNote = !empty($body['set_as_consult_note']);
                    $payload = $this->svc(ClinicAdminService::class)->importGhanaOpdLbfPack(
                        $scope,
                        $userId,
                        $setAsConsultNote,
                        $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Ghana OPD LBF pack imported', $payload);
                    break;
                case 'clinical_doc.import_referral_hospital_pack':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $setAsConsultNote = !empty($body['set_as_consult_note']);
                    $payload = $this->svc(ClinicAdminService::class)->importReferralHospitalLbfPack(
                        $scope,
                        $userId,
                        $setAsConsultNote,
                        $requestedFacilityId > 0 ? $requestedFacilityId : null
                    );
                    $this->respond(true, 'Referral hospital LBF pack imported', $payload);
                    break;
                case 'clinical_doc.import_ancillary_pack':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $this->requireSuperAdmin();
                    $scope = strtolower(trim((string) ($body['scope'] ?? 'facility')));
                    if ($scope !== 'global') {
                        $scope = 'facility';
                    }
                    $packKey = strtolower(trim((string) ($body['pack_key'] ?? '')));
                    if ($packKey === '') {
                        $this->respond(false, 'pack_key required', [], 400);
                    }
                    $requestedFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    try {
                        $payload = $this->svc(ClinicAdminService::class)->importAncillaryLbfPack(
                            $scope,
                            $userId,
                            $packKey,
                            $requestedFacilityId > 0 ? $requestedFacilityId : null
                        );
                        $this->respond(true, 'Ancillary LBF pack imported', $payload);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'invalid_pack'], 400);
                    }
                    break;
                case 'queue.counts':
                    $facilityId = $this->resolveRequestFacilityId();
                    $counts = $this->svc(VisitQueueService::class)->getCounts($facilityId);
                    $this->respond(true, 'ok', [
                        'counts' => $counts,
                        'last_updated' => date('c'),
                    ]);
                    break;
                case 'communications.hub_counts':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $counts = $this->svc(CommunicationsHubService::class)->hubCounts($authUser, $userId);
                    $this->respond(true, 'ok', $counts);
                    break;
                case 'communications.messages_list':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $list = $this->svc(CommunicationsHubService::class)->listMessages($authUser, [
                        'activity' => $_REQUEST['activity'] ?? '1',
                        'show_all' => $_REQUEST['show_all'] ?? '',
                        'sortby' => $_REQUEST['sortby'] ?? 'pnotes.date',
                        'sortorder' => $_REQUEST['sortorder'] ?? 'desc',
                        'begin' => $_REQUEST['begin'] ?? 0,
                        'limit' => $_REQUEST['limit'] ?? 25,
                        'q' => $_REQUEST['q'] ?? '',
                    ]);
                    $this->respond(true, 'ok', $list);
                    break;
                case 'communications.message_detail':
                    $noteId = (int) ($_REQUEST['id'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $detail = $this->svc(CommunicationsHubService::class)->getMessageDetail($noteId, $authUser);
                    $this->respond(true, 'ok', $detail);
                    break;
                case 'communications.reminders_list':
                    $days = (int) ($_REQUEST['days'] ?? 30);
                    $list = $this->svc(CommunicationsHubService::class)->listReminders($userId, $days);
                    $this->respond(true, 'ok', $list);
                    break;
                case 'communications.message_done':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $this->svc(CommunicationsHubService::class)->markMessageDone($noteId, $authUser);
                    $this->respond(true, 'ok', ['id' => $noteId]);
                    break;
                case 'communications.message_status':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $messageStatus = trim((string) ($body['message_status'] ?? ''));
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $this->svc(CommunicationsHubService::class)->setMessageStatus($noteId, $messageStatus, $authUser);
                    $this->respond(true, 'ok', ['id' => $noteId, 'message_status' => $messageStatus]);
                    break;
                case 'communications.assign_patient':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $pid = (int) ($body['pid'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $result = $this->svc(CommunicationsHubService::class)->assignMessagePatient($noteId, $pid, $authUser);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.message_delete':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $this->svc(CommunicationsHubService::class)->deleteMessage($noteId, $authUser);
                    $this->respond(true, 'ok', ['id' => $noteId]);
                    break;
                case 'communications.reminder_done':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $reminderId = (int) ($body['dr_id'] ?? $body['id'] ?? 0);
                    $this->svc(CommunicationsHubService::class)->markReminderProcessed($reminderId, $userId);
                    $this->respond(true, 'ok', ['id' => $reminderId]);
                    break;
                case 'communications.compose_options':
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $replyNoteId = (int) ($_REQUEST['reply_note_id'] ?? 0);
                    $options = $this->svc(CommunicationsHubService::class)->getComposeOptions(
                        $replyNoteId > 0 ? $replyNoteId : null,
                        $authUser
                    );
                    $this->respond(true, 'ok', $options);
                    break;
                case 'communications.message_send':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $authUser = (string) ($_SESSION['authUser'] ?? '');
                    $result = $this->svc(CommunicationsHubService::class)->sendMessage($body, $authUser, $userId);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.reminder_create_options':
                    $forwardReminderId = (int) ($_REQUEST['forward_reminder_id'] ?? 0);
                    $options = $this->svc(CommunicationsHubService::class)->getReminderCreateOptions(
                        $userId,
                        $forwardReminderId > 0 ? $forwardReminderId : null
                    );
                    $this->respond(true, 'ok', $options);
                    break;
                case 'communications.reminder_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(CommunicationsHubService::class)->createReminder($body, $userId);
                    $this->respond(true, 'ok', $result);
                    break;
                case 'communications.reminder_log':
                    $filters = [
                        'sent_by' => $_REQUEST['sent_by'] ?? null,
                        'sent_to' => $_REQUEST['sent_to'] ?? null,
                        'processed' => $_REQUEST['processed'] ?? null,
                        'date_from' => $_REQUEST['date_from'] ?? null,
                        'date_to' => $_REQUEST['date_to'] ?? null,
                    ];
                    $log = $this->svc(CommunicationsHubService::class)->listReminderLog($userId, $filters);
                    $this->respond(true, 'ok', $log);
                    break;
                case 'communications.save_preferences':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $canViewAll = AclMain::aclCheckCore('admin', 'super');
                    $prefs = $this->svc(CommHubUserSettingsService::class)->savePreferences($body, $canViewAll);
                    $this->respond(true, 'ok', $prefs);
                    break;
                case 'cohort.presets':
                    $this->svc(PatientCohortSearchService::class)->assertRegistryAccess();
                    $this->respond(true, 'ok', $this->svc(PatientCohortSearchService::class)->presets());
                    break;
                case 'cohort.search':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $result = $this->svc(PatientCohortSearchService::class)->search($body);
                    $this->svc(RegistryAuditService::class)->logSearch(
                        (string) ($result['meta']['filter_summary'] ?? ''),
                        (int) ($result['total'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $result);
                    break;
                case 'cohort.export':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    try {
                        $export = $this->svc(PatientCohortSearchService::class)->export($body);
                        $filters = is_array($body['filters'] ?? null) ? $body['filters'] : [];
                        $this->svc(RegistryAuditService::class)->logExport(
                            $this->svc(PatientCohortSearchService::class)->explainCriteria($filters),
                            (int) $export['row_count'],
                            $userId
                        );
                        $this->respondCsv($export['filename'], $export['content']);
                    } catch (\InvalidArgumentException $e) {
                        $this->respond(false, $e->getMessage(), ['code' => 'export_limit'], 400);
                    }
                    break;
                case 'cohort.saved_filter':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $operation = strtolower(trim((string) ($body['operation'] ?? 'save')));
                    if ($operation === 'delete') {
                        $this->svc(CohortSavedFilterService::class)->delete(
                            $userId,
                            (int) ($body['id'] ?? 0)
                        );
                        $this->respond(true, 'ok', ['deleted' => true]);
                        break;
                    }
                    $saved = $this->svc(CohortSavedFilterService::class)->save($userId, $body);
                    $this->respond(true, 'ok', $saved);
                    break;
                case 'lab_ops.worklist':
                    $body = $this->readRequestParams($method);
                    $worklist = $this->svc(LabOpsWorklistService::class)->worklist([
                        'tab' => $body['tab'] ?? LabOpsWorklistService::TAB_PENDING,
                        'date' => $body['date'] ?? '',
                        'facility_id' => $body['facility_id'] ?? 0,
                        'fulfillment' => $body['fulfillment'] ?? 'all',
                        'urgent_first' => $body['urgent_first'] ?? true,
                    ], $userId);
                    $this->respond(true, 'ok', $worklist);
                    break;
                case 'pharm_ops.worklist':
                    $body = $this->readRequestParams($method);
                    $pharmWorklist = $this->svc(PharmOpsWorklistService::class)->worklist([
                        'tab' => $body['tab'] ?? PharmOpsWorklistService::TAB_PENDING_DISPENSE,
                        'date' => $body['date'] ?? '',
                        'facility_id' => $body['facility_id'] ?? 0,
                        'filters' => is_array($body['filters'] ?? null) ? $body['filters'] : [],
                        'urgent_first' => $body['urgent_first'] ?? true,
                    ], $userId);
                    $this->respond(true, 'ok', $pharmWorklist);
                    break;
                case 'pharm_ops.dispense_get':
                    $body = $this->readRequestParams($method);
                    $prescriptionId = (int) ($body['prescription_id'] ?? $_REQUEST['prescription_id'] ?? 0);
                    $form = $this->svc(PharmOpsDispenseService::class)->getDispenseForm($prescriptionId);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'pharm_ops.dispense_confirm':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $confirmed = $this->svc(PharmOpsDispenseService::class)->confirmDispense(
                        (int) ($body['prescription_id'] ?? 0),
                        $body,
                        $userId
                    );
                    $this->respond(true, 'ok', $confirmed);
                    break;
                case 'pharm_ops.otc_drugs_search':
                    $body = $this->readRequestParams($method);
                    $drugSearch = $this->svc(PharmOpsOtcSaleService::class)->searchDrugs(
                        (string) ($body['q'] ?? $_REQUEST['q'] ?? ''),
                        (int) ($body['limit'] ?? 20)
                    );
                    $this->respond(true, 'ok', $drugSearch);
                    break;
                case 'pharm_ops.otc_sale_get':
                    $body = $this->readRequestParams($method);
                    $otcForm = $this->svc(PharmOpsOtcSaleService::class)->getSaleForm(
                        (int) ($body['pid'] ?? 0),
                        (int) ($body['drug_id'] ?? 0),
                        isset($body['encounter_id']) ? (int) $body['encounter_id'] : null
                    );
                    $this->respond(true, 'ok', $otcForm);
                    break;
                case 'pharm_ops.otc_sale_confirm':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $otcSale = $this->svc(PharmOpsOtcSaleService::class)->confirmSale($body, $userId);
                    $this->respond(true, 'ok', $otcSale);
                    break;
                case 'pharm_ops.receive_get':
                    $body = $this->readRequestParams($method);
                    $receiveForm = $this->svc(PharmOpsReceiveService::class)->getReceiveForm(
                        isset($body['drug_id']) ? (int) $body['drug_id'] : null
                    );
                    $this->respond(true, 'ok', $receiveForm);
                    break;
                case 'pharm_ops.receive_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $received = $this->svc(PharmOpsReceiveService::class)->saveReceive($body, $userId);
                    $this->respond(true, 'ok', $received);
                    break;
                case 'pharm_ops.setup_status':
                    $setupStatus = $this->svc(PharmOpsSetupService::class)->getSetupStatus();
                    $this->respond(true, 'ok', $setupStatus);
                    break;
                case 'pharm_ops.reports_embed':
                    $reportsEmbed = $this->svc(PharmOpsReportsService::class)->embedCatalog();
                    $this->respond(true, 'ok', $reportsEmbed);
                    break;
                case 'pharm_ops.controlled_catalog':
                    (new PharmOpsAccessService())->assertCatalogAccess();
                    $controlledCatalog = [
                        'drugs' => $this->svc(PharmDrugMetaService::class)->listActiveCatalogFlags(),
                    ];
                    $this->respond(true, 'ok', $controlledCatalog);
                    break;
                case 'pharm_ops.controlled_catalog_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    (new PharmOpsAccessService())->assertCatalogAccess();
                    $saved = $this->svc(PharmDrugMetaService::class)->saveControlledFlags($body['drugs'] ?? []);
                    $this->respond(true, 'ok', [
                        'saved' => $saved,
                        'drugs' => $this->svc(PharmDrugMetaService::class)->listActiveCatalogFlags(),
                    ]);
                    break;
                case 'pharm_ops.destroy_get':
                    $body = $this->readRequestParams($method);
                    $destroyForm = $this->svc(PharmOpsDestroyService::class)->getDestroyForm(
                        (int) ($body['drug_id'] ?? 0),
                        (int) ($body['inventory_id'] ?? 0)
                    );
                    $this->respond(true, 'ok', $destroyForm);
                    break;
                case 'pharm_ops.destroy_confirm':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $destroyed = $this->svc(PharmOpsDestroyService::class)->confirmDestroy($body, $userId);
                    $this->respond(true, 'ok', $destroyed);
                    break;
                case 'pharm_ops.rx_print_pdf':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $rxPrint = $this->svc(PharmOpsRxPrintService::class)->preparePrint(
                        (int) ($body['prescription_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $rxPrint);
                    break;
                case 'pharm_ops.dispense_label_pdf':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $labelPrint = $this->svc(PharmOpsDispenseLabelService::class)->preparePrint(
                        (int) ($body['sale_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $labelPrint);
                    break;
                case 'pharm_ops.warehouse_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $warehouse = $this->svc(PharmOpsSetupService::class)->createDefaultWarehouse(
                        (string) ($body['warehouse_title'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $warehouse);
                    break;
                case 'pharm_ops.formulary_import':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $imported = $this->svc(PharmOpsSetupService::class)->importStarterFormulary(
                        !empty($body['use_starter']) ? null : (string) ($body['csv'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $imported);
                    break;
                case 'lab_ops.result_get':
                    $orderId = (int) ($_REQUEST['procedure_order_id'] ?? 0);
                    if ($method === 'POST') {
                        $body = $this->readRequestParams($method);
                        $orderId = (int) ($body['procedure_order_id'] ?? $orderId);
                    }
                    $form = $this->svc(LabOpsResultService::class)->getEntryForm($orderId);
                    $this->respond(true, 'ok', $form);
                    break;
                case 'lab_ops.result_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $saved = $this->svc(LabOpsResultService::class)->saveEntry(
                        (int) ($body['procedure_order_id'] ?? 0),
                        $body,
                        $userId
                    );
                    $this->respond(true, 'ok', $saved);
                    break;
                case 'lab_ops.result_release':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $released = $this->svc(LabOpsResultService::class)->releaseReport(
                        (int) ($body['procedure_report_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $released);
                    break;
                case 'lab_ops.specimen_collect':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $collected = $this->svc(LabOpsOrderMetaService::class)->collectSpecimen(
                        (int) ($body['procedure_order_id'] ?? 0),
                        isset($body['accession_no']) ? (string) $body['accession_no'] : null,
                        $userId
                    );
                    $this->respond(true, 'ok', $collected);
                    break;
                case 'lab_ops.setup_status':
                    $status = $this->svc(LabOpsSetupService::class)->getSetupStatus();
                    $this->respond(true, 'ok', $status);
                    break;
                case 'lab_ops.setup_model':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $modelResult = $this->svc(LabOpsSetupService::class)->setSetupModel(
                        (string) ($body['setup_model'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $modelResult);
                    break;
                case 'lab_ops.provider_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $providerResult = $this->svc(LabOpsSetupService::class)->createInHouseProvider(
                        isset($body['clinic_name']) ? (string) $body['clinic_name'] : '',
                        $userId
                    );
                    $this->respond(true, 'ok', $providerResult);
                    break;
                case 'lab_ops.sendout_provider_create':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $sendOutResult = $this->svc(LabOpsSetupService::class)->createSendOutProvider(
                        (string) ($body['lab_name'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $sendOutResult);
                    break;
                case 'lab_ops.panel_import':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $providerId = $this->parseOptionalPositiveInt($body['provider_id'] ?? null);
                    if (!empty($body['use_starter'])) {
                        $importResult = $this->svc(LabOpsSetupService::class)->importStarterPanel(
                            $providerId > 0 ? $providerId : null,
                            $userId
                        );
                    } else {
                        $importResult = $this->svc(LabOpsSetupService::class)->importPanelCsv(
                            $providerId > 0 ? $providerId : null,
                            (string) ($body['csv'] ?? ''),
                            $userId
                        );
                    }
                    $this->respond(true, 'ok', $importResult);
                    break;
                case 'lab_ops.fee_map_list':
                    $providerId = $this->parseOptionalPositiveInt($_REQUEST['provider_id'] ?? null);
                    $unmapped = $this->svc(LabOpsSetupService::class)->listUnmappedFees(
                        $providerId > 0 ? $providerId : null
                    );
                    $this->respond(true, 'ok', ['rows' => $unmapped]);
                    break;
                case 'lab_ops.fee_map_save':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    if (!empty($body['use_starter_defaults'])) {
                        $providerId = $this->parseOptionalPositiveInt($body['provider_id'] ?? null);
                        $feeResult = $this->svc(LabOpsSetupService::class)->applyStarterFeeDefaults(
                            $providerId > 0 ? $providerId : null,
                            $userId
                        );
                    } else {
                        $rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];
                        $feeResult = $this->svc(LabOpsSetupService::class)->saveFeeMappings($rows, $userId);
                    }
                    $this->respond(true, 'ok', $feeResult);
                    break;
                case 'lab_ops.mark_send_out':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $sendOut = $this->svc(LabOpsOrderMetaService::class)->markAsSendOut(
                        (int) ($body['procedure_order_id'] ?? 0),
                        $userId
                    );
                    $this->respond(true, 'ok', $sendOut);
                    break;
                case 'bill_ops.visit_charges':
                    $visitId = (int) ($_REQUEST['visit_id'] ?? 0);
                    if ($method === 'POST') {
                        $body = $this->readRequestParams($method);
                        $visitId = (int) ($body['visit_id'] ?? $visitId);
                    }
                    $charges = $this->svc(BillOpsChargeCorrectionService::class)->getVisitCharges($visitId, $userId);
                    $this->respond(true, 'ok', $charges);
                    break;
                case 'bill_ops.charge_correct':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $corrected = $this->svc(BillOpsChargeCorrectionService::class)->applyCorrection(
                        (int) ($body['visit_id'] ?? 0),
                        is_array($body['add'] ?? null) ? $body['add'] : [],
                        is_array($body['remove'] ?? null) ? array_map('intval', $body['remove']) : [],
                        (string) ($body['reason'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $corrected);
                    break;
                case 'bill_ops.payments_search':
                    $params = $this->readRequestParams($method);
                    $search = $this->svc(BillOpsPaymentsSearchService::class)->search(
                        (string) ($params['q'] ?? ''),
                        isset($params['date_from']) ? (string) $params['date_from'] : null,
                        isset($params['date_to']) ? (string) $params['date_to'] : null,
                        (int) ($params['offset'] ?? 0),
                        (int) ($params['limit'] ?? BillOpsPaymentsSearchService::PAGE_SIZE)
                    );
                    $this->respond(true, 'ok', $search);
                    break;
                case 'bill_ops.payment_reverse':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $reversed = $this->svc(BillOpsPaymentsSearchService::class)->reverse(
                        (int) ($body['payment_id'] ?? $body['receipt_id'] ?? 0),
                        (string) ($body['reason'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $reversed);
                    break;
                case 'bill_ops.receipt_reprint':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $pid = (int) ($body['pid'] ?? 0);
                    $receiptId = (int) ($body['receipt_id'] ?? 0);
                    $payload = $this->svc(PaymentHistoryService::class)->getReceiptReprintForBillOps($receiptId, $pid, $userId);
                    $this->respond(true, 'ok', $payload);
                    break;
                case 'bill_ops.daysheet':
                    $params = $this->readRequestParams($method);
                    $daysheet = $this->svc(BillOpsDaysheetService::class)->getDaysheet(
                        (int) ($params['facility_id'] ?? 0),
                        (string) ($params['date'] ?? '')
                    );
                    $this->respond(true, 'ok', $daysheet);
                    break;
                case 'bill_ops.daysheet_export':
                    if ($method !== 'POST') {
                        $this->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->readJsonBody();
                    $this->verifyCsrf($body);
                    $exported = $this->svc(BillOpsDaysheetService::class)->recordExport(
                        (int) ($body['facility_id'] ?? 0),
                        (string) ($body['date'] ?? ''),
                        $userId
                    );
                    $this->respond(true, 'ok', $exported);
                    break;
                case 'bill_ops.outstanding_list':
                    $params = $this->readRequestParams($method);
                    $list = $this->svc(BillOpsOutstandingService::class)->listOutstanding(
                        isset($params['bucket']) ? (string) $params['bucket'] : null,
                        (int) ($params['offset'] ?? 0),
                        (int) ($params['limit'] ?? BillOpsOutstandingService::PAGE_SIZE)
                    );
                    $this->respond(true, 'ok', $list);
                    break;
                default:
                    $this->respond(false, 'Unknown action', [], 400);
            }
        } catch (StaleVisitException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'stale_visit'], 409);
        } catch (VisitNotTakeableException $e) {
            $this->respond(false, $e->getMessage(), array_merge(
                ['code' => 'visit_not_takeable'],
                $e->getContext()
            ), 409);
        } catch (UnsignedEncounterException $e) {
            $data = [
                'code' => 'encounter_unsigned',
                'reason' => $e->getReasonCode(),
            ];
            if ($e->getEncounterUrl() !== null) {
                $data['encounter_url'] = $e->getEncounterUrl();
            }
            $this->respond(false, $e->getMessage(), $data, 409);
        } catch (UndispensedRxException $e) {
            $this->respond(false, $e->getMessage(), [
                'code' => 'rx_undispensed',
                'undispensed_count' => $e->getUndispensedCount(),
            ], 409);
        } catch (AllergiesUndocumentedException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'allergies_undocumented'], 409);
        } catch (ExternalRxIncompleteException $e) {
            $this->respond(false, $e->getMessage(), [
                'code' => 'external_rx_incomplete',
                'missing' => $e->getMissing(),
                'field_errors' => $e->getFieldErrors(),
            ], 409);
        } catch (EncounterSessionMismatchException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'session_mismatch'], 409);
        } catch (\InvalidArgumentException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'validation'], 400);
        } catch (\RuntimeException $e) {
            $code = match ($e->getCode()) {
                404 => 404,
                403 => 403,
                429 => 429,
                default => 500,
            };
            $errorCode = match ($code) {
                404 => 'not_found',
                403 => 'forbidden',
                429 => 'rate_limited',
                default => 'server_error',
            };
            $this->respond(false, $e->getMessage(), ['code' => $errorCode], $code);
        } catch (\Throwable $e) {
            error_log('New Clinic AJAX error: ' . $e->getMessage());
            $data = ['code' => 'server_error'];
            if (!empty($GLOBALS['debug'])) {
                $data['detail'] = $e->getMessage();
            }
            $this->respond(false, 'Server error', $data, 500);
        }
    }

    private function dispatchToActionHandler(string $action, string $method, int $userId): bool
    {
        foreach ($this->ajaxActionHandlers() as $handler) {
            if ($handler->supports($action)) {
                $handler->handle($action, $method, $userId);
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<AjaxActionHandlerInterface>
     */
    private function ajaxActionHandlers(): array
    {
        return [
            new VisitActionHandler($this),
            new TriageActionHandler($this),
            new DoctorActionHandler($this),
            new CashierActionHandler($this),
            new LabActionHandler($this),
            new PharmacyActionHandler($this),
            new FrontDeskActionHandler($this),
            new PatientActionHandler($this),
            new ChartDepthActionHandler($this),
            new AdminActionHandler($this),
            new ProfileActionHandler($this),
            new ReportsActionHandler($this),
        ];
    }

    public function esignOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['esign_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    public function undispensedOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['undispensed_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    public function externalRxOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['external_rx_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    public function rxAllergyOverrideReason(array $body): ?string
    {
        $reason = trim((string) ($body['rx_undocumented_allergy_override_reason'] ?? ''));

        return $reason !== '' ? $reason : null;
    }

    private function authorizeAction(string $action): void
    {
        if ($this->svc(AjaxActionPolicy::class)->isDeprecated($action)) {
            $this->respond(
                false,
                'Use role-specific workflow actions (triage, doctor, cashier)',
                ['code' => 'deprecated'],
                410
            );
        }

        $desc = $this->svc(AjaxActionPolicy::class)->describe($action);
        match ($desc['type']) {
            'single_acl' => $this->requireAcl($desc['acl']),
            'any_acl' => $this->requireAnyAcl($desc['acls']),
            'desk_acl' => $this->requireClinicDeskAcl(),
            'core_notes_acl' => $this->requireCoreNotesAcl(),
            'cohort_acl' => $this->requireCohortAcl(),
            'cohort_export_acl' => $this->requireCohortExportAcl(),
            'lab_ops_read_acl' => $this->requireLabOpsReadAcl(),
            'lab_ops_enter_acl' => $this->requireLabOpsEnterAcl(),
            'lab_ops_release_acl' => $this->requireLabOpsReleaseAcl(),
            'lab_ops_catalog_acl' => $this->requireLabOpsEnterAcl(),
            'pharm_ops_read_acl' => $this->requirePharmOpsReadAcl(),
            'pharm_ops_dispense_acl' => $this->requirePharmOpsDispenseAcl(),
            'pharm_ops_receive_acl' => $this->requirePharmOpsReceiveAcl(),
            'pharm_ops_destroy_acl' => $this->requirePharmOpsDestroyAcl(),
            'pharm_ops_rx_print_acl' => $this->requirePharmOpsRxPrintAcl(),
            'pharm_ops_dispense_label_acl' => $this->requirePharmOpsDispenseLabelAcl(),
            'pharm_ops_catalog_acl' => $this->requirePharmOpsCatalogAcl(),
            'bill_ops_correct_acl' => $this->requireBillOpsCorrectAcl(),
            'bill_ops_payment_acl' => $this->requireBillOpsPaymentAcl(),
            'bill_ops_close_acl' => $this->requireBillOpsCloseAcl(),
            'bill_ops_outstanding_acl' => $this->requireBillOpsOutstandingAcl(),
            'report_hub_read_acl' => $this->requireReportHubReadAcl(),
            'report_hub_export_acl' => $this->requireReportHubExportAcl(),
            'queue_bridge_read_acl' => $this->requireQueueBridgeReadAcl(),
            'queue_bridge_resolve_acl' => $this->requireQueueBridgeResolveAcl(),
            'queue_bridge_dismiss_acl' => $this->requireQueueBridgeDismissAcl(),
            'scheduling_read_acl' => $this->requireSchedulingReadAcl(),
            'scheduling_write_acl' => $this->requireSchedulingWriteAcl(),
            'clinical_doc_read_acl' => $this->requireClinicalDocReadAcl(),
            'clinical_doc_write_acl' => $this->requireClinicalDocWriteAcl(),
            'encounter_note_acl' => $this->requireEncounterNoteAcl(),
            'deprecated' => $this->respond(
                false,
                'Use role-specific workflow actions (triage, doctor, cashier)',
                ['code' => 'deprecated'],
                410
            ),
            default => $this->respond(false, 'Unknown action', [], 400),
        };
    }

    private function requireAnyAcl(array $acos): void
    {
        foreach ($acos as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return;
            }
        }

        $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
    }

    private function requireClinicDeskAcl(): void
    {
        $acos = [
            'new_reception', 'new_nurse', 'new_doctor', 'new_lab',
            'new_pharmacy', 'new_cashier', 'new_admin', 'reports',
        ];
        foreach ($acos as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return;
            }
        }

        $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
    }

    private function requireCoreNotesAcl(): void
    {
        if (!AclMain::aclCheckCore('patients', 'notes')) {
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }
    }

    private function requireCohortAcl(): void
    {
        try {
            (new PatientCohortSearchService())->assertRegistryAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireCohortExportAcl(): void
    {
        try {
            (new PatientCohortSearchService())->assertExportAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireLabOpsReadAcl(): void
    {
        try {
            (new LabOpsAccessService())->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireLabOpsEnterAcl(): void
    {
        try {
            (new LabOpsAccessService())->assertEnterAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireLabOpsReleaseAcl(): void
    {
        try {
            (new LabOpsAccessService())->assertReleaseAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsReadAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsDispenseAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertDispenseAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsReceiveAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertReceiveAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsDestroyAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertDestroyAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsRxPrintAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertRxPrintAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsDispenseLabelAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertDispenseLabelAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requirePharmOpsCatalogAcl(): void
    {
        try {
            (new PharmOpsAccessService())->assertCatalogAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsCorrectAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertCorrectAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsPaymentAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertPaymentAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsCloseAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertCloseAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireBillOpsOutstandingAcl(): void
    {
        try {
            (new BillOpsAccessService())->assertOutstandingAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireReportHubReadAcl(): void
    {
        try {
            $this->svc(ReportHubAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    public function requireReportHubExportAcl(): void
    {
        try {
            $this->svc(ReportHubAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireQueueBridgeReadAcl(): void
    {
        try {
            $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireQueueBridgeResolveAcl(): void
    {
        try {
            $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
            if (!$this->svc(QueueBridgeAccessService::class)->canResolve()) {
                throw new \RuntimeException('Queue Bridge resolve permission denied', 403);
            }
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireQueueBridgeDismissAcl(): void
    {
        try {
            $this->svc(QueueBridgeAccessService::class)->assertHubAccess();
            if (!$this->svc(QueueBridgeAccessService::class)->canDismiss()) {
                throw new \RuntimeException('Queue Bridge dismiss permission denied', 403);
            }
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireSchedulingReadAcl(): void
    {
        try {
            $this->svc(SchedulingAccessService::class)->assertHubAccess($this->resolveRequestFacilityId());
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireSchedulingWriteAcl(): void
    {
        try {
            $this->svc(SchedulingAccessService::class)->assertHubAccess($this->resolveRequestFacilityId());
            if (!$this->svc(SchedulingAccessService::class)->canBookAppointment()) {
                throw new \RuntimeException('Appointment write permission denied', 403);
            }
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireClinicalDocReadAcl(): void
    {
        try {
            $this->svc(ClinicalDocAccessService::class)->assertHubAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireClinicalDocWriteAcl(): void
    {
        try {
            $this->svc(ClinicalDocAccessService::class)->assertWriteAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    private function requireEncounterNoteAcl(): void
    {
        try {
            $this->svc(ClinicalDocAccessService::class)->assertConsultNoteAccess();
        } catch (\RuntimeException $e) {
            $this->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
        }
    }

    public function requireSuperAdmin(): void
    {
        if (!AclMain::aclCheckCore('admin', 'super')) {
            $this->respond(false, 'Super admin access required', ['code' => 'forbidden'], 403);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function readRequestParams(string $method): array
    {
        if ($method === 'POST') {
            $body = $this->readJsonBody();
            $this->verifyCsrf($body);

            return $body;
        }

        return $_REQUEST;
    }

    public function authorizeDeferredHandler(string $action, int $pid = 0): void
    {
        foreach ($this->svc(AjaxActionPolicy::class)->deferredAuthorizationLayers($action) as $acls) {
            $this->authorizeAnyAclOrNotFound($acls, $pid);
        }
    }

    /**
     * @param array<int, string> $acls
     */
    private function authorizeAnyAclOrNotFound(array $acls, int $pid = 0): void
    {
        foreach ($acls as $aco) {
            if (AclMain::aclCheckCore('new_clinic', $aco)) {
                return;
            }
        }

        if ($pid > 0) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }

        $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
    }

    public function assertPatientChartPid(int $pid): void
    {
        if ($pid <= 0) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }

        try {
            $this->svc(FacilityScopeService::class)->assertPatientAccessible($pid);
        } catch (\RuntimeException) {
            $this->respond(false, 'Patient not found', ['code' => 'not_found'], 404);
        }
    }

    public function resolveRequestFacilityId(): int
    {
        $requested = (int) ($_REQUEST['facility_id'] ?? 0);
        $sessionFacility = !empty($_SESSION['facilityId']) ? (int) $_SESSION['facilityId'] : null;

        return $this->svc(VisitScopeService::class)->resolveQueueFacilityId(
            $requested > 0 ? $requested : $sessionFacility
        );
    }

    /**
     * Treat missing, blank, or JS "undefined"/"null" query values as absent optional ints.
     */
    private function parseOptionalPositiveInt(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '' || $trimmed === 'undefined' || $trimmed === 'null') {
                return null;
            }
        }

        if (!is_numeric($value)) {
            return null;
        }

        $parsed = (int) $value;

        return $parsed > 0 ? $parsed : null;
    }

    /**
     * @param array<string, mixed> $visit
     * @return array<string, mixed>
     */
    public function enrichStartVisitResponse(array $visit, int $userId): array
    {
        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $visitId = (int) ($visit['id'] ?? 0);
        $response = ['visit' => $visit];

        if ($visitId <= 0) {
            return $response;
        }

        $printEnabled = $this->svc(QueueSlipService::class)->isPrintEnabled($facilityId);
        $response['queue_slip_enabled'] = $printEnabled;
        if ($printEnabled) {
            $webroot = $GLOBALS['webroot'] ?? '';
            $response['queue_slip_url'] = $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/queue-slip.php?visit_id='
                . urlencode((string) $visitId)
                . '&print=1';
            $response['queue_slip'] = $this->svc(QueueSlipService::class)->buildPrintPayload($visitId, $userId);
        }

        return $response;
    }

    /**
     * Desk facility for writes: prefer explicit client facility_id, else request/session default.
     *
     * @param array<string, mixed> $body
     */
    public function resolveDeskFacilityFromBody(array $body): int
    {
        $fromBody = (int) ($body['facility_id'] ?? 0);
        if ($fromBody > 0) {
            return $this->svc(VisitScopeService::class)->resolveQueueFacilityId($fromBody);
        }

        return $this->resolveRequestFacilityId();
    }

    private function requireAcl(string $aco): void
    {
        if (!AclMain::aclCheckCore('new_clinic', $aco)) {
            $this->respond(false, 'Forbidden', ['code' => 'forbidden'], 403);
        }
    }

    public function verifyCsrf(array $body): void
    {
        $headerToken = trim((string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        $bodyToken = trim((string) (
            $body['csrf_token_form']
            ?? $body['csrf_token']
            ?? ''
        ));
        $postToken = trim((string) ($_POST['csrf_token_form'] ?? ($_POST['csrf_token'] ?? '')));

        $token = $bodyToken !== '' ? $bodyToken : ($headerToken !== '' ? $headerToken : $postToken);

        if (!CsrfUtils::verifyCsrfToken($token)) {
            $this->respond(false, 'Invalid CSRF token', ['code' => 'csrf'], 403);
        }
    }

    private function resolveRequestAction(): string
    {
        $action = trim((string) ($_REQUEST['action'] ?? ''));
        if ($action !== '') {
            return $this->svc(AjaxActionPolicy::class)->normalizeAction($action);
        }

        if (strcasecmp((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'), 'POST') === 0) {
            $fromBody = trim((string) ($this->readJsonBody()['action'] ?? ''));
            if ($fromBody !== '') {
                return $this->svc(AjaxActionPolicy::class)->normalizeAction($fromBody);
            }
        }

        return '';
    }

    public function readJsonBody(): array
    {
        if ($this->jsonBodyCache !== null) {
            return $this->jsonBodyCache;
        }

        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            $this->jsonBodyCache = $_POST;

            return $this->jsonBodyCache;
        }

        $decoded = json_decode($raw, true);
        $this->jsonBodyCache = is_array($decoded) ? $decoded : [];

        return $this->jsonBodyCache;
    }

    /**
     * @return list<array{visit_id: int, from_state: string}>
     */
    private function parseQueueWatchList(): array
    {
        $raw = $_REQUEST['queue_watch'] ?? '';
        if (!is_string($raw) || $raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $list = [];
        foreach ($decoded as $item) {
            if (!is_array($item)) {
                continue;
            }
            $visitId = (int) ($item['visit_id'] ?? 0);
            $fromState = trim((string) ($item['from_state'] ?? ''));
            if ($visitId > 0 && $fromState !== '') {
                $list[] = ['visit_id' => $visitId, 'from_state' => $fromState];
            }
        }

        return $list;
    }

    /**
     * @param array<string, mixed> $queuePayload
     *
     * @return array<string, mixed>
     */
    public function enrichQueuePayload(array $queuePayload, int $userId, int $facilityId): array
    {
        if (!empty($queuePayload['visits']) && is_array($queuePayload['visits'])) {
            $queuePayload['visits'] = $this->svc(SimilarSurnameQueueService::class)->annotateVisits(
                $queuePayload['visits'],
                $facilityId
            );
        }

        return $this->withClaimLostPoll($queuePayload, $userId);
    }

    /**
     * @param array<string, mixed> $queuePayload
     *
     * @return array<string, mixed>
     */
    private function withClaimLostPoll(array $queuePayload, int $userId): array
    {
        $watch = $this->parseQueueWatchList();
        if ($watch === []) {
            return $queuePayload;
        }

        return $this->svc(VisitClaimLostService::class)->enrichQueueResponse($queuePayload, $watch, $userId);
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function resolvePatientCreate(array $body, int $userId): array
    {
        $config = new ClinicConfigService();
        $mode = (string) ($config->get('registration_mode', 'desk_full_form') ?? 'desk_full_form');
        $section = (int) ($body['section'] ?? 1);
        $patient = is_array($body['patient'] ?? null) ? $body['patient'] : $body;

        if ($mode === 'desk_full_form' || isset($body['section']) || isset($body['patient'])) {
            $patient = array_merge($patient, [
                'dup_confirm' => $body['dup_confirm'] ?? null,
                'dup_override' => $body['dup_override'] ?? null,
                'dup_override_reason' => $body['dup_override_reason'] ?? null,
                'national_id' => trim((string) ($body['national_id'] ?? ($patient['national_id'] ?? ''))),
                'no_phone' => $body['no_phone'] ?? ($patient['no_phone'] ?? null),
            ]);

            return $this->svc(PatientRegistrationService::class)->saveSection($section, $patient, null, $userId);
        }

        return $this->svc(QuickAddService::class)->create($patient, $userId);
    }


    public function respond(bool $success, string $message, array $data = [], int $status = 200): void
    {
        http_response_code($status);
        echo json_encode([
            'success' => $success,
            'message' => $message,
            'data' => $data,
        ]);
        exit;
    }

    public function respondCsv(string $filename, string $content): void
    {
        http_response_code(200);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
        header('Cache-Control: no-store');
        echo $content;
        exit;
    }
}

