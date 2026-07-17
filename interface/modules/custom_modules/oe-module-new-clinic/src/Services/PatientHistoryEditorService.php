<?php

/**
 * Native background / history editor for the MRD Clinical tab (GAP-D D-HIST-9).
 *
 * Supersedes D-HIST-1 (which kept the stock History editor for V1) with a curated,
 * West-Africa-first field set: family narrative + structured relative conditions
 * (including sickle cell / G6PD), social/lifestyle (including herbal / traditional
 * medicine and occupation), past-medical narrative, and Ghana screening dates.
 *
 * Writes the canonical `history_data` table — one row per patient (D-HIST-2, no parallel
 * store). Only the whitelisted columns below are touched, so any stock-only HIS layout
 * fields are preserved and stay editable in the stock editor.
 *
 * Fields with no dedicated stock column live in reserved spare columns. These were
 * verified free of the HIS layout, which only claims `usertext11` ("Risk Factors"):
 *   usertext12 = family sickle cell / G6PD    usertext13 = herbal / traditional medicine
 *   usertext14 = occupation                   userdate11 = last BP check date
 *   userdate12 = last glucose check date
 * Do not reassign these columns in the HIS layout without updating this map.
 *
 * Behind `enable_native_history_editor` (PRD §5.6, default OFF); the stock editor stays the
 * fallback and one click away until parity sign-off. Edit ACL mirrors the stock History
 * editor exactly (`patients` / `med`).
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

class PatientHistoryEditorService
{
    /** Free-text fields: logical key => history_data column. */
    private const TEXT_COLUMNS = [
        'family_mother' => 'history_mother',
        'family_father' => 'history_father',
        'family_siblings' => 'history_siblings',
        'tobacco' => 'tobacco',
        'alcohol' => 'alcohol',
        'recreational_drugs' => 'recreational_drugs',
        'exercise' => 'exercise_patterns',
        'herbal_medicine' => 'usertext13',
        'occupation' => 'usertext14',
        'past_medical_history' => 'additional_history',
        'last_hb' => 'last_hemoglobin',
        // D-HIST-10 full-form only (quick editor never sends this key):
        'sleep' => 'sleep_patterns',
    ];

    /** Columns backed by varchar in the schema — capped short to avoid truncation errors. */
    private const SHORT_TEXT_COLUMNS = ['usertext13', 'usertext14', 'last_hemoglobin'];

    /** Structured family-condition markers: logical key => column (stored 'yes' or ''). */
    private const CONDITION_COLUMNS = [
        'sickle_cell' => 'usertext12',
        'hypertension' => 'relatives_high_blood_pressure',
        'diabetes' => 'relatives_diabetes',
        'heart' => 'relatives_heart_problems',
        'stroke' => 'relatives_stroke',
        'tuberculosis' => 'relatives_tuberculosis',
        'cancer' => 'relatives_cancer',
        'epilepsy' => 'relatives_epilepsy',
        'mental_illness' => 'relatives_mental_illness',
        // D-HIST-10 full-form only (behind an "Add more" reveal):
        'suicide' => 'relatives_suicide',
    ];

    /** Date fields (YYYY-MM-DD): logical key => column. */
    private const DATE_COLUMNS = [
        'last_bp_date' => 'userdate11',
        'last_glucose_date' => 'userdate12',
    ];

    // D-HIST-10 — risk factors multi-select. Stored in reserved spare columns, NOT the stock
    // "Risk Factors" column (usertext11): the stock list uses its own option-id format, so we
    // keep it pristine and avoid a round-trip conflict. Selected keys comma-joined in usertext15,
    // free-text "Other" in usertext16. Both verified free of the HIS layout.
    private const RISK_FACTORS_COL = 'usertext15';
    private const RISK_OTHER_COL = 'usertext16';

    /** WHO-PEN-aligned risk-factor keys (labels live in the frontend). */
    public const RISK_FACTOR_KEYS = [
        'tobacco', 'alcohol', 'inactivity', 'obesity', 'hypertension', 'diabetes',
        'fh_cvd', 'sickle', 'hiv', 'tb', 'pregnancy', 'herbal',
    ];

    // Generous bound for the longtext/text narrative fields (history_*, additional_history):
    // a sanity cap against oversized payloads, not a truncation of real narratives.
    private const TEXT_MAX = 10000;
    // Cap for the varchar(255)-backed spare columns (usertext13/14, last_hemoglobin).
    private const SHORT_TEXT_MAX = 250;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isEnabled(?int $facilityId = null): bool
    {
        return $this->config->isEnabled('enable_native_history_editor', 0, $facilityId);
    }

    /** D-HIST-10 — the full native History form replacing stock history_full.php. */
    public function isFullFormEnabled(?int $facilityId = null): bool
    {
        return $this->config->isEnabled('enable_native_history_full_form', 0, $facilityId);
    }

    /**
     * Current curated background fields, for pre-filling the editor form.
     *
     * @return array<string, mixed>
     */
    public function getForEdit(int $pid): array
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Invalid patient', 400);
        }

        $columns = array_merge(
            array_values(self::TEXT_COLUMNS),
            array_values(self::CONDITION_COLUMNS),
            array_values(self::DATE_COLUMNS),
            [self::RISK_FACTORS_COL, self::RISK_OTHER_COL]
        );
        $select = '`' . implode('`, `', $columns) . '`';
        $row = QueryUtils::querySingleRow(
            "SELECT $select FROM history_data WHERE pid = ? ORDER BY id DESC LIMIT 1",
            [$pid]
        ) ?: [];

        $text = [];
        foreach (self::TEXT_COLUMNS as $key => $col) {
            $text[$key] = (string) ($row[$col] ?? '');
        }
        $conditions = [];
        foreach (self::CONDITION_COLUMNS as $key => $col) {
            $conditions[$key] = trim((string) ($row[$col] ?? '')) !== '';
        }
        $dates = [];
        foreach (self::DATE_COLUMNS as $key => $col) {
            $dates[$key] = $this->dateOnly($row[$col] ?? null);
        }

        // Risk factors (full form): stored keys → array, filtered to the known set.
        $storedRisk = array_filter(array_map('trim', explode(',', (string) ($row[self::RISK_FACTORS_COL] ?? ''))));
        $riskFactors = array_values(array_intersect($storedRisk, self::RISK_FACTOR_KEYS));

        $webroot = rtrim((string) ($GLOBALS['webroot'] ?? ''), '/');

        return [
            'text' => $text,
            'family_conditions' => $conditions,
            'dates' => $dates,
            'risk_factors' => $riskFactors,
            'risk_other' => (string) ($row[self::RISK_OTHER_COL] ?? ''),
            // Escape hatch to the full stock editor for any HIS field not managed here.
            'stock_editor_url' => $webroot
                . '/interface/patient_file/history/history_full.php?set_pid=' . $pid,
        ];
    }

    /**
     * Persist the curated background fields. Only whitelisted columns are written.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function save(int $pid, array $input, int $actorUserId): array
    {
        if (!$this->isEnabled()) {
            throw new \RuntimeException('Native history editor is not enabled', 403);
        }
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Invalid patient', 400);
        }
        // Same ACL gate as the stock History & Lifestyle editor.
        if (!AclMain::aclCheckCore('patients', 'med', '', ['write', 'addonly'])) {
            throw new \RuntimeException('You do not have permission to edit history', 403);
        }

        // Partial update: only write columns whose logical key is PRESENT in the payload, so the
        // quick editor and the full editor can each save their own subset without blanking the
        // fields the other one owns. Absent key = leave the column untouched.
        $writeCols = [];
        $values = [];

        $text = (array) ($input['text'] ?? []);
        foreach (self::TEXT_COLUMNS as $key => $col) {
            if (!array_key_exists($key, $text)) {
                continue;
            }
            $max = in_array($col, self::SHORT_TEXT_COLUMNS, true) ? self::SHORT_TEXT_MAX : self::TEXT_MAX;
            $writeCols[] = $col;
            $values[] = mb_substr(trim((string) $text[$key]), 0, $max);
        }

        $conditions = (array) ($input['family_conditions'] ?? []);
        foreach (self::CONDITION_COLUMNS as $key => $col) {
            if (!array_key_exists($key, $conditions)) {
                continue;
            }
            $writeCols[] = $col;
            $values[] = !empty($conditions[$key]) ? 'yes' : '';
        }

        $dates = (array) ($input['dates'] ?? []);
        foreach (self::DATE_COLUMNS as $key => $col) {
            if (!array_key_exists($key, $dates)) {
                continue;
            }
            $writeCols[] = $col;
            $values[] = $this->normalizeDate($dates[$key] ?? null);
        }

        // Risk factors (full form only): present when the payload carries the key.
        if (array_key_exists('risk_factors', $input)) {
            $keys = array_values(array_intersect(
                array_map(static fn($k): string => (string) $k, (array) $input['risk_factors']),
                self::RISK_FACTOR_KEYS
            ));
            $writeCols[] = self::RISK_FACTORS_COL;
            $values[] = mb_substr(implode(',', $keys), 0, self::SHORT_TEXT_MAX);
        }
        if (array_key_exists('risk_other', $input)) {
            $writeCols[] = self::RISK_OTHER_COL;
            $values[] = mb_substr(trim((string) $input['risk_other']), 0, self::SHORT_TEXT_MAX);
        }

        if ($writeCols === []) {
            return ['id' => 0, 'status' => 'ok', 'noop' => true];
        }

        $existing = QueryUtils::querySingleRow(
            "SELECT id FROM history_data WHERE pid = ? ORDER BY id DESC LIMIT 1",
            [$pid]
        );

        if (!empty($existing['id'])) {
            $assignments = array_map(static fn(string $c): string => "`$c` = ?", $writeCols);
            $sql = "UPDATE history_data SET " . implode(', ', $assignments) . ", `date` = NOW() WHERE id = ?";
            $params = $values;
            $params[] = (int) $existing['id'];
            QueryUtils::sqlStatementThrowException($sql, $params);
            $rowId = (int) $existing['id'];
        } else {
            $insertCols = array_merge($writeCols, ['pid', 'created_by']);
            $placeholders = array_fill(0, count($insertCols), '?');
            $sql = "INSERT INTO history_data (`" . implode('`, `', $insertCols) . "`, `date`) VALUES ("
                . implode(', ', $placeholders) . ", NOW())";
            $params = $values;
            $params[] = $pid;
            $params[] = $actorUserId;
            $rowId = (int) QueryUtils::sqlInsert($sql, $params);
        }

        EventAuditLogger::getInstance()->newEvent(
            'chart.history_edit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            1,
            'saved history_data id=' . $rowId . ' pid=' . $pid . ' uid=' . $actorUserId,
            $pid
        );

        return ['id' => $rowId, 'status' => 'ok'];
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
