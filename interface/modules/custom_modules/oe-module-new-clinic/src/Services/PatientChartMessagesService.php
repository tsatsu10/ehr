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
     * @param string $activity 'all' (default — matches the pre-CP-5 list),
     *                         'active' or 'inactive' (native filter, flag ON UI)
     * @return array<string, mixed>
     */
    public function getMessagesPayload(int $pid, int $offset = 0, int $limit = self::PAGE_SIZE, string $activity = 'all'): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $activity = in_array($activity, ['active', 'inactive'], true) ? $activity : 'all';
        $webroot = $GLOBALS['webroot'] ?? '';
        $nativeNotes = $this->isNativeNotesEnabled();

        $messageTotal = $this->countPatientMessages($pid, $activity);
        $messages = $this->fetchPatientMessages($pid, $offset, $limit, $activity, $nativeNotes);
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
            'editor_urls' => $this->buildEditorUrls($pid, $webroot),
            // CP-5 — flag ON: rows open the native detail modal and the tab's
            // own activity filter replaces the stock "All notes" screen.
            'native_notes' => $nativeNotes,
            'activity' => $activity,
        ];
    }

    /** CP-5 — facility-scoped native patient-notes flag. */
    protected function isNativeNotesEnabled(): bool
    {
        $facilityId = (new VisitScopeService())->resolveDeskFacilityId();

        return (new ClinicConfigService())->getInt('enable_native_patient_notes', 0, $facilityId) === 1;
    }

    /**
     * CP-5 — native per-note detail (thread view). Read access mirrors stock
     * pnotes_full: any staff member the chart-read path already authorised may
     * view ALL of the patient's notes — ownership only gates edits, which this
     * viewer deliberately does not offer (create routes to the Communications
     * hub, edits stay on the stock screen).
     *
     * @return array<string, mixed>
     */
    public function getNoteDetail(int $pid, int $noteId): array
    {
        $this->facilityScope->assertPatientAccessible($pid);
        if (!$this->isNativeNotesEnabled()) {
            throw new \RuntimeException('Native patient notes are not enabled', 403);
        }
        if ($noteId <= 0) {
            throw new \InvalidArgumentException('Note id is required');
        }

        $note = QueryUtils::querySingleRow(
            'SELECT id, date, user, assigned_to, title, body, message_status, activity
             FROM pnotes
             WHERE id = ? AND pid = ? AND deleted != 1
             LIMIT 1',
            [$noteId, $pid]
        );
        if (!is_array($note)) {
            throw new \RuntimeException('Note not found', 404);
        }

        $threadHtml = self::renderThreadHtml((string) ($note['body'] ?? ''));
        $assignedTo = trim((string) ($note['assigned_to'] ?? ''));

        return [
            'id' => (int) ($note['id'] ?? 0),
            'title' => trim((string) ($note['title'] ?? '')) ?: 'Message',
            'author' => trim((string) ($note['user'] ?? '')),
            'assigned_to' => $assignedTo === '-patient-' ? 'Patient' : $assignedTo,
            'date' => $this->formatDateTime($note['date'] ?? null),
            'status' => trim((string) ($note['message_status'] ?? '')) ?: null,
            'active' => (int) ($note['activity'] ?? 0) === 1,
            'thread_html' => '<div class="msg-thread">' . $threadHtml . '</div>',
        ];
    }

    /**
     * Escape FIRST, then linkify: stock pnoteConvertLinks only wraps URLs in
     * anchors and does NOT escape, so linkifying the raw body would let a note
     * containing markup execute in the viewer (XSS). Public static so the
     * escape ordering is pinned by a unit test.
     */
    public static function renderThreadHtml(string $body): string
    {
        $escaped = nl2br(htmlspecialchars($body, ENT_QUOTES, 'UTF-8'));

        return function_exists('pnoteConvertLinks')
            ? pnoteConvertLinks($escaped)
            : $escaped;
    }

    /**
     * New message / Reminders route to the native Communications hub when it is
     * enabled for the facility (flag OFF keeps the stock pnotes screens, PRD
     * §5.6). "All notes" stays stock either way — the hub has no per-patient
     * note list, so swapping it would lose function.
     *
     * @return array<string, string>
     */
    private function buildEditorUrls(int $pid, string $webroot): array
    {
        $facilityId = (new VisitScopeService())->resolveDeskFacilityId();
        $hubOn = (new ClinicConfigService())->isEnabled('communications_hub_enable', 0, $facilityId);
        $hubUrl = $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/communications.php';

        return [
            // CP-5 — flag ON: the tab's own filter replaces the stock list.
            'pnotes' => $this->isNativeNotesEnabled()
                ? null
                : $webroot
                    . '/interface/patient_file/summary/pnotes_full.php?set_pid='
                    . urlencode((string) $pid),
            'add_message' => $hubOn
                ? $hubUrl . '?task=addnew&pid=' . urlencode((string) $pid)
                : $webroot
                    . '/interface/patient_file/summary/pnotes_full_add.php?set_pid='
                    . urlencode((string) $pid),
            'dated_reminders' => $hubOn
                ? $hubUrl . '?lens=reminders'
                : $webroot . '/interface/main/dated_reminders/dated_reminders.php',
        ];
    }

    private function countPatientMessages(int $pid, string $activity = 'all'): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS cnt FROM pnotes WHERE pid = ? AND deleted != 1' . self::activityClause($activity),
            [$pid]
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    private static function activityClause(string $activity): string
    {
        if ($activity === 'active') {
            return ' AND activity = 1';
        }
        if ($activity === 'inactive') {
            return ' AND activity = 0';
        }

        return '';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchPatientMessages(
        int $pid,
        int $offset,
        int $limit,
        string $activity = 'all',
        bool $nativeNotes = false
    ): array {
        $rows = QueryUtils::fetchRecords(
            'SELECT id, date, user, assigned_to, title, body, message_status, activity
             FROM pnotes
             WHERE pid = ? AND deleted != 1' . self::activityClause($activity) . '
             ORDER BY date DESC, id DESC
             LIMIT ' . (int) $limit . ' OFFSET ' . (int) $offset,
            [$pid]
        ) ?: [];

        $webroot = $GLOBALS['webroot'] ?? '';

        return array_map(function (array $row) use ($webroot, $pid, $nativeNotes): array {
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
                // CP-5 — flag ON: the row opens the native modal instead.
                'detail_url' => $nativeNotes
                    ? null
                    : $webroot
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
            // Regional convention is DD/MM/YYYY + 24h (matches CommunicationsHubService).
            return (new \DateTime($date))->format('d/m/Y H:i');
        } catch (\Exception) {
            return null;
        }
    }
}
