<?php

/**
 * outreach.* ajax actions (GAP-B B1).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\OutreachService;

final class OutreachActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'outreach.presets',
        'outreach.preview',
        'outreach.queue',
        'outreach.history',
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
            case 'outreach.presets':
                $this->guard(fn () => $this->host->respond(true, 'ok', $this->host->svc(OutreachService::class)->presets()));
                break;
            case 'outreach.history':
                $this->guard(fn () => $this->host->respond(true, 'ok', $this->host->svc(OutreachService::class)->history()));
                break;
            case 'outreach.preview':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->guard(fn () => $this->host->respond(true, 'ok', $this->host->svc(OutreachService::class)->preview($body)));
                break;
            case 'outreach.queue':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $this->guard(fn () => $this->host->respond(true, 'ok', $this->host->svc(OutreachService::class)->queue($body, $userId)));
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }

    private function guard(callable $fn): void
    {
        try {
            $fn();
        } catch (\InvalidArgumentException $e) {
            $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
        } catch (\RuntimeException $e) {
            $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
        }
    }
}
