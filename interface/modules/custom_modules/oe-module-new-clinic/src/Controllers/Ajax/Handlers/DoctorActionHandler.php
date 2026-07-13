<?php

/**
 * doctor.* ajax actions (AUDIT-10d).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use ACL\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\ConsultShortcutService;
use OpenEMR\Modules\NewClinic\Services\DoctorRosterService;
use OpenEMR\Modules\NewClinic\Services\DoctorService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\LabPanelOrderService;
use OpenEMR\Modules\NewClinic\Services\PharmFormularyRxService;
use OpenEMR\Modules\NewClinic\Services\VisitRoutingService;

final class DoctorActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'doctor.queue',
        'doctor.roster',
        'doctor.roster.set_taking',
        'doctor.routing.reassign',
        'doctor.active',
        'doctor.take',
        'doctor.complete',
        'doctor.reopen',
        'doctor.set_supervisor',
        'doctor.search_providers',
        'doctor.shortcut_preflight',
        'doctor.restore_session',
        'doctor.lab_panel_catalog',
        'doctor.lab_panel_place',
        'doctor.formulary_rx_catalog',
        'doctor.formulary_rx_place',
        'doctor.start_walk_in',
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
            case 'doctor.queue':
                $facilityId = $this->host->resolveRequestFacilityId();
                $queue = $this->host->svc(DoctorService::class)->getDoctorQueue(
                    $facilityId,
                    $this->host->validDay($_REQUEST['visit_date'] ?? '', date('Y-m-d')),
                    $userId,
                    (string) ($_REQUEST['scope'] ?? 'me')
                );
                $queue = $this->host->enrichQueuePayload($queue, $userId, $facilityId);
                $this->host->respondQueue($queue); // SCALE-1.8 delta poll
                break;
            case 'doctor.roster':
                $facilityId = $this->host->resolveRequestFacilityId();
                $rosterService = new DoctorRosterService();
                if (!$rosterService->isEnabled($facilityId)) {
                    $this->host->respond(true, 'ok', [
                        'enabled' => false,
                        'doctors' => [],
                        'my_user_id' => $userId,
                    ]);
                    break;
                }
                $this->host->respond(true, 'ok', $rosterService->getRosterPayload(
                    $facilityId,
                    $userId,
                    isset($_REQUEST['visit_date']) ? $this->host->validDay($_REQUEST['visit_date']) : null
                ));
                break;
            case 'doctor.roster.set_taking':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $facilityId = $this->host->resolveRequestFacilityId();
                $targetUserId = (int) ($body['user_id'] ?? $userId);
                if ($targetUserId !== $userId && !AclMain::aclCheckCore('new_clinic', 'new_admin')) {
                    $this->host->respond(false, 'Forbidden', [], 403);
                }
                (new DoctorRosterService())->setTakingPatients(
                    $targetUserId,
                    $facilityId,
                    !empty($body['taking_patients'])
                );
                $this->host->respond(true, 'Roster updated');
                break;
            case 'doctor.routing.reassign':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $providerId = isset($body['provider_id']) ? (int) $body['provider_id'] : null;
                if (array_key_exists('provider_id', $body) && ($body['provider_id'] === null || $body['provider_id'] === '')) {
                    $providerId = null;
                }
                $visit = (new VisitRoutingService())->reassignSuggestion(
                    (int) ($body['visit_id'] ?? 0),
                    $providerId,
                    $userId,
                    isset($body['note']) ? (string) $body['note'] : null
                );
                $this->host->respond(true, 'Routing suggestion updated', [
                    'visit_id' => (int) ($visit['id'] ?? 0),
                    'routing_suggested_provider_id' => isset($visit['routing_suggested_provider_id'])
                        ? (int) $visit['routing_suggested_provider_id']
                        : null,
                ]);
                break;
            case 'doctor.active':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(DoctorService::class)->getActiveConsultPayload(
                    (int) ($body['visit_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'doctor.take':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(DoctorService::class)->takePatient(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    isset($body['override_reason']) ? (string) $body['override_reason'] : null
                );
                $this->host->respond(true, 'Patient taken', $payload);
                break;
            case 'doctor.start_walk_in':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(DoctorService::class)->startWalkIn(
                    (int) ($body['pid'] ?? 0),
                    (int) ($body['visit_type_id'] ?? 0),
                    $userId,
                    $this->host->resolveDeskFacilityFromBody($body),
                    isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null
                );
                $this->host->respond(true, 'Visit started with doctor', $payload);
                break;
            case 'doctor.complete':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(DoctorService::class)->completeConsult(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    !empty($body['needs_lab']),
                    !empty($body['needs_rx']),
                    isset($body['notes']) ? (string) $body['notes'] : null,
                    $this->host->esignOverrideReason($body)
                );
                $this->host->respond(true, 'Consult completed', $result);
                break;
            case 'doctor.reopen':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(DoctorService::class)->reopenConsult(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (string) ($body['reason'] ?? '')
                );
                $this->host->respond(true, 'Consult reopened', $result);
                break;
            case 'doctor.set_supervisor':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $encounterId = (int) ($body['encounter_id'] ?? 0);
                $supervisorId = isset($body['supervisor_id']) && $body['supervisor_id'] !== null
                    ? (int) $body['supervisor_id']
                    : null;
                $result = $this->host->svc(DoctorService::class)->setSupervisor($encounterId, $supervisorId, $userId);
                $this->host->respond(true, 'Supervisor updated', $result);
                break;
            case 'doctor.search_providers':
                if ($method !== 'GET') {
                    $this->host->respond(false, 'GET required', [], 405);
                }
                $query = (string) ($_REQUEST['q'] ?? '');
                $facilityId = $this->host->resolveRequestFacilityId();
                $results = $this->host->svc(DoctorService::class)->searchProviders($query, $facilityId, $userId);
                $this->host->respond(true, 'ok', ['providers' => $results]);
                break;
            case 'doctor.shortcut_preflight':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $preflight = $this->host->svc(ConsultShortcutService::class)->preflight(
                    (int) ($body['visit_id'] ?? 0),
                    (string) ($body['shortcut'] ?? ''),
                    $userId,
                    $this->host->rxAllergyOverrideReason($body),
                );
                $this->host->respond(true, 'ok', $preflight);
                break;
            case 'doctor.restore_session':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $session = $this->host->svc(EncounterSessionService::class)->bindForVisitWithDeskAcl(
                    (int) ($body['visit_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'Session restored', ['session' => $session->toArray()]);
                break;
            case 'doctor.lab_panel_catalog':
                if ($method !== 'GET') {
                    $this->host->respond(false, 'GET required', [], 405);
                }
                $facilityId = $this->host->resolveRequestFacilityId();
                $catalog = $this->host->svc(LabPanelOrderService::class)->getCatalogPayload($facilityId);
                $this->host->respond(true, 'ok', $catalog);
                break;
            case 'doctor.lab_panel_place':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(LabPanelOrderService::class)->placeOrder(
                    (int) ($body['visit_id'] ?? 0),
                    (array) ($body['procedure_type_ids'] ?? []),
                    $userId
                );
                $this->host->respond(true, 'Lab order placed', $result);
                break;
            case 'doctor.formulary_rx_catalog':
                if ($method !== 'GET') {
                    $this->host->respond(false, 'GET required', [], 405);
                }
                $facilityId = $this->host->resolveRequestFacilityId();
                $formularyCatalog = $this->host->svc(PharmFormularyRxService::class)->getCatalogPayload($facilityId);
                $this->host->respond(true, 'ok', $formularyCatalog);
                break;
            case 'doctor.formulary_rx_place':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $rxResult = $this->host->svc(PharmFormularyRxService::class)->placePrescriptions(
                    (int) ($body['visit_id'] ?? 0),
                    (array) ($body['drug_ids'] ?? []),
                    $userId
                );
                $this->host->respond(true, 'Prescriptions added', $rxResult);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
