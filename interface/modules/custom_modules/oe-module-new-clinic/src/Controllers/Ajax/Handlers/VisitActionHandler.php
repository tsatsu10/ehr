<?php

/**
 * visit.* ajax actions (AUDIT-10b).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\PatientContextService;
use OpenEMR\Modules\NewClinic\Services\SchedulingRecallsService;
use OpenEMR\Modules\NewClinic\Services\SimilarSurnameQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitBoardService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitTypeAdminService;

final class VisitActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'visit.types',
        'visit.board',
        'visit.detail',
        'visit.cancel',
        'visit.hard_assign',
        'visit.start',
        'visit.skip_triage',
        'visit.start_from_appointment',
        'visit.send_back_to_doctor',
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
            case 'visit.types':
                $facilityId = $this->host->resolveRequestFacilityId();
                $types = $this->host->svc(VisitTypeAdminService::class)->listForDesk($facilityId);
                $this->host->respond(true, 'ok', ['visit_types' => $types]);
                break;
            case 'visit.board':
                $facilityId = $this->host->resolveRequestFacilityId();
                $board = $this->host->svc(VisitBoardService::class)->getBoard(
                    $facilityId,
                    $_REQUEST['visit_date'] ?? date('Y-m-d')
                );
                $board = $this->host->svc(SimilarSurnameQueueService::class)->annotateBoard($board, $facilityId);
                $this->host->respond(true, 'ok', $board);
                break;
            case 'visit.detail':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visitId = (int) ($body['visit_id'] ?? 0);
                $visit = $this->host->svc(VisitBoardService::class)->getVisitDetail($visitId, $userId);
                $preview = $this->host->svc(PatientContextService::class)->previewPayload(
                    (int) ($visit['visit']['pid'] ?? 0),
                    $userId,
                    'visit_board'
                );
                $this->host->respond(true, 'ok', array_merge($visit, ['preview' => $preview]));
                break;
            case 'visit.cancel':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visit = $this->host->svc(VisitQueueService::class)->cancelVisit(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (string) ($body['reason'] ?? '')
                );
                $this->host->respond(true, 'Visit cancelled', ['visit' => $visit]);
                break;
            case 'visit.hard_assign':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $facilityId = $this->host->resolveDeskFacilityFromBody($body);
                $providerRaw = $body['hard_assigned_provider_id'] ?? null;
                $providerId = ($providerRaw === null || $providerRaw === '')
                    ? null
                    : (int) $providerRaw;
                if ($providerId !== null && $providerId <= 0) {
                    $providerId = null;
                }
                $visit = $this->host->svc(VisitQueueService::class)->hardAssignProvider(
                    (int) ($body['visit_id'] ?? 0),
                    $facilityId,
                    $providerId,
                    $userId,
                    (int) ($body['row_version'] ?? 0)
                );
                $this->host->respond(true, 'Doctor assignment updated', ['visit' => $visit]);
                break;
            case 'visit.start':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visit = $this->host->svc(VisitQueueService::class)->startVisit(
                    (int) ($body['pid'] ?? 0),
                    (int) ($body['visit_type_id'] ?? 0),
                    $userId,
                    $this->host->resolveDeskFacilityFromBody($body),
                    isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                    !empty($body['is_urgent']),
                    isset($body['revisit_override_reason'])
                        ? (string) $body['revisit_override_reason']
                        : null,
                    isset($body['referral_document_id'])
                        ? (int) $body['referral_document_id']
                        : null,
                );
                $this->host->respond(true, 'Visit started', $this->host->enrichStartVisitResponse($visit, $userId));
                break;
            case 'visit.skip_triage':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visit = $this->host->svc(VisitQueueService::class)->skipTriage(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    isset($body['reason']) ? (string) $body['reason'] : null
                );
                $this->host->respond(true, 'Skipped triage', ['visit' => $visit]);
                break;
            case 'visit.send_back_to_doctor':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visit = $this->host->svc(VisitQueueService::class)->sendBackToDoctor(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    isset($body['reason']) ? (string) $body['reason'] : null
                );
                $this->host->respond(true, 'Sent back to doctor', ['visit' => $visit]);
                break;
            case 'visit.start_from_appointment':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(VisitQueueService::class)->startVisitFromAppointment(
                    (int) ($body['pid'] ?? 0),
                    (int) ($body['pc_eid'] ?? 0),
                    (string) ($body['appt_date'] ?? ''),
                    $userId,
                    isset($body['visit_type_id']) ? (int) $body['visit_type_id'] : null,
                    $this->host->resolveRequestFacilityId(),
                    isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                    !empty($body['is_urgent']),
                    isset($body['revisit_override_reason'])
                        ? (string) $body['revisit_override_reason']
                        : null
                );
                $visit = (array) ($result['visit'] ?? []);
                $this->host->svc(SchedulingRecallsService::class)->completeLinkedRecallOnCheckIn(
                    (int) ($body['pc_eid'] ?? 0),
                    (int) ($body['pid'] ?? 0),
                    $userId,
                );
                $this->host->respond(
                    true,
                    'Visit started from appointment',
                    array_merge($result, $this->host->enrichStartVisitResponse($visit, $userId))
                );
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
