<?php

/**
 * M6-F28 — Ghana OPD Background field pack for the HIS history layout
 *
 * Tunes the stock History & Lifestyle layout for West Africa OPD without
 * forking the layout engine (D-HIST-6): hides US-centric screening fields
 * and adds a structured sickle-cell family-history field. Idempotent —
 * safe to re-run; never deletes `history_data` columns.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class HisPackImportService
{
    /** @var array<int, string> US-centric HIS fields hidden by the Ghana pack (§10.2) */
    public const HIDE_FIELDS = [
        'exams',
        'seatbelt_use',
        'hazardous_activities',
    ];

    public const SICKLE_CELL_FIELD = 'relatives_sickle_cell';

    /**
     * @return array{hidden: array<int, string>, added: array<int, string>, already_applied: bool}
     */
    public function applyGhanaOpdPack(int $actorUserId): array
    {
        $hidden = [];
        foreach (self::HIDE_FIELDS as $fieldId) {
            $row = QueryUtils::querySingleRow(
                "SELECT uor FROM layout_options WHERE form_id = 'HIS' AND field_id = ?",
                [$fieldId]
            );
            if (is_array($row) && (int) ($row['uor'] ?? 0) !== 0) {
                QueryUtils::sqlStatementThrowException(
                    "UPDATE layout_options SET uor = 0 WHERE form_id = 'HIS' AND field_id = ?",
                    [$fieldId]
                );
                $hidden[] = $fieldId;
            }
        }

        $added = [];
        if ($this->ensureSickleCellField()) {
            $added[] = self::SICKLE_CELL_FIELD;
        }

        $alreadyApplied = $hidden === [] && $added === [];
        if (!$alreadyApplied) {
            EventAuditLogger::getInstance()->newEvent(
                'new_clinic',
                'admin_hub',
                $actorUserId,
                1,
                'admin_hub.his_pack_applied hidden=' . implode(',', $hidden)
                . ' added=' . implode(',', $added)
            );
        }

        return [
            'hidden' => $hidden,
            'added' => $added,
            'already_applied' => $alreadyApplied,
        ];
    }

    /**
     * @return array{applied: bool, hidden_count: int, sickle_cell_present: bool}
     */
    public function getStatus(): array
    {
        $hiddenCount = 0;
        foreach (self::HIDE_FIELDS as $fieldId) {
            $row = QueryUtils::querySingleRow(
                "SELECT uor FROM layout_options WHERE form_id = 'HIS' AND field_id = ?",
                [$fieldId]
            );
            if (is_array($row) && (int) ($row['uor'] ?? 1) === 0) {
                $hiddenCount++;
            }
        }

        $sickle = QueryUtils::querySingleRow(
            "SELECT uor FROM layout_options WHERE form_id = 'HIS' AND field_id = ?",
            [self::SICKLE_CELL_FIELD]
        );
        $sicklePresent = is_array($sickle) && (int) ($sickle['uor'] ?? 0) > 0;

        return [
            'applied' => $hiddenCount === count(self::HIDE_FIELDS) && $sicklePresent,
            'hidden_count' => $hiddenCount,
            'sickle_cell_present' => $sicklePresent,
        ];
    }

    /**
     * Add "Sickle cell" to the family-conditions group, mirroring the
     * relatives_diabetes field definition. Returns true when newly added.
     */
    private function ensureSickleCellField(): bool
    {
        $existing = QueryUtils::querySingleRow(
            "SELECT field_id FROM layout_options WHERE form_id = 'HIS' AND field_id = ?",
            [self::SICKLE_CELL_FIELD]
        );
        if (is_array($existing)) {
            return false;
        }

        $template = QueryUtils::querySingleRow(
            "SELECT group_id, seq, title, data_type, uor, fld_length, max_length,
                    titlecols, datacols, edit_options, source
             FROM layout_options WHERE form_id = 'HIS' AND field_id = 'relatives_diabetes'"
        );
        if (!is_array($template)) {
            return false;
        }

        $columnExists = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'history_data' AND COLUMN_NAME = ?",
            [self::SICKLE_CELL_FIELD]
        );
        if ((int) ($columnExists['cnt'] ?? 0) === 0) {
            // Layout-managed columns are longtext on history_data (matches siblings).
            QueryUtils::sqlStatementThrowException(
                'ALTER TABLE history_data ADD COLUMN `' . self::SICKLE_CELL_FIELD . '` LONGTEXT'
            );
        }

        QueryUtils::sqlStatementThrowException(
            "INSERT INTO layout_options
                (form_id, field_id, group_id, title, seq, data_type, uor,
                 fld_length, max_length, titlecols, datacols, edit_options, source)
             VALUES ('HIS', ?, ?, 'Sickle cell', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                self::SICKLE_CELL_FIELD,
                (string) $template['group_id'],
                ((int) $template['seq']) + 1,
                (int) $template['data_type'],
                1,
                (int) $template['fld_length'],
                (int) $template['max_length'],
                (int) $template['titlecols'],
                (int) $template['datacols'],
                (string) ($template['edit_options'] ?? ''),
                (string) ($template['source'] ?? 'F'),
            ]
        );

        return true;
    }
}
