<?php

/**
 * onotes.* ajax actions — Office Notes island (GAP-A / A1).
 *
 * Authorization (core encounters/notes) is enforced in AjaxController::authorizeAction
 * via the 'office_notes_acl' policy type before this handler runs; writes re-check CSRF.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\OfficeNotesService;

final class OfficeNotesActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'onotes.list',
        'onotes.save',
        'onotes.archive',
        'onotes.delete',
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
            case 'onotes.list':
                $filter = (string) ($_REQUEST['filter'] ?? 'active');
                $offset = (int) ($_REQUEST['offset'] ?? 0);
                $this->host->respond(
                    true,
                    'ok',
                    $this->host->svc(OfficeNotesService::class)->list($filter, $offset)
                );
                break;

            case 'onotes.save':
                $body = $this->requirePostBody($method);
                $id = (int) ($body['id'] ?? 0);
                $noteId = $this->host->svc(OfficeNotesService::class)->save($id, (string) ($body['body'] ?? ''));
                $this->host->respond(true, 'Note saved', ['id' => $noteId]);
                break;

            case 'onotes.archive':
                $body = $this->requirePostBody($method);
                $this->host->svc(OfficeNotesService::class)->setActive(
                    (int) ($body['id'] ?? 0),
                    !empty($body['active'])
                );
                $this->host->respond(true, 'Note updated');
                break;

            case 'onotes.delete':
                $body = $this->requirePostBody($method);
                $this->host->svc(OfficeNotesService::class)->delete((int) ($body['id'] ?? 0));
                $this->host->respond(true, 'Note deleted');
                break;

            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function requirePostBody(string $method): array
    {
        if ($method !== 'POST') {
            $this->host->respond(false, 'POST required', [], 405);
        }
        $body = $this->host->readJsonBody();
        $this->host->verifyCsrf($body);

        return $body;
    }
}
