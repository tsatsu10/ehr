<?php

/**
 * Patient chart Messages tab read models (B7 / MRD tab 5)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PatientChartMessagesService
{
    public const PAGE_SIZE = 20;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getMessagesPayload(int $pid, int $offset = 0, int $limit = self::PAGE_SIZE): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $webroot = $GLOBALS['webroot'] ?? '';

        $messageTotal = $this->countPatientMessages($pid);
        $messages = $this->fetchPatientMessages($pid, $offset, $limit);
        $reminders = array_merge(
            $this->fetchDatedReminders($pid),
            $this->fetchPatientRuleReminders($pid)
        );

        usort($reminders, static function (array $a, array $b): int {
            return strcmp((string) ($b['sort_date'] ?? ''), (string) ($a['sort_date'] ?? ''));
        });
        $reminders = array_slice($reminders, 0, 15);

        return [
            'messages' => $messages,
            'reminders' => $reminders,
            'message_total' => $messageTotal,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($messages)) < $messageTotal,
            'editor_urls' => [
                'pnotes' => $webroot
                    . '/interface/patient_file/summary/pnotes_full.php?set_pid='
                    . urlencode((string) $pid),
                'add_message' => $webroot
                    . '/interface/patient_file/summary/pnotes_full_add.php?set_pid='
                    . urlencode((string) $pid),
                'dated_reminders' => $webroot
                    . '/interface/main/dated_reminders/dated_reminders.php',
            ],
        ];
    }

    private function countPatientMessages(int $pid): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM pnotes WHERE pid = ? AND deleted != 1',
            [$pid]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchPatientMessages(int $pid, int $offset, int $limit): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT id, date, user, assigned_to, title, body, message_status, activity
             FROM pnotes
             WHERE pid = ? AND deleted != 1
             ORDER BY date DESC, id DESC
             LIMIT ' . (int) $limit . ' OFFSET ' . (int) $offset,
            [$pid]
        ) ?: [];

        $webroot = $GLOBALS['webroot'] ?? '';

        return array_map(function (array $row) use ($webroot, $pid): array {
            $id = (int) ($row['id'] ?? 0);
            $assignedTo = trim((string) ($row['assigned_to'] ?? ''));

            return [
                'id' => $id,
                'type' => 'message',
                'title' => trim((string) ($row['title'] ?? '')) ?: 'Message',
                'preview' => $this->clipMessageBody((string) ($row['body'] ?? '')),
                'author' => trim((string) ($row['user'] ?? '')),
                'assigned_to' => $assignedTo === '-patient-' ? 'Patient' : $assignedTo,
                'date' => $this->formatDateTime($row['date'] ?? null),
                'status' => trim((string) ($row['message_status'] ?? '')) ?: null,
                'active' => (int) ($row['activity'] ?? 0) === 1,
                'detail_url' => $webroot
                    . '/interface/patient_file/summary/pnotes_full.php?set_pid='
                    . urlencode((string) $pid)
                    . '&noteid='
                    . urlencode((string) $id),
            ];
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchDatedReminders(int $pid): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT dr.dr_id, dr.dr_message_text, dr.dr_message_due_date, dr.message_processed,
                    u.fname, u.lname
             FROM dated_reminders dr
             JOIN users u ON dr.dr_from_ID = u.id
             WHERE dr.pid = ?
             ORDER BY dr.dr_message_due_date DESC, dr.dr_id DESC
             LIMIT 15',
            [$pid]
        ) ?: [];

        return array_map(function (array $row): array {
            $dueDate = (string) ($row['dr_message_due_date'] ?? '');
            $processed = (int) ($row['message_processed'] ?? 0) === 1;
            $fromName = trim(trim((string) ($row['fname'] ?? '')) . ' ' . trim((string) ($row['lname'] ?? '')));

            return [
                'id' => (int) ($row['dr_id'] ?? 0),
                'type' => 'dated_reminder',
                'title' => $processed ? 'Reminder (done)' : 'Reminder due',
                'preview' => $this->clipMessageBody((string) ($row['dr_message_text'] ?? '')),
                'author' => $fromName !== '' ? $fromName : 'Staff',
                'assigned_to' => null,
                'date' => $this->formatDateTime($dueDate !== '0000-00-00 00:00:00' ? $dueDate : null),
                'status' => $processed ? 'Processed' : 'Pending',
                'active' => !$processed,
                'sort_date' => $dueDate,
                'detail_url' => null,
            ];
        }, $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchPatientRuleReminders(int $pid): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT pr.id, pr.date_created, pr.due_status,
                    lo.title AS category_title, lo2.title AS item_title
             FROM patient_reminders pr
             LEFT JOIN list_options lo
                ON lo.option_id = pr.category AND lo.list_id = 'rule_action_category' AND lo.activity = 1
             LEFT JOIN list_options lo2
                ON lo2.option_id = pr.item AND lo2.list_id = 'rule_action' AND lo2.activity = 1
             WHERE pr.pid = ? AND pr.active = 1
             ORDER BY pr.date_created DESC
             LIMIT 10",
            [$pid]
        ) ?: [];

        return array_map(function (array $row): array {
            $category = trim((string) ($row['category_title'] ?? ''));
            $item = trim((string) ($row['item_title'] ?? ''));
            $label = $category !== '' && $item !== '' ? $category . ': ' . $item : ($item ?: $category ?: 'Clinical reminder');
            $created = (string) ($row['date_created'] ?? '');

            return [
                'id' => (int) ($row['id'] ?? 0),
                'type' => 'patient_reminder',
                'title' => trim((string) ($row['due_status'] ?? '')) ?: 'Reminder',
                'preview' => $label,
                'author' => 'Clinical rules',
                'assigned_to' => null,
                'date' => $this->formatDateTime($created),
                'status' => trim((string) ($row['due_status'] ?? '')) ?: null,
                'active' => true,
                'sort_date' => $created,
                'detail_url' => null,
            ];
        }, $rows);
    }

    private function clipMessageBody(string $body): string
    {
        $body = preg_replace('/\s+/u', ' ', trim($body)) ?? '';

        return $this->clipText($body, 200);
    }

    private function clipText(string $value, int $max): string
    {
        if (strlen($value) <= $max) {
            return $value;
        }

        return substr($value, 0, $max - 1) . '…';
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
}
