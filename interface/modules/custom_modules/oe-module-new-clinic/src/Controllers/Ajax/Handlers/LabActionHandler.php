<?php

/**
 * lab.* ajax actions (AUDIT-10e).
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
use OpenEMR\Modules\NewClinic\Services\LabService;
use OpenEMR\Modules\NewClinic\Services\LabShortcutService;

final class LabActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'lab.queue',
        'lab.select',
        'lab.take',
        'lab.complete',
        'lab.skip_to_payment',
        'lab.shortcut_preflight',
        'lab.restore_session',
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
            case 'lab.queue':
                $facilityId = $this->host->resolveRequestFacilityId();
                $queue = $this->host->svc(LabService::class)->getLabQueue(
                    $facilityId,
                    $_REQUEST['visit_date'] ?? date('Y-m-d'),
                    $userId
                );
                $queue = $this->host->enrichQueuePayload($queue, $userId, $facilityId);
                $this->host->respond(true, 'ok', $queue);
                break;
            case 'lab.select':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(LabService::class)->selectVisit(
                    (int) ($body['visit_id'] ?? 0),
                    $userId
                );
                $this->host->respond(true, 'ok', $payload);
                break;
            case 'lab.take':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $payload = $this->host->svc(LabService::class)->takePatient(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0)
                );
                $this->host->respond(true, 'Patient taken', $payload);
                break;
            case 'lab.complete':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(LabService::class)->completeLab(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    $this->host->esignOverrideReason($body)
                );
                $this->host->respond(true, 'Lab completed', $result);
                break;
            case 'lab.skip_to_payment':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(LabService::class)->skipToPayment(
                    (int) ($body['visit_id'] ?? 0),
                    $userId,
                    (int) ($body['row_version'] ?? 0),
                    (string) ($body['reason'] ?? '')
                );
                $this->host->respond(true, 'Skipped to payment', $result);
                break;
            case 'lab.shortcut_preflight':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $preflight = $this->host->svc(LabShortcutService::class)->preflight(
                    (int) ($body['visit_id'] ?? 0),
                    (string) ($body['shortcut'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'ok', $preflight);
                break;
            case 'lab.restore_session':
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
