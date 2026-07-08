<?php

/**
 * front_desk.* and desk.shared_session_probe ajax actions (AUDIT-10f).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\AppointmentTodayService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\FrontDeskRecentPatientsService;
use OpenEMR\Modules\NewClinic\Services\FrontDeskStatsService;
use OpenEMR\Modules\NewClinic\Services\ReferralDocumentService;
use OpenEMR\Modules\NewClinic\Services\RevisitCompletionGateService;
use OpenEMR\Modules\NewClinic\Services\SharedDeviceSessionService;

final class FrontDeskActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'front_desk.desk_stats',
        'front_desk.flow_charts',
        'front_desk.todays_appointments',
        'front_desk.recently_viewed',
        'front_desk.recently_viewed.remember',
        'front_desk.recently_viewed.clear',
        'front_desk.upload_referral',
        'front_desk.revisit_awaiting_documents',
        'desk.shared_session_probe',
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
            case 'front_desk.desk_stats':
                $facilityId = $this->host->resolveRequestFacilityId();
                $stats = $this->host->svc(FrontDeskStatsService::class)->getDeskStats($userId, $facilityId);
                $this->host->respond(true, 'ok', $stats);
                break;
            case 'front_desk.flow_charts':
                $facilityId = $this->host->resolveRequestFacilityId();
                $charts = $this->host->svc(FrontDeskStatsService::class)->getFlowCharts($facilityId);
                $this->host->respond(true, 'ok', $charts);
                break;
            case 'front_desk.todays_appointments':
                $facilityId = $this->host->resolveRequestFacilityId();
                $limit = (int) ($_REQUEST['limit'] ?? 50);
                $appointments = $this->host->svc(AppointmentTodayService::class)->listTodayAppointments($facilityId, $limit);
                $this->host->respond(true, 'ok', ['appointments' => $appointments]);
                break;
            case 'front_desk.recently_viewed':
                $recent = $this->host->svc(FrontDeskRecentPatientsService::class)->listRecent();
                $this->host->respond(true, 'ok', ['recent' => $recent]);
                break;
            case 'front_desk.recently_viewed.remember':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $displayName = trim((string) ($body['display_name'] ?? ''));
                $pubpid = trim((string) ($body['pubpid'] ?? ''));
                try {
                    $recent = $this->host->svc(FrontDeskRecentPatientsService::class)->remember($pid, $displayName, $pubpid);
                } catch (\InvalidArgumentException $exception) {
                    $this->host->respond(false, $exception->getMessage(), [], 400);
                }
                $this->host->respond(true, 'ok', ['recent' => $recent]);
                break;
            case 'front_desk.recently_viewed.clear':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->host->svc(FrontDeskRecentPatientsService::class)->clear();
                $this->host->respond(true, 'ok', ['recent' => []]);
                break;
            case 'front_desk.upload_referral':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $this->host->verifyCsrf($_POST);
                if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
                    $this->host->respond(false, 'Referral file is required', ['code' => 'validation'], 400);
                }
                $pid = (int) ($_POST['pid'] ?? 0);
                if ($pid <= 0) {
                    $this->host->respond(false, 'Patient is required', ['code' => 'validation'], 400);
                }
                $this->host->svc(FacilityScopeService::class)->assertPatientAccessible($pid);
                $upload = $this->host->svc(ReferralDocumentService::class)->uploadForPatient(
                    $pid,
                    $_FILES['file'],
                    $userId
                );
                $this->host->respond(true, 'Referral uploaded', $upload);
                break;
            case 'front_desk.revisit_awaiting_documents':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                if ($pid <= 0) {
                    $this->host->respond(false, 'pid required', [], 400);
                }
                $this->host->assertPatientChartPid($pid);
                $this->host->svc(RevisitCompletionGateService::class)->logAwaitingDocuments(
                    $pid,
                    $userId,
                    isset($body['note']) ? (string) $body['note'] : null
                );
                $this->host->respond(true, 'Patient noted as awaiting documents');
                break;
            case 'desk.shared_session_probe':
                $probe = $this->host->svc(SharedDeviceSessionService::class)->probe(
                    (int) ($_REQUEST['visit_id'] ?? 0),
                    (string) ($_REQUEST['compare_mode'] ?? SharedDeviceSessionService::COMPARE_CLINICAL),
                    $userId
                );
                $this->host->respond(true, 'ok', $probe);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
