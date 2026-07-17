<?php

/**
 * chat.* ajax actions — patient chart Chat tab (staff-facing UI, no delivery
 * provider wired up yet). ACL is enforced in AjaxController::authorizeAction
 * via the shared chart-read policy (same seven clinic roles as the rest of
 * the patient chart); every action re-scopes to the patient via
 * assertPatientChartPid before touching ChatService.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\ChatService;

final class ChatActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'chat.list',
        'chat.send',
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
            case 'chat.list':
                $pid = (int) ($_REQUEST['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('chat.list', $pid);
                $this->host->assertPatientChartPid($pid);
                $this->host->respond(
                    true,
                    'ok',
                    $this->host->svc(ChatService::class)->list($pid)
                );
                break;

            case 'chat.send':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                // pid rides in the JSON body (not the query string) for this action,
                // so read + CSRF-verify the body before pid is available.
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $pid = (int) ($body['pid'] ?? 0);
                $this->host->authorizeDeferredHandler('chat.send', $pid);
                $this->host->assertPatientChartPid($pid);
                $message = $this->host->svc(ChatService::class)->send(
                    $pid,
                    (string) ($body['body'] ?? ''),
                    $userId
                );
                $this->host->respond(true, 'Message sent', $message);
                break;

            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
