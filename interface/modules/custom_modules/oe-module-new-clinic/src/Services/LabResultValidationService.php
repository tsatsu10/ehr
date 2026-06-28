<?php

/**
 * M12 Lab Operations — result entry QC (ranges, qualitative values, abnormal hints)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class LabResultValidationService
{
    /**
     * OPD starter panel QC — keyed by procedure / result code (uppercase).
     *
     * @var array<string, array<string, mixed>>
     */
    private const TEST_RULES = [
        'HB' => [
            'type' => 'numeric',
            'label' => 'Haemoglobin',
            'min' => 3.0,
            'max' => 25.0,
            'warn_min' => 7.0,
            'warn_max' => 18.0,
            'units' => 'g/dL',
            'reference_range' => '7–18',
        ],
        'HGB' => [
            'type' => 'numeric',
            'label' => 'Haemoglobin',
            'min' => 3.0,
            'max' => 25.0,
            'warn_min' => 7.0,
            'warn_max' => 18.0,
            'units' => 'g/dL',
            'reference_range' => '7–18',
        ],
        'GLU_F' => [
            'type' => 'numeric',
            'label' => 'Glucose (fasting)',
            'min' => 20.0,
            'max' => 600.0,
            'warn_min' => 70.0,
            'warn_max' => 110.0,
            'units' => 'mg/dL',
            'reference_range' => '70–110',
        ],
        'WBC' => [
            'type' => 'numeric',
            'label' => 'WBC',
            'min' => 0.5,
            'max' => 50.0,
            'warn_min' => 4.0,
            'warn_max' => 11.0,
            'units' => '10³/µL',
            'reference_range' => '4–11',
        ],
        'HCT' => [
            'type' => 'numeric',
            'label' => 'Haematocrit',
            'min' => 10.0,
            'max' => 70.0,
            'warn_min' => 36.0,
            'warn_max' => 48.0,
            'units' => '%',
            'reference_range' => '36–48',
        ],
        'PLT' => [
            'type' => 'numeric',
            'label' => 'Platelets',
            'min' => 10.0,
            'max' => 1000.0,
            'warn_min' => 150.0,
            'warn_max' => 400.0,
            'units' => '10³/µL',
            'reference_range' => '150–400',
        ],
        'MAL_RDT' => [
            'type' => 'qualitative',
            'label' => 'Malaria RDT',
            'allowed' => ['negative', 'positive', 'invalid', 'indeterminate'],
            'abnormal_values' => ['positive'],
            'abnormal_flag' => 'yes',
        ],
        'HCG' => [
            'type' => 'qualitative',
            'label' => 'Pregnancy test',
            'allowed' => ['negative', 'positive', 'invalid'],
            'abnormal_values' => ['positive'],
            'abnormal_flag' => 'yes',
        ],
        'UA_DIP' => [
            'type' => 'text',
            'label' => 'Urinalysis',
            'min_length' => 1,
            'warn_substrings' => ['blood', 'protein', 'glucose', 'ketone', 'leukocyte', 'nitrite', 'positive', 'abnormal'],
            'warn_message' => 'Dipstick may indicate abnormality — confirm and set Abnormal if needed',
        ],
    ];

    /**
     * Rules for client-side validation, keyed by procedure_order_seq.
     *
     * @param array<int, array<string, mixed>> $lines
     * @return array<string, mixed>
     */
    public function getFormRulesForLines(array $lines): array
    {
        $bySeq = [];
        foreach ($lines as $line) {
            $seq = (int) ($line['procedure_order_seq'] ?? 0);
            if ($seq <= 0) {
                continue;
            }
            $code = (string) ($line['procedure_code'] ?? '');
            $rule = $this->resolveRule($code);
            $bySeq[(string) $seq] = array_merge($rule, [
                'procedure_code' => $code,
                'procedure_name' => (string) ($line['procedure_name'] ?? ''),
                'field_key' => $this->fieldKey($seq),
            ]);
        }

        return [
            'rules_by_seq' => $bySeq,
            'abnormal_options' => ['', 'yes', 'high', 'low'],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $orderLines
     * @param array<int, array<string, mixed>> $payloadLines
     * @return array{
     *   errors: array<int, string>,
     *   warnings: array<int, string>,
     *   field_errors: array<string, string>,
     *   field_warnings: array<string, string>,
     *   normalized_lines: array<int, array<string, mixed>>
     * }
     */
    public function validateSave(array $orderLines, array $payloadLines, bool $draft): array
    {
        $errors = [];
        $warnings = [];
        $fieldErrors = [];
        $fieldWarnings = [];
        $payloadBySeq = $this->indexPayloadLines($payloadLines);
        $normalized = [];

        foreach ($orderLines as $orderLine) {
            $seq = (int) ($orderLine['procedure_order_seq'] ?? 0);
            if ($seq <= 0) {
                continue;
            }

            $code = (string) ($orderLine['procedure_code'] ?? '');
            $label = (string) ($orderLine['procedure_name'] ?? $code ?: 'Test');
            $rule = $this->resolveRule($code);
            $payloadLine = $payloadBySeq[$seq] ?? [];
            $resultPayload = $this->firstResultPayload($payloadLine);
            $value = trim((string) ($resultPayload['result'] ?? ''));
            $fieldKey = $this->fieldKey($seq);

            if ($value === '') {
                if (!$draft) {
                    $message = $label . ' result is required';
                    $errors[] = $message;
                    $fieldErrors[$fieldKey] = $message;
                }
                $normalized[] = $this->normalizePayloadLine($seq, $payloadLine, $resultPayload, $code, $rule);
                continue;
            }

            $check = $this->evaluateValue($code, $value, $rule, $label);
            if ($check['error'] !== null) {
                $errors[] = $check['error'];
                $fieldErrors[$fieldKey] = $check['error'];
            }
            if ($check['warning'] !== null) {
                $warnings[] = $check['warning'];
                $fieldWarnings[$fieldKey] = $check['warning'];
            }

            $normalizedResult = $resultPayload;
            $normalizedResult['result'] = $check['normalized_value'] ?? $value;
            if (trim((string) ($normalizedResult['units'] ?? '')) === '' && !empty($rule['units'])) {
                $normalizedResult['units'] = (string) $rule['units'];
            }
            if (trim((string) ($normalizedResult['range'] ?? '')) === '' && !empty($rule['reference_range'])) {
                $normalizedResult['range'] = (string) $rule['reference_range'];
            }
            if (trim((string) ($normalizedResult['abnormal'] ?? '')) === '' && $check['suggested_abnormal'] !== null) {
                $normalizedResult['abnormal'] = $check['suggested_abnormal'];
            }

            $normalized[] = $this->normalizePayloadLine($seq, $payloadLine, $normalizedResult, $code, $rule);
        }

        if ($orderLines === []) {
            $errors[] = 'No test lines on this order';
        }

        return [
            'errors' => $errors,
            'warnings' => array_values(array_unique($warnings)),
            'field_errors' => $fieldErrors,
            'field_warnings' => $fieldWarnings,
            'normalized_lines' => $normalized,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $orderLines
     * @return array{errors: array<int, string>, warnings: array<int, string>}
     */
    public function validateForRelease(array $orderLines): array
    {
        $errors = [];
        $warnings = [];

        foreach ($orderLines as $orderLine) {
            $seq = (int) ($orderLine['procedure_order_seq'] ?? 0);
            if ($seq <= 0) {
                continue;
            }

            $code = (string) ($orderLine['procedure_code'] ?? '');
            $label = (string) ($orderLine['procedure_name'] ?? $code ?: 'Test');
            $rule = $this->resolveRule($code);
            $result = $this->firstResultFromLine($orderLine);
            $value = trim((string) ($result['result'] ?? ''));

            if ($value === '') {
                $errors[] = $label . ' has no result — complete entry before release';
                continue;
            }

            $check = $this->evaluateValue($code, $value, $rule, $label);
            if ($check['error'] !== null) {
                $errors[] = $check['error'];
            }
            if ($check['warning'] !== null) {
                $warnings[] = $check['warning'];
            }
        }

        return [
            'errors' => $errors,
            'warnings' => array_values(array_unique($warnings)),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function enrichLine(array $line): array
    {
        $code = (string) ($line['procedure_code'] ?? '');
        $rule = $this->resolveRule($code);
        $line['qc'] = [
            'type' => $rule['type'],
            'units' => $rule['units'] ?? '',
            'reference_range' => $rule['reference_range'] ?? '',
            'allowed' => $rule['allowed'] ?? [],
            'hint' => $this->buildHint($rule),
        ];

        return $line;
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveRule(string $procedureCode): array
    {
        $key = strtoupper(trim($procedureCode));
        if ($key !== '' && isset(self::TEST_RULES[$key])) {
            return self::TEST_RULES[$key];
        }

        $catalog = $this->lookupCatalogRule($procedureCode);
        if ($catalog !== null) {
            return $catalog;
        }

        return [
            'type' => 'text',
            'label' => $procedureCode !== '' ? $procedureCode : 'Result',
            'min_length' => 1,
        ];
    }

    public function suggestAbnormal(string $procedureCode, string $value): ?string
    {
        $check = $this->evaluateValue(
            $procedureCode,
            $value,
            $this->resolveRule($procedureCode),
            $procedureCode
        );

        return $check['suggested_abnormal'];
    }

    public function fieldKey(int $procedureOrderSeq): string
    {
        return 'line_' . $procedureOrderSeq . '_result';
    }

    /**
     * @param array<string, mixed> $rule
     * @return array{error: ?string, warning: ?string, suggested_abnormal: ?string, normalized_value: ?string}
     */
    private function evaluateValue(string $procedureCode, string $value, array $rule, string $label): array
    {
        $trimmed = trim($value);
        $type = (string) ($rule['type'] ?? 'text');

        if ($type === 'numeric') {
            if (!is_numeric($trimmed)) {
                return [
                    'error' => $label . ' must be numeric',
                    'warning' => null,
                    'suggested_abnormal' => null,
                    'normalized_value' => null,
                ];
            }

            $num = (float) $trimmed;
            $min = (float) ($rule['min'] ?? 0);
            $max = (float) ($rule['max'] ?? PHP_FLOAT_MAX);
            if ($num < $min || $num > $max) {
                return [
                    'error' => $label . " must be between {$min} and {$max}",
                    'warning' => null,
                    'suggested_abnormal' => null,
                    'normalized_value' => (string) $num,
                ];
            }

            $warning = null;
            $suggested = null;
            if (isset($rule['warn_min'], $rule['warn_max'])) {
                $warnMin = (float) $rule['warn_min'];
                $warnMax = (float) $rule['warn_max'];
                if ($num < $warnMin) {
                    $warning = $label . ' below reference range';
                    $suggested = 'low';
                } elseif ($num > $warnMax) {
                    $warning = $label . ' above reference range';
                    $suggested = 'high';
                }
            }

            return [
                'error' => null,
                'warning' => $warning,
                'suggested_abnormal' => $suggested,
                'normalized_value' => (string) $num,
            ];
        }

        if ($type === 'qualitative') {
            $normalized = strtolower($trimmed);
            $allowed = array_map('strtolower', $rule['allowed'] ?? []);
            if ($allowed !== [] && !in_array($normalized, $allowed, true)) {
                return [
                    'error' => $label . ' must be one of: ' . implode(', ', $allowed),
                    'warning' => null,
                    'suggested_abnormal' => null,
                    'normalized_value' => null,
                ];
            }

            $abnormalValues = array_map('strtolower', $rule['abnormal_values'] ?? []);
            $suggested = in_array($normalized, $abnormalValues, true)
                ? (string) ($rule['abnormal_flag'] ?? 'yes')
                : null;

            return [
                'error' => null,
                'warning' => $suggested !== null ? $label . ' is positive — review before release' : null,
                'suggested_abnormal' => $suggested,
                'normalized_value' => $normalized,
            ];
        }

        $minLength = (int) ($rule['min_length'] ?? 1);
        if (strlen($trimmed) < $minLength) {
            return [
                'error' => $label . ' result is required',
                'warning' => null,
                'suggested_abnormal' => null,
                'normalized_value' => null,
            ];
        }

        $warning = null;
        $warnSubstrings = $rule['warn_substrings'] ?? [];
        if ($warnSubstrings !== []) {
            $lower = strtolower($trimmed);
            foreach ($warnSubstrings as $needle) {
                if (str_contains($lower, strtolower((string) $needle))) {
                    $warning = (string) ($rule['warn_message'] ?? ($label . ' may be abnormal'));
                    break;
                }
            }
        }

        return [
            'error' => null,
            'warning' => $warning,
            'suggested_abnormal' => null,
            'normalized_value' => $trimmed,
        ];
    }

    /**
     * @param array<string, mixed> $rule
     */
    private function buildHint(array $rule): string
    {
        $type = (string) ($rule['type'] ?? 'text');
        if ($type === 'numeric' && isset($rule['reference_range'], $rule['units'])) {
            return 'Expected ' . $rule['reference_range'] . ' ' . $rule['units'];
        }
        if ($type === 'qualitative' && !empty($rule['allowed'])) {
            return 'Enter: ' . implode(', ', $rule['allowed']);
        }

        return '';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lookupCatalogRule(string $procedureCode): ?array
    {
        $code = trim($procedureCode);
        if ($code === '') {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            "SELECT name, units, `range`
             FROM procedure_type
             WHERE procedure_code = ? AND procedure_type = 'res' AND activity = 1
             ORDER BY procedure_type_id DESC
             LIMIT 1",
            [$code]
        );

        if (!is_array($row)) {
            return null;
        }

        $units = trim((string) ($row['units'] ?? ''));
        $rangeText = trim((string) ($row['range'] ?? ''));
        $name = trim((string) ($row['name'] ?? $code));

        if ($rangeText !== '' && preg_match('/^([\d.]+)\s*[-–]\s*([\d.]+)$/', $rangeText, $matches)) {
            $warnMin = (float) $matches[1];
            $warnMax = (float) $matches[2];
            $span = max($warnMax - $warnMin, 1.0);

            return [
                'type' => 'numeric',
                'label' => $name,
                'min' => max(0, $warnMin - $span),
                'max' => $warnMax + $span,
                'warn_min' => $warnMin,
                'warn_max' => $warnMax,
                'units' => $units,
                'reference_range' => $rangeText,
            ];
        }

        if ($units !== '' || $rangeText !== '') {
            return [
                'type' => 'text',
                'label' => $name,
                'min_length' => 1,
                'units' => $units,
                'reference_range' => $rangeText,
            ];
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $payloadLines
     * @return array<int, array<string, mixed>>
     */
    private function indexPayloadLines(array $payloadLines): array
    {
        $indexed = [];
        foreach ($payloadLines as $line) {
            if (!is_array($line)) {
                continue;
            }
            $seq = (int) ($line['procedure_order_seq'] ?? 0);
            if ($seq > 0) {
                $indexed[$seq] = $line;
            }
        }

        return $indexed;
    }

    /**
     * @param array<string, mixed> $payloadLine
     * @return array<string, mixed>
     */
    private function firstResultPayload(array $payloadLine): array
    {
        $results = $payloadLine['results'] ?? [];
        if (!is_array($results) || $results === []) {
            return [];
        }

        $first = $results[0];

        return is_array($first) ? $first : [];
    }

    /**
     * @param array<string, mixed> $orderLine
     * @return array<string, mixed>
     */
    private function firstResultFromLine(array $orderLine): array
    {
        $results = $orderLine['results'] ?? [];
        if (!is_array($results) || $results === []) {
            return [];
        }

        $first = $results[0];

        return is_array($first) ? $first : [];
    }

    /**
     * @param array<string, mixed> $payloadLine
     * @param array<string, mixed> $resultPayload
     * @param array<string, mixed> $rule
     * @return array<string, mixed>
     */
    private function normalizePayloadLine(
        int $seq,
        array $payloadLine,
        array $resultPayload,
        string $code,
        array $rule
    ): array {
        return [
            'procedure_order_seq' => $seq,
            'procedure_report_id' => $payloadLine['procedure_report_id'] ?? null,
            'date_collected' => $payloadLine['date_collected'] ?? null,
            'date_report' => $payloadLine['date_report'] ?? null,
            'specimen_num' => $payloadLine['specimen_num'] ?? '',
            'procedure_code' => $code,
            'results' => [$resultPayload],
        ];
    }
}
