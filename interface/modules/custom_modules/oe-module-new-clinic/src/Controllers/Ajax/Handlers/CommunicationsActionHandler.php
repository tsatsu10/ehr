<?php

/**
 * communications.* ajax actions (AUDIT-10n).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Modules\NewClinic\Controllers\Ajax\AjaxActionHandlerInterface;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\CommHubUserSettingsService;
use OpenEMR\Modules\NewClinic\Services\CommunicationsHubService;

final class CommunicationsActionHandler implements AjaxActionHandlerInterface
{
    /** @var array<int, string> */
    private const ACTIONS = [
        'communications.hub_counts',
        'communications.messages_list',
        'communications.message_detail',
        'communications.reminders_list',
        'communications.message_done',
        'communications.message_status',
        'communications.assign_patient',
        'communications.message_delete',
        'communications.reminder_done',
        'communications.compose_options',
        'communications.message_send',
        'communications.reminder_create_options',
        'communications.reminder_create',
        'communications.reminder_log',
        'communications.save_preferences',
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
            case 'communications.hub_counts':
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $counts = $this->host->svc(CommunicationsHubService::class)->hubCounts($authUser, $userId);
                $this->host->respond(true, 'ok', $counts);
                break;
            case 'communications.messages_list':
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $list = $this->host->svc(CommunicationsHubService::class)->listMessages($authUser, [
                    'activity' => $_REQUEST['activity'] ?? '1',
                    'show_all' => $_REQUEST['show_all'] ?? '',
                    'sortby' => $_REQUEST['sortby'] ?? 'pnotes.date',
                    'sortorder' => $_REQUEST['sortorder'] ?? 'desc',
                    'begin' => $_REQUEST['begin'] ?? 0,
                    'limit' => $_REQUEST['limit'] ?? 25,
                    'q' => $_REQUEST['q'] ?? '',
                ]);
                $this->host->respond(true, 'ok', $list);
                break;
            case 'communications.message_detail':
                $noteId = (int) ($_REQUEST['id'] ?? 0);
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $detail = $this->host->svc(CommunicationsHubService::class)->getMessageDetail($noteId, $authUser);
                $this->host->respond(true, 'ok', $detail);
                break;
            case 'communications.reminders_list':
                $days = (int) ($_REQUEST['days'] ?? 30);
                $list = $this->host->svc(CommunicationsHubService::class)->listReminders($userId, $days);
                $this->host->respond(true, 'ok', $list);
                break;
            case 'communications.message_done':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $this->host->svc(CommunicationsHubService::class)->markMessageDone($noteId, $authUser);
                $this->host->respond(true, 'ok', ['id' => $noteId]);
                break;
            case 'communications.message_status':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                $messageStatus = trim((string) ($body['message_status'] ?? ''));
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $this->host->svc(CommunicationsHubService::class)->setMessageStatus($noteId, $messageStatus, $authUser);
                $this->host->respond(true, 'ok', ['id' => $noteId, 'message_status' => $messageStatus]);
                break;
            case 'communications.assign_patient':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                $pid = (int) ($body['pid'] ?? 0);
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $result = $this->host->svc(CommunicationsHubService::class)->assignMessagePatient($noteId, $pid, $authUser);
                $this->host->respond(true, 'ok', $result);
                break;
            case 'communications.message_delete':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $noteId = (int) ($body['noteid'] ?? $body['id'] ?? 0);
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $this->host->svc(CommunicationsHubService::class)->deleteMessage($noteId, $authUser);
                $this->host->respond(true, 'ok', ['id' => $noteId]);
                break;
            case 'communications.reminder_done':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $reminderId = (int) ($body['dr_id'] ?? $body['id'] ?? 0);
                $this->host->svc(CommunicationsHubService::class)->markReminderProcessed($reminderId, $userId);
                $this->host->respond(true, 'ok', ['id' => $reminderId]);
                break;
            case 'communications.compose_options':
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $replyNoteId = (int) ($_REQUEST['reply_note_id'] ?? 0);
                $options = $this->host->svc(CommunicationsHubService::class)->getComposeOptions(
                    $replyNoteId > 0 ? $replyNoteId : null,
                    $authUser
                );
                $this->host->respond(true, 'ok', $options);
                break;
            case 'communications.message_send':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $authUser = (string) ($_SESSION['authUser'] ?? '');
                $result = $this->host->svc(CommunicationsHubService::class)->sendMessage($body, $authUser, $userId);
                $this->host->respond(true, 'ok', $result);
                break;
            case 'communications.reminder_create_options':
                $forwardReminderId = (int) ($_REQUEST['forward_reminder_id'] ?? 0);
                $options = $this->host->svc(CommunicationsHubService::class)->getReminderCreateOptions(
                    $userId,
                    $forwardReminderId > 0 ? $forwardReminderId : null
                );
                $this->host->respond(true, 'ok', $options);
                break;
            case 'communications.reminder_create':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $result = $this->host->svc(CommunicationsHubService::class)->createReminder($body, $userId);
                $this->host->respond(true, 'ok', $result);
                break;
            case 'communications.reminder_log':
                $filters = [
                    'sent_by' => $_REQUEST['sent_by'] ?? null,
                    'sent_to' => $_REQUEST['sent_to'] ?? null,
                    'processed' => $_REQUEST['processed'] ?? null,
                    'date_from' => $this->host->validDayOrNull($_REQUEST['date_from'] ?? null),
                    'date_to' => $this->host->validDayOrNull($_REQUEST['date_to'] ?? null),
                ];
                $log = $this->host->svc(CommunicationsHubService::class)->listReminderLog($userId, $filters);
                $this->host->respond(true, 'ok', $log);
                break;
            case 'communications.save_preferences':
                if ($method !== 'POST') {
                    $this->host->respond(false, 'POST required', [], 405);
                }
                $body = $this->host->readJsonBody();
                $this->host->verifyCsrf($body);
                $canViewAll = AclMain::aclCheckCore('admin', 'super');
                $prefs = $this->host->svc(CommHubUserSettingsService::class)->savePreferences($body, $canViewAll);
                $this->host->respond(true, 'ok', $prefs);
                break;
            default:
                $this->host->respond(false, 'Unknown action', ['code' => 'not_found'], 404);
        }
    }
}
