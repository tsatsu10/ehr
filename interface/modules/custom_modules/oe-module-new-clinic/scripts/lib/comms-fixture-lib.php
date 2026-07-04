<?php

/**
 * Shared helpers for Communications Hub smoke fixtures (COM Phase 1).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\CommunicationsHubService;

const NC_COMMS_MSG_MARKER = 'NC-COMMS-SMOKE-MSG';
const NC_COMMS_REM_MARKER = 'NC-COMMS-SMOKE-REM';
const NC_COMMS_MSG_TYPE = 'NC-COMMS-FIXTURE';

function commsBootstrapActorSession(int $actorUserId, string $username): void
{
    $_SESSION['authUser'] = $username;
    $_SESSION['authUserID'] = $actorUserId;
    $_SESSION['authProvider'] = $_SESSION['authProvider'] ?? 'Default';
}

/**
 * @return array<string, mixed>|null
 */
function commsFindActiveMessage(string $assigneeUsername): ?array
{
    $row = QueryUtils::querySingleRow(
        "SELECT id, body, assigned_to, message_status
         FROM pnotes
         WHERE body LIKE ?
           AND assigned_to = ?
           AND message_status != 'Done'
         ORDER BY id DESC
         LIMIT 1",
        ['%' . NC_COMMS_MSG_MARKER . '%', $assigneeUsername]
    );

    return is_array($row) ? $row : null;
}

/**
 * @return array<string, mixed>|null
 */
function commsFindOpenReminder(int $recipientUserId): ?array
{
    $row = QueryUtils::querySingleRow(
        "SELECT dr.dr_id, dr.dr_message_text, dr.dr_message_due_date
         FROM dated_reminders dr
         INNER JOIN dated_reminders_link drl ON dr.dr_id = drl.dr_id
         WHERE dr.dr_message_text LIKE ?
           AND drl.to_id = ?
           AND dr.message_processed = '0'
         ORDER BY dr.dr_id DESC
         LIMIT 1",
        ['%' . NC_COMMS_REM_MARKER . '%', $recipientUserId]
    );

    return is_array($row) ? $row : null;
}

/**
 * @return array<string, mixed>
 */
function commsSeedFixtures(string $senderUsername, int $senderUserId, string $recipientUsername, int $recipientUserId): array
{
    commsBootstrapActorSession($senderUserId, $senderUsername);

    $service = new CommunicationsHubService();

    $message = commsFindActiveMessage($recipientUsername);
    if ($message === null) {
        $created = $service->sendMessage([
            'body' => NC_COMMS_MSG_MARKER . ' E2E communications fixture',
            'note_type' => NC_COMMS_MSG_TYPE,
            'assigned_to' => [$recipientUsername],
            'message_status' => 'New',
        ], $senderUsername, $senderUserId);
        $messageId = (int) ($created['id'] ?? 0);
        if ($messageId <= 0) {
            throw new RuntimeException('Failed to seed communications message fixture');
        }
        $message = commsFindActiveMessage($recipientUsername);
    }

    $reminder = commsFindOpenReminder($recipientUserId);
    if ($reminder === null) {
        $dueDate = (new DateTimeImmutable('today'))->format('Y-m-d');
        $service->createReminder([
            'message' => NC_COMMS_REM_MARKER . ' E2E reminder',
            'due_date' => $dueDate,
            'send_to' => [$recipientUserId],
            'priority' => 2,
            'pid' => 0,
        ], $senderUserId);
        $reminder = commsFindOpenReminder($recipientUserId);
    }

    if ($message === null || $reminder === null) {
        throw new RuntimeException('Communications fixtures missing after seed');
    }

    return [
        'message_id' => (int) ($message['id'] ?? 0),
        'reminder_id' => (int) ($reminder['dr_id'] ?? 0),
        'assignee_username' => $recipientUsername,
        'recipient_user_id' => $recipientUserId,
    ];
}

function commsCleanupFixtures(): void
{
    sqlStatement(
        'DELETE drl FROM dated_reminders_link drl
         INNER JOIN dated_reminders dr ON dr.dr_id = drl.dr_id
         WHERE dr.dr_message_text LIKE ?',
        ['%' . NC_COMMS_REM_MARKER . '%']
    );
    sqlStatement(
        'DELETE FROM dated_reminders WHERE dr_message_text LIKE ?',
        ['%' . NC_COMMS_REM_MARKER . '%']
    );
    sqlStatement(
        'DELETE FROM pnotes WHERE body LIKE ?',
        ['%' . NC_COMMS_MSG_MARKER . '%']
    );
}
