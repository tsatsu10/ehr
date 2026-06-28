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

        if ($search !== '') {
            $result = getPnotesByUser($activity, $showAll, $authUser, false, $sortby, $sortorder);
            $matched = [];
            while ($row = sqlFetchArray($result)) {
                if (!is_array($row)) {
                    continue;
                }
                $mapped = $this->mapMessageRow($row);
                if ($this->rowMatchesSearch($mapped, $search)) {
                    $matched[] = $mapped;
                }
            }
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

        return [
            'rows' => $rows,
            'total' => $total,
            'begin' => $begin,
            'limit' => $limit,
            'show_all' => $showAll === 'yes',
            'admin_read_only' => $showAll === 'yes',
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

        $pid = (int) ($note['pid'] ?? 0);
        $patientName = $pid > 0 ? $this->formatPatientName($pid) : '';
        $body = (string) ($note['body'] ?? '');
        $threadHtml = function_exists('pnoteConvertLinks')
            ? pnoteConvertLinks($body)
            : nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));

        return [
            'id' => $noteId,
            'from_name' => $this->formatUserName((string) ($note['user'] ?? '')),
            'assigned_to' => (string) ($note['assigned_to'] ?? ''),
            'patient_name' => $patientName,
            'pid' => $pid > 0 ? $pid : null,
            'type' => trim((string) ($note['title'] ?? '')) ?: 'Message',
            'status' => trim((string) ($note['message_status'] ?? '')) ?: null,
            'date' => (string) ($note['date'] ?? ''),
            'date_display' => $this->formatDateTime($note['date'] ?? null),
            'thread_html' => '<div class="msg-thread">' . $threadHtml . '</div>',
            'can_reply' => $isOwner,
            'legacy_reply_url' => $isOwner
                ? ($GLOBALS['webroot'] ?? '')
                . '/interface/main/messages/messages.php?form_active=1&noteid='
                . urlencode((string) $noteId)
                : null,
            'can_delete' => $isOwner,
            'can_mark_done' => $isOwner,
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
        $this->bootstrapLegacyIncludes();

        if (!checkPnotesNoteId($noteId, $authUser)) {
            throw new \RuntimeException('Forbidden', 403);
        }

        updatePnoteMessageStatus($noteId, 'Done');
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
            'preview' => '',
            'is_unread' => $status === 'New',
        ];
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
            return (new \DateTime($date))->format('j M Y g:i A');
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
