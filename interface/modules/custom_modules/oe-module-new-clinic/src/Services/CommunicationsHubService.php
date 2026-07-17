<?php

/**
 * Staff Communications Hub — Messages (pnotes) + Dated Reminders (COM Phase 1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class CommunicationsHubService
{
    private const LIST_LIMIT_DEFAULT = 25;
    private const LIST_LIMIT_MAX = 50;
    private const REMINDER_WINDOW_DAYS = 30;
    /**
     * Stock getPnotesByUser() has no text-search argument, so a keyword search has
     * to fetch rows and match in PHP. Cap that scan at the most-recent N messages
     * (in the current sort) instead of loading a user's ENTIRE note history into
     * memory; the UI surfaces `search_truncated` so staff know to narrow filters
     * if a match might be older than the window.
     */
    private const SEARCH_SCAN_MAX = 5000;

    public function assertNotesAcl(): void
    {
        if (!AclMain::aclCheckCore('patients', 'notes')) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function canViewAllUsers(): bool
    {
        return AclMain::aclCheckCore('admin', 'super');
    }

    /**
     * @return array<string, int>
     */
    public function hubCounts(string $authUser, int $userId): array
    {
        $this->bootstrapLegacyIncludes();

        $activeMessages = (int) getPnotesByUser('1', 'no', $authUser, true);
        $dueReminders = (int) GetDueReminderCount(5, strtotime(date('Y/m/d')), $userId);

        return [
            'messages_active' => $activeMessages,
            'reminders_due_5d' => $dueReminders,
            'reminders_in_window' => $this->countRemindersInWindow($userId, self::REMINDER_WINDOW_DAYS),
            'envelope_total' => $activeMessages + $dueReminders,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function listMessages(string $authUser, array $filters = []): array
    {
        $this->bootstrapLegacyIncludes();

        $activity = $this->normalizeActivity((string) ($filters['activity'] ?? '1'));
        $showAll = !empty($filters['show_all']) && $this->canViewAllUsers() ? 'yes' : 'no';
        $sortby = $this->normalizeSortBy((string) ($filters['sortby'] ?? 'pnotes.date'));
        $sortorder = strtolower((string) ($filters['sortorder'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $begin = max(0, (int) ($filters['begin'] ?? 0));
        $limit = min(max((int) ($filters['limit'] ?? self::LIST_LIMIT_DEFAULT), 1), self::LIST_LIMIT_MAX);
        $search = trim((string) ($filters['q'] ?? ''));

        $searchTruncated = false;
        if ($search !== '') {
            // Bounded scan: pull at most SEARCH_SCAN_MAX rows (in the current sort)
            // rather than a user's whole note history, then filter in PHP.
            $result = getPnotesByUser(
                $activity,
                $showAll,
                $authUser,
                false,
                $sortby,
                $sortorder,
                '0',
                (string) self::SEARCH_SCAN_MAX
            );
            $scanned = 0;
            $matched = [];
            while ($row = sqlFetchArray($result)) {
                if (!is_array($row)) {
                    continue;
                }
                $scanned++;
                $mapped = $this->mapMessageRow($row);
                if ($this->rowMatchesSearch($mapped, $search)) {
                    $matched[] = $mapped;
                }
            }
            $searchTruncated = $scanned >= self::SEARCH_SCAN_MAX;
            $total = count($matched);
            $rows = array_slice($matched, $begin, $limit);
        } else {
            $total = (int) getPnotesByUser($activity, $showAll, $authUser, true, $sortby, $sortorder);
            $result = getPnotesByUser($activity, $showAll, $authUser, false, $sortby, $sortorder, (string) $begin, (string) $limit);

            $rows = [];
            while ($row = sqlFetchArray($result)) {
                if (!is_array($row)) {
                    continue;
                }
                $rows[] = $this->mapMessageRow($row);
            }
        }

        // Stock getPnotesByUser() does not select the note body, so fill the
        // inbox-row preview snippets in one bounded query over the current page.
        $rows = $this->attachPreviews($rows);

        return [
            'rows' => $rows,
            'total' => $total,
            'begin' => $begin,
            'limit' => $limit,
            'show_all' => $showAll === 'yes',
            'admin_read_only' => $showAll === 'yes',
            'search_truncated' => $searchTruncated,
            'search_scan_max' => self::SEARCH_SCAN_MAX,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getMessageDetail(int $noteId, string $authUser): array
    {
        $this->bootstrapLegacyIncludes();

        if ($noteId <= 0) {
            throw new \InvalidArgumentException('Message id is required');
        }

        $note = getPnoteById($noteId);
        if (!is_array($note) || empty($note['id'])) {
            throw new \RuntimeException('Message not found', 404);
        }

        $isOwner = checkPnotesNoteId($noteId, $authUser);
        $adminSupervisory = !$isOwner && $this->canViewAllUsers();

        if (!$isOwner && !$adminSupervisory) {
            throw new \RuntimeException('Forbidden', 403);
        }

        // Opening an unread message you own marks it Read, like email/chat.
        // This is a one-row write on an explicit user open (not a poll), and a
        // supervisory admin peeking at someone else's message never changes it.
        $currentStatus = trim((string) ($note['message_status'] ?? ''));
        $markedRead = false;
        if ($isOwner && $currentStatus === 'New') {
            updatePnoteMessageStatus($noteId, 'Read');
            $currentStatus = 'Read';
            $markedRead = true;
        }

        $pid = (int) ($note['pid'] ?? 0);
        $patientName = $pid > 0 ? $this->formatPatientName($pid) : '';
        $body = (string) ($note['body'] ?? '');
        // Escape FIRST, then linkify — stock pnoteConvertLinks does not escape,
        // so linkifying the raw body would render note markup verbatim (XSS).
        $escapedBody = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));
        $threadHtml = function_exists('pnoteConvertLinks')
            ? pnoteConvertLinks($escapedBody)
            : $escapedBody;

        return [
            'id' => $noteId,
            'turns' => $this->parseThreadTurns($body, (string) ($note['user'] ?? ''), $authUser),
            'from_name' => $this->formatUserName((string) ($note['user'] ?? '')),
            'assigned_to' => (string) ($note['assigned_to'] ?? ''),
            'patient_name' => $patientName,
            'pid' => $pid > 0 ? $pid : null,
            'patient_unassigned' => $pid <= 0,
            'can_assign_patient' => $isOwner && $pid <= 0,
            'type' => trim((string) ($note['title'] ?? '')) ?: 'Message',
            'status' => $currentStatus ?: null,
            'marked_read' => $markedRead,
            'date' => (string) ($note['date'] ?? ''),
            'date_display' => $this->formatDateTime($note['date'] ?? null),
            'thread_html' => '<div class="msg-thread">' . $threadHtml . '</div>',
            'can_reply' => $isOwner,
            'can_delete' => $isOwner && $this->messageDeletableByUser($note, $authUser),
            'can_mark_done' => $isOwner,
            'can_change_status' => $isOwner,
            'is_supervisory_read' => $adminSupervisory,
            'supervisory_banner' => $adminSupervisory
                ? 'You are viewing another user\'s message as an administrator. Reply and delete are disabled.'
                : null,
            'admin_read_only' => $adminSupervisory,
            'chart_url' => $pid > 0
                ? ($GLOBALS['webroot'] ?? '')
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid='
                . urlencode((string) $pid)
                : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function listReminders(int $userId, int $days = self::REMINDER_WINDOW_DAYS): array
    {
        $this->bootstrapLegacyIncludes();

        $days = min(max($days, 1), 90);
        $today = strtotime(date('Y/m/d'));
        $items = RemindersArray($days, $today, 200, $userId);

        $rows = [];
        foreach ($items as $item) {
            $dueTs = strtotime((string) ($item['dueDate'] ?? ''));
            $urgency = 'upcoming';
            if ($dueTs !== false && $dueTs < $today) {
                $urgency = 'overdue';
            } elseif ($dueTs !== false && $dueTs === $today) {
                $urgency = 'today';
            }

            $rows[] = [
                'id' => (int) ($item['messageID'] ?? 0),
                'pid' => (int) ($item['PatientID'] ?? 0),
                'patient_name' => trim((string) ($item['PatientName'] ?? '')),
                'preview' => $this->clipText((string) ($item['message'] ?? ''), 200),
                'from_name' => trim((string) ($item['fromName'] ?? '')),
                'due_date' => (string) ($item['dueDate'] ?? ''),
                'due_display' => $this->formatDateTime($item['dueDate'] ?? null),
                'urgency' => $urgency,
                'urgency_label' => $this->urgencyLabel($urgency),
            ];
        }

        return [
            'rows' => $rows,
            'total' => count($rows),
            'window_days' => $days,
        ];
    }

    public function markReminderProcessed(int $reminderId, int $userId): void
    {
        $this->bootstrapLegacyIncludes();

        if ($reminderId <= 0) {
            throw new \InvalidArgumentException('Reminder id is required');
        }

        $row = getReminderById($reminderId, $userId);
        if ($row === false) {
            throw new \RuntimeException('Reminder not found', 404);
        }

        setReminderAsProcessed($reminderId, $userId);
    }

    public function markMessageDone(int $noteId, string $authUser): void
    {
        $this->setMessageStatus($noteId, 'Done', $authUser);
    }

    public function setMessageStatus(int $noteId, string $status, string $authUser): void
    {
        $this->bootstrapLegacyIncludes();

        $status = trim($status);
        if ($status === '') {
            throw new \InvalidArgumentException('Message status is required');
        }

        if (!checkPnotesNoteId($noteId, $authUser)) {
            throw new \RuntimeException('Forbidden', 403);
        }

        if (!$this->isValidMessageStatus($status)) {
            throw new \InvalidArgumentException('Invalid message status');
        }

        updatePnoteMessageStatus($noteId, $status);
    }

    /**
     * @return array<string, mixed>
     */
    public function assignMessagePatient(int $noteId, int $pid, string $authUser): array
    {
        $this->bootstrapLegacyIncludes();

        if ($noteId <= 0 || $pid <= 0) {
            throw new \InvalidArgumentException('Message and patient are required');
        }

        if (!checkPnotesNoteId($noteId, $authUser)) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $note = getPnoteById($noteId);
        if (!is_array($note) || empty($note['id'])) {
            throw new \RuntimeException('Message not found', 404);
        }

        if ((int) ($note['pid'] ?? 0) !== 0) {
            throw new \InvalidArgumentException('Message already has a patient');
        }

        $patientRow = QueryUtils::querySingleRow(
            'SELECT pid FROM patient_data WHERE pid = ? LIMIT 1',
            [$pid]
        );
        if (!is_array($patientRow)) {
            throw new \InvalidArgumentException('Patient not found');
        }

        updatePnotePatient($noteId, $pid);

        return [
            'id' => $noteId,
            'pid' => $pid,
            'patient_name' => $this->formatPatientName($pid),
        ];
    }

    public function deleteMessage(int $noteId, string $authUser): void
    {
        $this->bootstrapLegacyIncludes();

        if ($noteId <= 0) {
            throw new \InvalidArgumentException('Message id is required');
        }

        if (!checkPnotesNoteId($noteId, $authUser)) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $note = getPnoteById($noteId);
        if (!is_array($note) || empty($note['id'])) {
            throw new \RuntimeException('Message not found', 404);
        }

        if (!$this->messageDeletableByUser($note, $authUser)) {
            throw new \RuntimeException('Forbidden', 403);
        }

        if (!deletePnote($noteId)) {
            throw new \RuntimeException('Could not delete message', 403);
        }
    }

    /**
     * @param array<string, mixed> $note
     */
    private function messageDeletableByUser(array $note, string $authUser): bool
    {
        $assigned = trim((string) ($note['assigned_to'] ?? ''));
        $status = trim((string) ($note['message_status'] ?? ''));

        return $assigned === $authUser
            || $assigned === 'portal-user'
            || $status === 'Done';
    }

    private function isValidMessageStatus(string $status): bool
    {
        foreach ($this->fetchListOptions('message_status') as $option) {
            if (($option['id'] ?? '') === $status) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    public function getComposeOptions(?int $replyNoteId, string $authUser): array
    {
        $this->bootstrapLegacyIncludes();

        $seed = null;
        if ($replyNoteId !== null && $replyNoteId > 0) {
            $seed = $this->buildReplySeed($replyNoteId, $authUser);
        }

        return [
            'note_types' => $this->fetchListOptions('note_type'),
            'message_statuses' => $this->fetchListOptions('message_status'),
            'users' => $this->fetchActiveUsers(),
            'default_status' => 'New',
            'show_due_date' => !empty($GLOBALS['messages_due_date']),
            'reply' => $seed,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function sendMessage(array $payload, string $authUser, int $userId): array
    {
        $this->bootstrapLegacyIncludes();

        $body = trim((string) ($payload['body'] ?? ''));
        if (strlen($body) < 2) {
            throw new \InvalidArgumentException('Message body is required');
        }

        $noteTypeProvided = array_key_exists('note_type', $payload)
            && trim((string) $payload['note_type']) !== '';
        $noteType = $noteTypeProvided ? trim((string) $payload['note_type']) : 'Unassigned';
        $messageStatus = trim((string) ($payload['message_status'] ?? 'New')) ?: 'New';
        $pid = max(0, (int) ($payload['pid'] ?? 0));
        $replyNoteId = (int) ($payload['reply_note_id'] ?? 0);
        $datetime = trim((string) ($payload['form_datetime'] ?? ''));
        $assignedTo = $this->normalizeAssignees($payload['assigned_to'] ?? []);

        if ($replyNoteId > 0) {
            if (!$this->canReplyToNote($replyNoteId, $authUser)) {
                throw new \RuntimeException('Forbidden', 403);
            }
            $note = getPnoteById($replyNoteId);
            if ($assignedTo === []) {
                $assignedTo = [trim((string) ($note['assigned_to'] ?? ''))];
            }
            // An inline chat reply carries no type; keep the conversation's own type
            // rather than resetting it to "Unassigned".
            if (!$noteTypeProvided) {
                $noteType = trim((string) ($note['title'] ?? '')) ?: 'Unassigned';
            }
            $assignee = $assignedTo[0] ?? '';
            if ($assignee === '') {
                throw new \InvalidArgumentException('Recipient is required');
            }

            updatePnote(
                $replyNoteId,
                $body,
                $noteType,
                $assignee,
                $messageStatus,
                $datetime
            );

            return [
                'id' => $replyNoteId,
                'mode' => 'reply',
            ];
        }

        if ($messageStatus !== 'Done' && $assignedTo === []) {
            throw new \InvalidArgumentException('At least one recipient is required');
        }

        $authorized = (string) ($GLOBALS['userauthorized'] ?? '0');
        $createdIds = [];
        foreach ($assignedTo as $assignee) {
            if ($assignee === '') {
                continue;
            }
            $createdIds[] = (int) addPnote(
                $pid,
                $body,
                $authorized,
                '1',
                $noteType,
                $assignee,
                $datetime,
                $messageStatus
            );
        }

        if ($createdIds === []) {
            throw new \InvalidArgumentException('At least one recipient is required');
        }

        $attachmentId = (int) ($payload['attachment_id'] ?? 0);
        $attachmentType = (int) ($payload['attachment_type'] ?? 0);
        if ($attachmentId > 0 && $attachmentType > 0) {
            $this->linkMessageAttachment($attachmentType, $attachmentId, $createdIds[0]);
        }

        return [
            'id' => $createdIds[0],
            'ids' => $createdIds,
            'mode' => 'create',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getReminderCreateOptions(int $userId, ?int $forwardReminderId = null): array
    {
        $this->bootstrapLegacyIncludes();

        $forward = null;
        if ($forwardReminderId !== null && $forwardReminderId > 0) {
            $row = getReminderById($forwardReminderId, $userId);
            if (!is_array($row) || $row === false) {
                throw new \RuntimeException('Reminder not found', 404);
            }
            $pid = (int) ($row['pid'] ?? 0);
            $forward = [
                'reminder_id' => $forwardReminderId,
                'message' => (string) ($row['dr_message_text'] ?? ''),
                'priority' => (int) ($row['message_priority'] ?? 3),
                'due_date' => $this->normalizeReminderDueDate((string) ($row['dr_message_due_date'] ?? '')),
                'pid' => $pid > 0 ? $pid : null,
                'patient_name' => $pid > 0 ? $this->formatPatientName($pid) : null,
            ];
        }

        return [
            'recipients' => $this->fetchReminderRecipientUsers($userId),
            'date_presets' => $this->getReminderDatePresets(),
            'priorities' => [
                ['id' => 1, 'label' => 'High'],
                ['id' => 2, 'label' => 'Medium'],
                ['id' => 3, 'label' => 'Low'],
            ],
            'max_message_length' => 160,
            'default_priority' => 3,
            'forward' => $forward,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createReminder(array $payload, int $userId): array
    {
        $this->bootstrapLegacyIncludes();

        $message = trim((string) ($payload['message'] ?? ''));
        if ($message === '' || mb_strlen($message) > 160) {
            throw new \InvalidArgumentException('Reminder message must be 1–160 characters');
        }

        $priority = (int) ($payload['priority'] ?? 3);
        if ($priority < 1 || $priority > 3) {
            throw new \InvalidArgumentException('Invalid priority');
        }

        $pid = (int) ($payload['pid'] ?? 0);
        if ($pid < 0) {
            throw new \InvalidArgumentException('Invalid patient');
        }

        $dueDate = $this->normalizeReminderDueDate((string) ($payload['due_date'] ?? ''));
        if ($dueDate === null) {
            throw new \InvalidArgumentException('Due date is required');
        }

        $sendTo = $this->normalizeRecipientIds($payload['send_to'] ?? []);
        if ($sendTo === []) {
            throw new \InvalidArgumentException('At least one recipient is required');
        }

        $sendSeparately = !empty($payload['send_separately']);
        $created = false;
        if ($sendSeparately) {
            foreach ($sendTo as $recipientId) {
                $created = sendReminder([$recipientId], $userId, $message, $dueDate, $pid, $priority) || $created;
            }
        } else {
            $created = sendReminder($sendTo, $userId, $message, $dueDate, $pid, $priority);
        }

        if (!$created) {
            throw new \RuntimeException('Could not create reminder');
        }

        return [
            'ok' => true,
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function listReminderLog(int $userId, array $filters = []): array
    {
        $this->bootstrapLegacyIncludes();

        $isAdmin = AclMain::aclCheckCore('admin', 'users');
        $where = [];
        $bind = [];

        if (!$isAdmin) {
            $where[] = 'drl.to_id = ?';
            $bind[] = $userId;
        }

        $sentBy = $this->normalizeRecipientIds($filters['sent_by'] ?? []);
        if ($sentBy !== []) {
            $parts = array_fill(0, count($sentBy), 'dr.dr_from_ID = ?');
            $where[] = '(' . implode(' OR ', $parts) . ')';
            array_push($bind, ...$sentBy);
        }

        $sentTo = $this->normalizeRecipientIds($filters['sent_to'] ?? []);
        if ($sentTo !== []) {
            $parts = array_fill(0, count($sentTo), 'drl.to_id = ?');
            $where[] = '(' . implode(' OR ', $parts) . ')';
            array_push($bind, ...$sentTo);
        }

        $processed = $this->normalizeProcessedFilter($filters['processed'] ?? null);
        if ($processed === true) {
            $where[] = 'dr.message_processed = 1';
        } elseif ($processed === false) {
            $where[] = 'dr.message_processed = 0';
        }

        $dateFrom = $this->normalizeReminderDueDate((string) ($filters['date_from'] ?? ''));
        if ($dateFrom !== null) {
            $where[] = 'dr.dr_message_sent_date >= ?';
            $bind[] = $dateFrom . ' 00:00:00';
        }

        $dateTo = $this->normalizeReminderDueDate((string) ($filters['date_to'] ?? ''));
        if ($dateTo !== null) {
            $where[] = 'dr.dr_message_sent_date <= ?';
            $bind[] = $dateTo . ' 23:59:59';
        }

        $whereSql = $where === [] ? '' : 'WHERE ' . implode(' AND ', $where);
        $rows = QueryUtils::fetchRecords(
            "SELECT dr.dr_id, dr.pid, dr.dr_message_text, dr.dr_message_due_date, dr.dr_message_sent_date,
                    dr.processed_date, dr.dr_processed_by,
                    u.fname AS ffname, u.lname AS flname,
                    tu.fname AS tfname, tu.lname AS tlname
             FROM dated_reminders dr
             JOIN dated_reminders_link drl ON dr.dr_id = drl.dr_id
             JOIN users u ON dr.dr_from_ID = u.id
             JOIN users tu ON drl.to_id = tu.id
             {$whereSql}
             ORDER BY dr.dr_message_sent_date DESC, dr.dr_id DESC
             LIMIT 250",
            $bind
        ) ?: [];

        $aggregated = [];
        foreach ($rows as $row) {
            $id = (int) ($row['dr_id'] ?? 0);
            if ($id <= 0) {
                continue;
            }

            if (!isset($aggregated[$id])) {
                $pid = (int) ($row['pid'] ?? 0);
                $processedBy = (int) ($row['dr_processed_by'] ?? 0);
                $aggregated[$id] = [
                    'id' => $id,
                    'sent_at' => (string) ($row['dr_message_sent_date'] ?? ''),
                    'sent_at_label' => $this->formatDateTime((string) ($row['dr_message_sent_date'] ?? '')),
                    'from_name' => trim(trim((string) ($row['ffname'] ?? '')) . ' ' . trim((string) ($row['flname'] ?? ''))),
                    'to_names' => [],
                    'patient_name' => $pid > 0 ? $this->formatPatientName($pid) : 'N/A',
                    'message' => (string) ($row['dr_message_text'] ?? ''),
                    'due_date' => (string) ($row['dr_message_due_date'] ?? ''),
                    'due_date_label' => $this->formatDateTime((string) ($row['dr_message_due_date'] ?? '')),
                    'processed_at' => (string) ($row['processed_date'] ?? ''),
                    'processed_at_label' => $this->formatDateTime((string) ($row['processed_date'] ?? '')),
                    'processed_by' => $processedBy > 0 ? $this->formatUserNameById($processedBy) : 'N/A',
                ];
            }

            $toName = trim(trim((string) ($row['tfname'] ?? '')) . ' ' . trim((string) ($row['tlname'] ?? '')));
            if ($toName !== '' && !in_array($toName, $aggregated[$id]['to_names'], true)) {
                $aggregated[$id]['to_names'][] = $toName;
            }
        }

        $logRows = array_values(array_map(static function (array $row): array {
            $row['to_name'] = implode(', ', $row['to_names']);
            unset($row['to_names']);

            return $row;
        }, $aggregated));

        return [
            'rows' => $logRows,
            'total' => count($logRows),
            'is_admin' => $isAdmin,
            'recipients' => $isAdmin ? $this->fetchReminderRecipientUsers($userId) : [],
        ];
    }

    private function normalizeProcessedFilter(mixed $raw): ?bool
    {
        if ($raw === null || $raw === '' || $raw === 'all') {
            return null;
        }
        if ($raw === 'pending' || $raw === false || $raw === '0' || $raw === 0) {
            return false;
        }
        if ($raw === 'processed' || $raw === true || $raw === '1' || $raw === 1) {
            return true;
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildReplySeed(int $noteId, string $authUser): array
    {
        if (!$this->canReplyToNote($noteId, $authUser)) {
            throw new \RuntimeException('Forbidden', 403);
        }

        $note = getPnoteById($noteId);
        if (!is_array($note)) {
            throw new \RuntimeException('Message not found', 404);
        }

        $pid = (int) ($note['pid'] ?? 0);

        return [
            'reply_note_id' => $noteId,
            'note_type' => trim((string) ($note['title'] ?? '')) ?: 'Unassigned',
            'message_status' => trim((string) ($note['message_status'] ?? '')) ?: 'New',
            'pid' => $pid > 0 ? $pid : null,
            'patient_name' => $pid > 0 ? $this->formatPatientName($pid) : null,
            'assigned_to' => array_values(array_filter([
                trim((string) ($note['assigned_to'] ?? '')),
            ])),
        ];
    }

    private function canReplyToNote(int $noteId, string $authUser): bool
    {
        return checkPnotesNoteId($noteId, $authUser);
    }

    /**
     * @param mixed $raw
     * @return array<int, string>
     */
    private function normalizeAssignees(mixed $raw): array
    {
        if (is_string($raw)) {
            $raw = explode(';', $raw);
        }
        if (!is_array($raw)) {
            return [];
        }

        $assignees = [];
        foreach ($raw as $value) {
            $username = trim((string) $value);
            if ($username !== '') {
                $assignees[] = $username;
            }
        }

        return array_values(array_unique($assignees));
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function fetchListOptions(string $listId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title FROM list_options
             WHERE list_id = ? AND activity = 1
             ORDER BY seq, title",
            [$listId]
        ) ?: [];

        $options = [];
        foreach ($rows as $row) {
            $id = trim((string) ($row['option_id'] ?? ''));
            $title = trim((string) ($row['title'] ?? ''));
            if ($id === '' || $title === '') {
                continue;
            }
            $options[] = [
                'id' => $id,
                'label' => $title,
            ];
        }

        return $options;
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function fetchActiveUsers(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT username, fname, lname
             FROM users
             WHERE username != '' AND active = 1
             ORDER BY lname, fname, username"
        ) ?: [];

        $users = [];
        foreach ($rows as $row) {
            $username = trim((string) ($row['username'] ?? ''));
            if ($username === '') {
                continue;
            }
            $label = trim(trim((string) ($row['lname'] ?? '')) . ', ' . trim((string) ($row['fname'] ?? '')));
            $users[] = [
                'username' => $username,
                'label' => $label !== '' ? $label : $username,
            ];
        }

        return $users;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchReminderRecipientUsers(int $currentUserId): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT id, fname, lname
             FROM users
             WHERE active = 1 AND facility_id > 0
             ORDER BY lname, fname, id"
        ) ?: [];

        $recipients = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            if ($id <= 0) {
                continue;
            }
            $label = trim(trim((string) ($row['lname'] ?? '')) . ', ' . trim((string) ($row['fname'] ?? '')));
            $recipients[] = [
                'id' => $id,
                'label' => $id === $currentUserId ? 'Myself' : ($label !== '' ? $label : ('User #' . $id)),
                'is_self' => $id === $currentUserId,
            ];
        }

        return $recipients;
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function getReminderDatePresets(): array
    {
        $presets = [
            '1_day' => '1 Day From Now',
            '2_day' => '2 Days From Now',
            '3_day' => '3 Days From Now',
            '1_week' => '1 Week From Now',
            '2_week' => '2 Weeks From Now',
            '1_month' => '1 Month From Now',
            '3_month' => '3 Months From Now',
            '6_month' => '6 Months From Now',
            '1_year' => '1 Year From Now',
        ];

        $options = [];
        foreach ($presets as $key => $label) {
            $options[] = [
                'key' => $key,
                'label' => $label,
            ];
        }

        return $options;
    }

    /**
     * @param mixed $raw
     * @return array<int, int>
     */
    private function normalizeRecipientIds(mixed $raw): array
    {
        if (is_string($raw)) {
            $raw = array_map('trim', explode(',', $raw));
        }
        if (is_numeric($raw)) {
            $raw = [(int) $raw];
        }
        if (!is_array($raw)) {
            return [];
        }

        $ids = [];
        foreach ($raw as $value) {
            $id = (int) $value;
            if ($id > 0) {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    private function normalizeReminderDueDate(string $date): ?string
    {
        $date = trim($date);
        if ($date === '' || str_starts_with($date, '0000-00-00')) {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $date)) {
            return substr($date, 0, 10);
        }

        if (function_exists('DateToYYYYMMDD')) {
            $converted = DateToYYYYMMDD($date);
            if (preg_match('/^\d{4}-\d{2}-\d{2}/', (string) $converted)) {
                return substr((string) $converted, 0, 10);
            }
        }

        try {
            return (new \DateTime($date))->format('Y-m-d');
        } catch (\Exception) {
            return null;
        }
    }

    private function formatUserNameById(int $userId): string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname FROM users WHERE id = ? LIMIT 1',
            [$userId]
        );
        if (!is_array($row)) {
            return '';
        }

        return trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));
    }

    private function bootstrapLegacyIncludes(): void
    {
        $srcdir = $GLOBALS['srcdir'] ?? '';
        if ($srcdir === '') {
            throw new \RuntimeException('OpenEMR srcdir not available');
        }

        require_once $srcdir . '/pnotes.inc.php';
        require_once $srcdir . '/patient.inc.php';
        require_once $srcdir . '/dated_reminder_functions.php';
    }

    private function linkMessageAttachment(int $attachmentType, int $attachmentId, int $noteId): void
    {
        if ($attachmentType <= 0 || $attachmentId <= 0 || $noteId <= 0) {
            return;
        }

        $srcdir = $GLOBALS['srcdir'] ?? '';
        if ($srcdir === '') {
            throw new \RuntimeException('OpenEMR srcdir not available');
        }

        require_once $srcdir . '/gprelations.inc.php';
        setGpRelation($attachmentType, $attachmentId, 6, $noteId);
    }

    private function countRemindersInWindow(int $userId, int $days): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(dr.dr_id) AS cnt
             FROM dated_reminders dr
             JOIN dated_reminders_link drl ON dr.dr_id = drl.dr_id
             WHERE drl.to_id = ?
               AND dr.message_processed = 0
               AND dr.dr_message_due_date < ADDDATE(NOW(), INTERVAL ? DAY)",
            [$userId, $days]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapMessageRow(array $row): array
    {
        $pid = (int) ($row['pid'] ?? 0);
        $patientFname = trim((string) ($row['patient_data_fname'] ?? ''));
        $patientLname = trim((string) ($row['patient_data_lname'] ?? ''));
        $patientName = trim($patientLname . ', ' . $patientFname, ' ,');
        $status = trim((string) ($row['message_status'] ?? ''));

        return [
            'id' => (int) ($row['id'] ?? 0),
            'from_name' => trim(
                trim((string) ($row['users_lname'] ?? '')) . ', ' . trim((string) ($row['users_fname'] ?? '')),
                ' ,'
            ),
            'patient_name' => $patientName !== '' ? $patientName : null,
            'pid' => $pid > 0 ? $pid : null,
            'patient_unassigned' => $pid <= 0,
            'type' => trim((string) ($row['title'] ?? '')) ?: 'Message',
            'status' => $status !== '' ? $status : 'Active',
            'status_title' => $status !== '' ? $status : 'Active',
            'date' => (string) ($row['date'] ?? ''),
            'date_display' => $this->formatDateTime($row['date'] ?? null),
            // Body snippet is filled by attachPreviews() — the list query omits body.
            'preview' => '',
            'is_unread' => $status === 'New',
        ];
    }

    /**
     * Fill each mapped row's 'preview' with a snippet of its note body.
     * One bounded "id IN (…)" query over the current page — the stock list
     * query does not return the body column.
     *
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private function attachPreviews(array $rows): array
    {
        $ids = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        if ($ids === []) {
            return $rows;
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $result = sqlStatement(
            "SELECT id, body FROM pnotes WHERE id IN ($placeholders)",
            $ids
        );
        $bodies = [];
        while ($row = sqlFetchArray($result)) {
            $bodies[(int) $row['id']] = (string) ($row['body'] ?? '');
        }

        foreach ($rows as &$row) {
            $id = (int) ($row['id'] ?? 0);
            if (isset($bodies[$id])) {
                $row['preview'] = $this->buildPreview($bodies[$id]);
            }
        }
        unset($row);

        return $rows;
    }

    /**
     * Split a pnote body into chat turns. Each turn is written by addPnote/
     * updatePnote as "YYYY-MM-DD HH:MM (author[ to assigned]) text", one per
     * line-ish; a reply appends another. We split on that leading stamp so the
     * UI can render each as a chat bubble aligned by author.
     *
     * @return list<array{author: string, is_self: bool, time_label: string, text: string}>
     */
    private function parseThreadTurns(string $body, string $noteOwner, string $authUser): array
    {
        $body = trim($body);
        if ($body === '') {
            return [];
        }

        // Match each "YYYY-MM-DD HH:MM (author...) " marker and its following text.
        $pattern = '/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s*\(([^)]*)\)\s*/';
        if (preg_match($pattern, $body) !== 1) {
            // No stamps (legacy/plain body) — treat the whole thing as one turn.
            return [[
                'author' => $this->formatUserName($noteOwner),
                'is_self' => strcasecmp($noteOwner, $authUser) === 0,
                'time_label' => '',
                'text' => $body,
            ]];
        }

        $turns = [];
        $matches = [];
        preg_match_all($pattern, $body, $matches, PREG_OFFSET_CAPTURE);
        $count = count($matches[0]);

        // Text before the first stamp is the original (unstamped) message —
        // keep it as a leading turn so it doesn't vanish once a reply is appended.
        $firstStart = (int) $matches[0][0][1];
        if ($firstStart > 0) {
            $preamble = trim(substr($body, 0, $firstStart));
            if ($preamble !== '') {
                $turns[] = [
                    'author' => $this->formatUserName($noteOwner) ?: $noteOwner,
                    'is_self' => strcasecmp($noteOwner, $authUser) === 0,
                    'time_label' => '',
                    'text' => $preamble,
                ];
            }
        }

        for ($i = 0; $i < $count; $i++) {
            [$whole, $start] = $matches[0][$i];
            $stamp = $matches[1][$i][0];
            $authorRaw = trim($matches[2][$i][0]);
            $textStart = $start + strlen($whole);
            $textEnd = $i + 1 < $count ? (int) $matches[0][$i + 1][1] : strlen($body);
            $text = trim(substr($body, $textStart, $textEnd - $textStart));
            if ($text === '') {
                // A stamp with no following text — nothing to show as a bubble.
                continue;
            }

            // "(author to assigned)" — the sender is the part before " to ".
            $author = $authorRaw;
            if (($pos = stripos($authorRaw, ' to ')) !== false) {
                $author = trim(substr($authorRaw, 0, $pos));
            }

            $turns[] = [
                'author' => $this->formatUserName($author) ?: $author,
                'is_self' => strcasecmp($author, $authUser) === 0,
                'time_label' => $this->formatDateTime($stamp) ?? $stamp,
                'text' => $text,
            ];
        }

        return $turns;
    }

    /** Plain-text one-line snippet of a note body for list rows. */
    private function buildPreview(string $body): string
    {
        // pnote bodies can carry a "|user|date|" audit prefix + HTML links.
        $text = preg_replace('/\|[^|]*\|[^|]*\|/', ' ', $body) ?? $body;

        // Threads accumulate "YYYY-MM-DD HH:MM (author to x) reply" turns; preview
        // the newest turn (text after the last stamp), like a chat inbox row.
        $stamp = '/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\s*\([^)]*\)\s*/';
        if (preg_match_all($stamp, $text, $m, PREG_OFFSET_CAPTURE) >= 1) {
            [$whole, $start] = $m[0][count($m[0]) - 1];
            $text = substr($text, $start + strlen($whole));
        }

        $text = trim(html_entity_decode(strip_tags($text), ENT_QUOTES, 'UTF-8'));
        $text = (string) preg_replace('/\s+/', ' ', $text);

        return $this->clipText($text, 120);
    }

    /**
     * @param array<string, mixed> $row
     */
    private function rowMatchesSearch(array $row, string $search): bool
    {
        $needle = strtolower($search);
        $haystack = strtolower(implode(' ', array_filter([
            $row['from_name'] ?? '',
            $row['patient_name'] ?? '',
            $row['type'] ?? '',
            $row['status'] ?? '',
        ])));

        return str_contains($haystack, $needle);
    }

    private function normalizeActivity(string $activity): string
    {
        return match ($activity) {
            '0', 'inactive' => '0',
            'all' => 'all',
            default => '1',
        };
    }

    private function normalizeSortBy(string $sortby): string
    {
        $allowed = [
            'pnotes.date',
            'users.lname',
            'patient_data.lname',
            'pnotes.title',
            'pnotes.message_status',
        ];

        return in_array($sortby, $allowed, true) ? $sortby : 'pnotes.date';
    }

    private function formatPatientName(int $pid): string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname FROM patient_data WHERE pid = ? LIMIT 1',
            [$pid]
        );
        if (!is_array($row)) {
            return '';
        }

        return trim(trim((string) ($row['lname'] ?? '')) . ', ' . trim((string) ($row['fname'] ?? '')));
    }

    private function formatUserName(string $username): string
    {
        if ($username === '') {
            return '';
        }

        $row = QueryUtils::querySingleRow(
            'SELECT fname, lname FROM users WHERE username = ? LIMIT 1',
            [$username]
        );
        if (!is_array($row)) {
            return $username;
        }

        $name = trim(trim((string) ($row['lname'] ?? '')) . ', ' . trim((string) ($row['fname'] ?? '')));

        return $name !== '' ? $name : $username;
    }

    private function urgencyLabel(string $urgency): string
    {
        return match ($urgency) {
            'overdue' => 'Overdue',
            'today' => 'Due today',
            default => 'Upcoming',
        };
    }

    private function formatDateTime(?string $date): ?string
    {
        if (empty($date) || str_starts_with((string) $date, '0000-00-00')) {
            return null;
        }

        try {
            // Regional convention is DD/MM/YYYY + 24h (PRD) — this was the only
            // surface still rendering "16 Jul 2026 10:00 PM".
            return (new \DateTime($date))->format('d/m/Y H:i');
        } catch (\Exception) {
            return null;
        }
    }

    private function clipText(string $value, int $max): string
    {
        if (strlen($value) <= $max) {
            return $value;
        }

        return substr($value, 0, $max - 1) . '…';
    }
}
