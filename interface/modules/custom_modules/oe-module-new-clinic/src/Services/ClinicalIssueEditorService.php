<?php

/**
 * Native issue (problem/allergy/medication) editor for the MRD Clinical tab (GAP-D D4, closes W10).
 *
 * Replaces the stock add_edit_issue.php popup for the common edits. Writes go through
 * core OpenEMR `PatientIssuesService` (createIssue/updateIssue) so column whitelisting,
 * type validation, and UUID handling stay canonical. Crucially, `updateIssue` only SETs
 * the fields we send — so coded fields we deliberately don't manage here (diagnosis,
 * severity_al, occurrence) are PRESERVED, never clobbered, and stay editable in the stock
 * popup. Per-type write ACL mirrors stock exactly (`AclMain::aclCheckIssue`). Behind
 * `enable_native_issue_editor` (PRD §5.6, default OFF); delete stays on the stock popup.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\PatientIssuesService;

class ClinicalIssueEditorService
{
    /** Issue types the native drawer handles (must exist in issue_types). */
    public const EDITABLE_TYPES = [
        'medical_problem', 'allergy', 'medication', 'medical_device', 'surgery', 'health_concern',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isEnabled(?int $facilityId = null): bool
    {
        return $this->config->isEnabled('enable_native_issue_editor', 0, $facilityId);
    }

    /**
     * Load one issue's editable fields, scoped to the patient.
     *
     * @return array<string, mixed>
     */
    public function getIssue(int $pid, int $id): array
    {
        if ($pid <= 0 || $id <= 0) {
            throw new \InvalidArgumentException('Invalid issue reference', 400);
        }
        $row = QueryUtils::querySingleRow(
            "SELECT id, pid, type, title, begdate, enddate, comments, reaction, severity_al, diagnosis
             FROM lists WHERE id = ? AND pid = ?",
            [$id, $pid]
        );
        if (empty($row)) {
            throw new \InvalidArgumentException('Issue not found', 404);
        }

        $type = (string) ($row['type'] ?? '');
        $webroot = rtrim((string) ($GLOBALS['webroot'] ?? ''), '/');

        return [
            'id' => (int) $row['id'],
            'type' => $type,
            'title' => (string) ($row['title'] ?? ''),
            'begdate' => $this->dateOnly($row['begdate'] ?? null),
            'enddate' => $this->dateOnly($row['enddate'] ?? null),
            'comments' => (string) ($row['comments'] ?? ''),
            'reaction' => (string) ($row['reaction'] ?? ''),
            // Read-only context so the drawer can show what stock-only fields hold.
            'has_diagnosis_code' => trim((string) ($row['diagnosis'] ?? '')) !== '',
            // Escape hatch to the stock editor for delete + coded diagnosis/severity,
            // which this native drawer deliberately does not handle.
            'stock_editor_url' => $webroot . '/interface/patient_file/summary/add_edit_issue.php?issue='
                . (int) $row['id'] . '&type=' . urlencode($type) . '&set_pid=' . (int) $pid,
        ];
    }

    /**
     * Create or update an issue. Returns the saved id.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function saveIssue(int $pid, array $input, int $actorUserId): array
    {
        if (!$this->isEnabled()) {
            throw new \RuntimeException('Native issue editor is not enabled', 403);
        }
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Invalid patient', 400);
        }

        $type = trim((string) ($input['type'] ?? ''));
        if (!in_array($type, self::EDITABLE_TYPES, true)) {
            throw new \InvalidArgumentException('Unsupported issue type');
        }
        $id = (int) ($input['id'] ?? 0);

        // Canonical per-type issue-write ACL, mirroring stock add_edit_issue.php.
        $permission = $id > 0 ? 'write' : ['write', 'addonly'];
        if (!AclMain::aclCheckIssue($type, '', $permission)) {
            throw new \RuntimeException('You do not have permission to edit this issue type', 403);
        }

        $title = mb_substr(trim((string) ($input['title'] ?? '')), 0, 255);
        if ($title === '') {
            throw new \InvalidArgumentException('A title is required');
        }

        // Only the fields the native drawer manages. Omitted columns (diagnosis,
        // severity_al, occurrence) are left untouched by updateIssue → preserved.
        $record = [
            'pid' => $pid,
            'type' => $type,
            'title' => $title,
            'begdate' => $this->normalizeDate($input['begdate'] ?? null),
            'enddate' => $this->normalizeDate($input['enddate'] ?? null),
            'comments' => trim((string) ($input['comments'] ?? '')),
            'activity' => 1,
        ];
        if ($type === 'allergy') {
            $record['reaction'] = mb_substr(trim((string) ($input['reaction'] ?? '')), 0, 255);
        }

        // If a scoped issue id was given, confirm it belongs to this patient before update.
        if ($id > 0) {
            $owner = QueryUtils::querySingleRow("SELECT id FROM lists WHERE id = ? AND pid = ?", [$id, $pid]);
            if (empty($owner)) {
                throw new \InvalidArgumentException('Issue not found for this patient', 404);
            }
            $record['id'] = $id;
        }

        $service = new PatientIssuesService();
        if ($id > 0) {
            $service->updateIssue($record);
            $savedId = $id;
            $action = 'updated';
        } else {
            $saved = $service->createIssue($record);
            $savedId = (int) ($saved['id'] ?? 0);
            $action = 'created';
        }

        EventAuditLogger::getInstance()->newEvent(
            'chart.issue_edit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            $action . ' type=' . $type . ' id=' . $savedId . ' pid=' . $pid . ' uid=' . $actorUserId,
            $pid
        );

        return ['id' => $savedId, 'type' => $type, 'status' => 'ok'];
    }

    /** Accept 'YYYY-MM-DD' (or empty) → DB date or null. */
    private function normalizeDate(mixed $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            throw new \InvalidArgumentException('Dates must be YYYY-MM-DD');
        }

        return $value;
    }

    private function dateOnly(mixed $value): string
    {
        $value = trim((string) $value);
        if ($value === '' || str_starts_with($value, '0000')) {
            return '';
        }

        return substr($value, 0, 10);
    }
}
