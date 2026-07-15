<?php

/**
 * M12 Lab Operations — admin-tunable QC range overrides (D-LAB-QC).
 *
 * The built-in reference/critical ranges live in LabResultValidationService. This service stores
 * ONLY per-clinic overrides in new_lab_qc_rule; a test with no row falls back to the built-in
 * default. Reads are guarded so result entry keeps working even if the table is missing (e.g. a
 * unit test with no database).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class LabQcRuleService
{
    private const NUMERIC_FIELDS = ['warn_min', 'warn_max', 'crit_min', 'crit_max'];

    /** @var array<string, array<string, mixed>>|null Per-request cache. */
    private ?array $cache = null;

    public function __construct(
        private readonly LabOpsAccessService $access = new LabOpsAccessService(),
    ) {
    }

    /**
     * Override rows keyed by uppercase procedure code. Only non-null fields are returned so a
     * partial override (e.g. just crit_min) leaves the rest of the default rule intact. Guarded:
     * returns [] when the table is unavailable so QC never blocks result entry.
     *
     * @return array<string, array<string, mixed>>
     */
    public function overrides(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }

        $this->cache = [];
        try {
            $rows = QueryUtils::fetchRecords(
                'SELECT procedure_code, label, units, warn_min, warn_max, crit_min, crit_max, reference_range
                 FROM new_lab_qc_rule',
                []
            ) ?: [];
        } catch (\Throwable) {
            return $this->cache;
        }

        foreach ($rows as $row) {
            $code = strtoupper(trim((string) ($row['procedure_code'] ?? '')));
            if ($code === '') {
                continue;
            }
            $this->cache[$code] = $this->nonNullFields($row);
        }

        return $this->cache;
    }

    /**
     * Merge a base rule (built-in default, already age/sex-resolved) with any admin override for
     * the same code. Only override fields the admin actually set win.
     *
     * @param array<string, mixed> $rule
     * @return array<string, mixed>
     */
    public function applyOverride(string $procedureCode, array $rule): array
    {
        $code = strtoupper(trim($procedureCode));
        $override = $this->overrides()[$code] ?? null;
        if ($override === null) {
            return $rule;
        }

        return array_merge($rule, $override);
    }

    /**
     * Editor rows: every tunable default merged with its current override, so the admin sees both.
     *
     * @param array<string, array<string, mixed>> $defaults keyed by uppercase code
     * @return array<int, array<string, mixed>>
     */
    public function listForEditor(array $defaults): array
    {
        $this->access->assertCatalogAccess();
        $overrides = $this->overrides();
        $rows = [];
        foreach ($defaults as $code => $default) {
            $code = strtoupper((string) $code);
            $override = $overrides[$code] ?? [];
            $rows[] = [
                'procedure_code' => $code,
                'label' => (string) ($default['label'] ?? $code),
                'units' => (string) ($override['units'] ?? $default['units'] ?? ''),
                'default' => [
                    'warn_min' => $default['warn_min'] ?? null,
                    'warn_max' => $default['warn_max'] ?? null,
                    'crit_min' => $default['crit_min'] ?? null,
                    'crit_max' => $default['crit_max'] ?? null,
                    'reference_range' => (string) ($default['reference_range'] ?? ''),
                ],
                'override' => $override === [] ? null : [
                    'warn_min' => $override['warn_min'] ?? null,
                    'warn_max' => $override['warn_max'] ?? null,
                    'crit_min' => $override['crit_min'] ?? null,
                    'crit_max' => $override['crit_max'] ?? null,
                    'reference_range' => (string) ($override['reference_range'] ?? ''),
                ],
                'has_override' => $override !== [],
            ];
        }

        return $rows;
    }

    /**
     * Upsert an override. Empty numeric fields clear that part of the override (fall back to
     * default). Enforces warn_min <= warn_max and critical band wider than the warn band.
     *
     * @param array<string, mixed> $fields
     * @return array<string, mixed>
     */
    public function saveRule(string $procedureCode, array $fields, int $actorUserId): array
    {
        $this->access->assertCatalogAccess();

        $code = strtoupper(trim($procedureCode));
        if ($code === '') {
            throw new \InvalidArgumentException('Test code is required');
        }

        $warnMin = $this->parseNumber($fields['warn_min'] ?? null);
        $warnMax = $this->parseNumber($fields['warn_max'] ?? null);
        $critMin = $this->parseNumber($fields['crit_min'] ?? null);
        $critMax = $this->parseNumber($fields['crit_max'] ?? null);
        $units = $this->parseText($fields['units'] ?? null, 32);
        $referenceRange = $this->parseText($fields['reference_range'] ?? null, 64);

        if ($warnMin !== null && $warnMax !== null && $warnMin > $warnMax) {
            throw new \InvalidArgumentException('Reference low must be below reference high');
        }
        if ($critMin !== null && $warnMin !== null && $critMin > $warnMin) {
            throw new \InvalidArgumentException('Critical low must be at or below the reference low');
        }
        if ($critMax !== null && $warnMax !== null && $critMax < $warnMax) {
            throw new \InvalidArgumentException('Critical high must be at or above the reference high');
        }

        // Keep the displayed reference range consistent with the tuned warn bounds — otherwise the
        // result form would still show the old "7–18" text while flagging against the new range.
        if ($warnMin !== null && $warnMax !== null) {
            $referenceRange = $this->formatNumber($warnMin) . '–' . $this->formatNumber($warnMax);
        }

        $now = date('Y-m-d H:i:s');
        QueryUtils::sqlStatementThrowException(
            'INSERT INTO new_lab_qc_rule
                (procedure_code, units, warn_min, warn_max, crit_min, crit_max, reference_range, updated_by, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                units = VALUES(units), warn_min = VALUES(warn_min), warn_max = VALUES(warn_max),
                crit_min = VALUES(crit_min), crit_max = VALUES(crit_max),
                reference_range = VALUES(reference_range), updated_by = VALUES(updated_by),
                updated_at = VALUES(updated_at)',
            [$code, $units, $warnMin, $warnMax, $critMin, $critMax, $referenceRange, $actorUserId, $now]
        );
        $this->cache = null;

        return ['procedure_code' => $code, 'saved' => true];
    }

    /**
     * @return array<string, mixed>
     */
    public function resetRule(string $procedureCode, int $actorUserId): array
    {
        $this->access->assertCatalogAccess();
        $code = strtoupper(trim($procedureCode));
        if ($code === '') {
            throw new \InvalidArgumentException('Test code is required');
        }
        QueryUtils::sqlStatementThrowException(
            'DELETE FROM new_lab_qc_rule WHERE procedure_code = ?',
            [$code]
        );
        $this->cache = null;

        return ['procedure_code' => $code, 'reset' => true];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function nonNullFields(array $row): array
    {
        $out = [];
        foreach (self::NUMERIC_FIELDS as $field) {
            if ($row[$field] !== null && $row[$field] !== '') {
                $out[$field] = (float) $row[$field];
            }
        }
        $units = trim((string) ($row['units'] ?? ''));
        if ($units !== '') {
            $out['units'] = $units;
        }
        $range = trim((string) ($row['reference_range'] ?? ''));
        if ($range !== '') {
            $out['reference_range'] = $range;
        }

        return $out;
    }

    private function parseNumber(mixed $value): ?float
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }

    /** Trim a trailing ".0" so a range reads "12–16" not "12.0–16.0". */
    private function formatNumber(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }

    private function parseText(mixed $value, int $max): ?string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            return null;
        }

        return mb_substr($text, 0, $max);
    }
}
