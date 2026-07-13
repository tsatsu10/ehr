<?php

/**
 * Scoped list_options editor for the Admin Hub Forms tab (GAP-C C3, closes W7 lists half).
 *
 * A native editor for the handful of `list_options` lists a cash clinic actually
 * curates day-to-day — grounded in what the module consumes and what exists in the
 * DB, NOT a generic edit_list.php replacement. Everything outside the allow-list
 * stays in stock `edit_list.php` via the Forms tab gateway. Pharmacy sig lists
 * (drug_form/route/…) are deliberately left to C4's pharm-ops home to avoid a
 * duplicate editor. All writes are allow-list gated so this can never touch a
 * system/CDR list.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class AdminListEditorService
{
    /**
     * Allow-list of clinic-editable lists (list_id => human label). Every entry is a
     * list the module DEMONSTRABLY reads from `list_options` AND is safe for a clinic
     * admin to rename/reorder/toggle (no option_value semantics the module depends on):
     *   - immunizations             → PatientChartClinicalService (vaccine display)
     *   - external_patient_education → PatientEducationService (handout sources)
     *   - note_type / message_status → CommunicationsHubService (patient messaging)
     * Deliberately NOT `payment_method`: the cashier hardcodes cash/MoMo
     * (CashierService), so editing that stock list would be a misleading no-op.
     * Pharmacy sig lists (drug_*) stay in C4's pharm-ops home.
     *
     * @var array<string, string>
     */
    public const EDITABLE_LISTS = [
        'immunizations' => 'Immunizations / vaccines',
        'external_patient_education' => 'Patient education sources',
        'note_type' => 'Patient message note types',
        'message_status' => 'Message statuses',
    ];

    /**
     * Editable lists with their current option counts.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getCatalog(): array
    {
        $catalog = [];
        foreach (self::EDITABLE_LISTS as $listId => $label) {
            $row = QueryUtils::querySingleRow(
                "SELECT COUNT(*) AS n, SUM(activity = 1) AS active FROM list_options WHERE list_id = ?",
                [$listId]
            );
            $catalog[] = [
                'list_id' => $listId,
                'label' => $label,
                'option_count' => (int) ($row['n'] ?? 0),
                'active_count' => (int) ($row['active'] ?? 0),
            ];
        }

        return $catalog;
    }

    /**
     * Options for one allow-listed list.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getOptions(string $listId): array
    {
        $this->assertEditable($listId);

        $rows = QueryUtils::fetchRecords(
            "SELECT option_id, title, seq, activity
             FROM list_options
             WHERE list_id = ?
             ORDER BY seq ASC, title ASC",
            [$listId]
        ) ?: [];

        return array_map(static function (array $row): array {
            return [
                'option_id' => (string) ($row['option_id'] ?? ''),
                'title' => (string) ($row['title'] ?? ''),
                'seq' => (int) ($row['seq'] ?? 0),
                'active' => (int) ($row['activity'] ?? 0) === 1,
            ];
        }, $rows);
    }

    /**
     * Add or rename/reorder one option. Add when option_id is empty (a slug is
     * derived from the title); otherwise update the existing option's title + seq.
     *
     * @param array{option_id?: string, title?: string, seq?: mixed} $input
     * @return array<int, array<string, mixed>>
     */
    public function saveOption(string $listId, array $input, int $actorUserId): array
    {
        $this->assertEditable($listId);

        $optionId = mb_substr(trim((string) ($input['option_id'] ?? '')), 0, 100);
        $title = mb_substr(trim((string) ($input['title'] ?? '')), 0, 255);
        $seq = (int) ($input['seq'] ?? 0);
        if ($title === '') {
            throw new \InvalidArgumentException('A label is required');
        }

        if ($optionId !== '' && $this->optionExists($listId, $optionId)) {
            sqlStatement(
                "UPDATE list_options SET title = ?, seq = ? WHERE list_id = ? AND option_id = ?",
                [$title, $seq, $listId, $optionId]
            );
            $action = 'updated';
        } else {
            $optionId = $this->uniqueOptionId($listId, $optionId !== '' ? $optionId : $title);
            if ($seq === 0) {
                $seq = $this->nextSeq($listId);
            }
            sqlStatement(
                "INSERT INTO list_options (list_id, option_id, title, seq, activity) VALUES (?, ?, ?, ?, 1)",
                [$listId, $optionId, $title, $seq]
            );
            $action = 'created';
        }

        $this->audit($actorUserId, $action . ' list=' . $listId . ' option=' . $optionId);

        return $this->getOptions($listId);
    }

    /**
     * Activate or deactivate one option (deactivate = hide, never hard-delete).
     *
     * @return array<int, array<string, mixed>>
     */
    public function setActive(string $listId, string $optionId, bool $active, int $actorUserId): array
    {
        $this->assertEditable($listId);
        $optionId = trim($optionId);
        if ($optionId === '' || !$this->optionExists($listId, $optionId)) {
            throw new \InvalidArgumentException('Option not found');
        }

        sqlStatement(
            "UPDATE list_options SET activity = ? WHERE list_id = ? AND option_id = ?",
            [$active ? 1 : 0, $listId, $optionId]
        );

        $this->audit($actorUserId, ($active ? 'activated' : 'deactivated') . ' list=' . $listId . ' option=' . $optionId);

        return $this->getOptions($listId);
    }

    private function assertEditable(string $listId): void
    {
        if (!isset(self::EDITABLE_LISTS[$listId])) {
            throw new \InvalidArgumentException('This list is not editable here — use the stock list editor');
        }
    }

    private function optionExists(string $listId, string $optionId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT 1 AS ok FROM list_options WHERE list_id = ? AND option_id = ? LIMIT 1",
            [$listId, $optionId]
        );

        return is_array($row) && !empty($row['ok']);
    }

    private function nextSeq(string $listId): int
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COALESCE(MAX(seq), 0) + 10 AS next_seq FROM list_options WHERE list_id = ?",
            [$listId]
        );

        return (int) ($row['next_seq'] ?? 10);
    }

    /** Derive a unique, DB-safe option_id (<=100 chars) from a seed string. */
    private function uniqueOptionId(string $listId, string $seed): string
    {
        $base = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $seed) ?? '');
        $base = trim($base, '_');
        if ($base === '') {
            $base = 'opt';
        }
        $base = mb_substr($base, 0, 90);

        $candidate = $base;
        $suffix = 2;
        while ($this->optionExists($listId, $candidate)) {
            $candidate = mb_substr($base, 0, 90) . '_' . $suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function audit(int $actorUserId, string $detail): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'admin_hub.list_editor',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            $detail . ' uid=' . $actorUserId
        );
    }
}
