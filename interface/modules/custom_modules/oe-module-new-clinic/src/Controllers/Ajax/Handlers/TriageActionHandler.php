<?php

/**
 * triage.* ajax actions (AUDIT-10c).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\TriageService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;

final class TriageActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'triage.queue',
        'triage.select',
        'triage.start',
        'triage.save_vitals',
        'triage.send_doctor',
        'triage.auto_start',
        'triage.restore_session',
        'triage.set_urgent',
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
            case 'triage.queue':
                $facilityId = $this->host->resolveRequestFacilityId();
                $visitDate = $this->host->validDay($_REQUEST['visit_date'] ?? '');
                $queue = $this->host->svc(TriageService::class)->getTriageQueue(
                    $facilityId,
                    $visitDate !== '' ? $visitDate : null,
                    $userId
                );
                $queue = $this->host->enrichQueuePayload($queue, $userId, $facilityId);
                $this->host->respondQueue($queue); // SCALE-1.8 delta poll
                break;
            case 'triage.select':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(TriageService::class)->selectPatient(
                    (int) ($body['visit_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'triage.start':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visitId = (int) ($body['visit_id'] ?? 0);
                $visit = $this->host->svc(VisitQueueService::class)->startTriage(
                    $visitId,
                    $userId,
                    (int) ($body['row_version'] ?? 0)
                );
                $this->host->svc(EncounterSessionService::class)->bindForVisit($visitId, $userId);
                $this->host->respond(true, 'Triage started', ['visit' => $visit]);
                break;
            case 'triage.save_vitals':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(TriageService::class)->saveVitals(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    is_array($body['vitals'] ?? null) ? $body['vitals'] : [],
                    isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null
                );
                $this->host->respond(true, 'Vitals saved', $result);
                break;
            case 'triage.send_doctor':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $providerRaw = $body['hard_assigned_provider_id'] ?? null;
                $providerId = ($providerRaw === null || $providerRaw === '')
                    ? null
                    : (int) $providerRaw;
                if ($providerId !== null && $providerId <= 0) {
                    $providerId = null;
                }
                $visit = $this->host->svc(TriageService::class)->sendToDoctor(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                    $providerId
                );
                $this->host->respond(true, 'Sent to doctor', ['visit' => $visit]);
                break;
            case 'triage.auto_start':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visit = $this->host->svc(VisitQueueService::class)->startVisitAtTriage(
                    (int) ($body['pid'] ?? 0),
                    (int) ($body['visit_type_id'] ?? 0),
                    $userId,
                    $this->host->resolveDeskFacilityFromBody($body),
                    isset($body['chief_complaint']) ? (string) $body['chief_complaint'] : null,
                    !empty($body['is_urgent'])
                );
                $this->host->svc(EncounterSessionService::class)->bindForVisit((int) $visit['id'], $userId);
                $this->host->respond(true, 'Visit started at triage', ['visit' => $visit]);
                break;
            case 'triage.set_urgent':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $visit = $this->host->svc(VisitQueueService::class)->setUrgency(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    !empty($body['is_urgent']),
                    isset($body['reason']) ? (string) $body['reason'] : null
                );
                $this->host->respond(true, 'Urgency updated', ['visit' => $visit]);
                break;
            case 'triage.restore_session':
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
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
