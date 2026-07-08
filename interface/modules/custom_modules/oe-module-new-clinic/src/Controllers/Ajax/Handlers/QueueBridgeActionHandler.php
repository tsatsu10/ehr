<?php

/**
 * queue_bridge.* and queue.counts ajax actions (AUDIT-10l).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeAccessService;
use OpenEMR\Modules\NewClinic\Services\QueueBridgeService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;

final class QueueBridgeActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'queue_bridge.list',
        'queue_bridge.eod_export',
        'queue_bridge.resolve',
        'queue_bridge.link_appointment',
        'queue_bridge.dismiss',
        'queue.counts',
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
            case 'queue_bridge.list':
                $facilityId = $this->host->resolveRequestFacilityId();
                $lens = (string) ($_REQUEST['lens'] ?? 'action');
                $page = max(1, (int) ($_REQUEST['page'] ?? 1));
                $this->host->respond(true, 'ok', $this->host->svc(QueueBridgeService::class)->listExceptions($facilityId, $lens, $page));
                break;
            case 'queue_bridge.eod_export':
                $facilityId = $this->host->resolveRequestFacilityId();
                try {
                    $this->host->svc(QueueBridgeAccessService::class)->assertHubAccess();
                    $export = $this->host->svc(QueueBridgeService::class)->exportEodCsv($facilityId);
                    $this->host->respondCsv($export['filename'], $export['content']);
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], 403);
                }
                break;
            case 'queue_bridge.resolve':
            case 'queue_bridge.link_appointment':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $facilityId = $this->host->resolveRequestFacilityId();
                $resolveAction = $action === 'queue_bridge.link_appointment'
                    ? 'link_appointment'
                    : (string) ($body['action'] ?? '');
                try {
                    $result = $this->host->svc(QueueBridgeService::class)->resolve(
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
                    $this->host->respond(true, 'ok', $result);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'queue_bridge.dismiss':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $facilityId = $this->host->resolveRequestFacilityId();
                try {
                    $result = $this->host->svc(QueueBridgeService::class)->dismiss(
                        (string) ($body['exception_code'] ?? ''),
                        (int) ($body['pid'] ?? 0),
                        $facilityId,
                        $userId,
                        (string) ($body['reason'] ?? ''),
                        isset($body['pc_eid']) ? (int) $body['pc_eid'] : null,
                        isset($body['visit_id']) ? (int) $body['visit_id'] : null,
                    );
                    $this->host->respond(true, 'ok', $result);
                } catch (\InvalidArgumentException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'invalid_request'], 400);
                } catch (\RuntimeException $e) {
                    $this->host->respond(false, $e->getMessage(), ['code' => 'forbidden'], (int) ($e->getCode() ?: 403));
                }
                break;
            case 'queue.counts':
                $facilityId = $this->host->resolveRequestFacilityId();
                $counts = $this->host->svc(VisitQueueService::class)->getCounts($facilityId);
                $this->host->respond(true, 'ok', [
                    'counts' => $counts,
                    'last_updated' => date('c'),
                ]);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
