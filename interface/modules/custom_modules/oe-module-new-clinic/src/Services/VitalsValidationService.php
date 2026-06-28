<?php

/**
 * Triage vitals validation and unit normalization (M3-F03 / M3-F14)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Services\VitalsService;

class VitalsValidationService
{
    private const REQUIRED_FIELDS = ['bps', 'bpd', 'pulse', 'temperature', 'weight'];

    /** @var array<string, array{min: float, max: float, label: string, step: float}> */
    private const NUMERIC_FIELDS = [
        'bps' => ['min' => 40, 'max' => 300, 'label' => 'BP sys', 'step' => 1],
        'bpd' => ['min' => 20, 'max' => 200, 'label' => 'BP dia', 'step' => 1],
        'pulse' => ['min' => 20, 'max' => 250, 'label' => 'Pulse', 'step' => 1],
        'temperature' => ['min' => 30, 'max' => 45, 'label' => 'Temperature', 'step' => 0.1],
        'weight' => ['min' => 0.5, 'max' => 500, 'label' => 'Weight', 'step' => 0.1],
        'height' => ['min' => 20, 'max' => 280, 'label' => 'Height', 'step' => 0.1],
        'oxygen_saturation' => ['min' => 50, 'max' => 100, 'label' => 'SpO2', 'step' => 1],
        'respiration' => ['min' => 4, 'max' => 60, 'label' => 'Resp. rate', 'step' => 1],
        'pain' => ['min' => 0, 'max' => 10, 'label' => 'Pain', 'step' => 1],
    ];

    /**
     * Rules for triage form QA — shared with client-side validation.
     *
     * @return array<string, mixed>
     */
    public function getFormRules(): array
    {
        $fields = [];
        foreach (self::NUMERIC_FIELDS as $key => $def) {
            $fields[$key] = array_merge($def, [
                'required' => in_array($key, self::REQUIRED_FIELDS, true),
                'unit' => $this->fieldUnit($key),
            ]);
            $warn = $this->warningThresholds($key);
            if ($warn !== null) {
                $fields[$key]['warn_min'] = $warn['min'];
                $fields[$key]['warn_max'] = $warn['max'];
                $fields[$key]['warn_message'] = $warn['message'];
            }
        }

        return [
            'temperature_unit' => $this->formTemperatureUnitLabel(),
            'required' => self::REQUIRED_FIELDS,
            'fields' => $fields,
        ];
    }

    /**
     * @param array<string, mixed> $vitals
     * @return array{payload: array<string, mixed>, warnings: array<int, string>, errors: array<int, string>, field_errors: array<string, string>, field_warnings: array<string, string>}
     */
    public function validateForTriage(array $vitals): array
    {
        $errors = [];
        $fieldErrors = [];
        $fieldWarnings = [];
        $payload = [];

        foreach (self::REQUIRED_FIELDS as $field) {
            if (!array_key_exists($field, $vitals) || $vitals[$field] === '' || $vitals[$field] === null) {
                $label = self::NUMERIC_FIELDS[$field]['label'] ?? ucfirst(str_replace('_', ' ', $field));
                $message = $label . ' is required';
                $errors[] = $message;
                $fieldErrors[$field] = $message;
            }
        }

        foreach (self::NUMERIC_FIELDS as $field => $def) {
            if (!array_key_exists($field, $vitals) || $vitals[$field] === '' || $vitals[$field] === null) {
                continue;
            }

            $label = $def['label'];
            if (!is_numeric($vitals[$field])) {
                $message = $label . ' must be numeric';
                $errors[] = $message;
                $fieldErrors[$field] = $message;
                continue;
            }

            $value = (float) $vitals[$field];
            $min = $def['min'];
            $max = $def['max'];
            if ($value < $min || $value > $max) {
                $message = $label . " must be between {$min} and {$max}";
                $errors[] = $message;
                $fieldErrors[$field] = $message;
                continue;
            }

            $payload[$field] = $value;
            $warning = $this->evaluateFieldWarning($field, $value);
            if ($warning !== null) {
                $fieldWarnings[$field] = $warning;
            }
        }

        if (!empty($errors)) {
            return [
                'payload' => [],
                'warnings' => [],
                'errors' => $errors,
                'field_errors' => $fieldErrors,
                'field_warnings' => [],
            ];
        }

        if (isset($payload['temperature'])) {
            $payload['temperature'] = $this->normalizeTemperatureForStorage((float) $payload['temperature']);
        }

        $evalInput = $payload;
        if (isset($payload['temperature'])) {
            $evalInput['temperature'] = $this->temperatureForEvaluation($payload['temperature']);
        }

        $warnings = $this->evaluateWarnings($evalInput);
        foreach ($fieldWarnings as $field => $message) {
            if (!in_array($message, $warnings, true)) {
                $warnings[] = $message;
            }
        }

        return [
            'payload' => $payload,
            'warnings' => $warnings,
            'errors' => [],
            'field_errors' => [],
            'field_warnings' => $fieldWarnings,
        ];
    }

    private function evaluateFieldWarning(string $field, float $value): ?string
    {
        $thresholds = $this->warningThresholds($field);
        if ($thresholds === null || $value <= 0) {
            return null;
        }

        if ($field === 'oxygen_saturation') {
            if ($value < $thresholds['min']) {
                return $thresholds['message'];
            }

            return null;
        }

        if ($value < $thresholds['min'] || $value > $thresholds['max']) {
            return $thresholds['message'];
        }

        return null;
    }

    /**
     * @return array{min: float, max: float, message: string}|null
     */
    private function warningThresholds(string $field): ?array
    {
        return match ($field) {
            'bps' => ['min' => 90, 'max' => 180, 'message' => 'Systolic BP outside normal range'],
            'bpd' => ['min' => 60, 'max' => 110, 'message' => 'Diastolic BP outside normal range'],
            'pulse' => ['min' => 50, 'max' => 120, 'message' => 'Pulse outside normal range'],
            'temperature' => ['min' => 35, 'max' => 38.5, 'message' => 'Temperature outside normal range'],
            'oxygen_saturation' => ['min' => 94, 'max' => 100, 'message' => 'SpO2 below 94%'],
            'respiration' => ['min' => 10, 'max' => 24, 'message' => 'Respiratory rate outside normal range'],
            default => null,
        };
    }

    private function fieldUnit(string $field): string
    {
        return match ($field) {
            'temperature' => $this->formTemperatureUnitLabel(),
            'weight' => 'kg',
            'height' => 'cm',
            'oxygen_saturation' => '%',
            'pain' => '0–10',
            default => '',
        };
    }

    /**
     * @param array<string, float> $vitals
     * @return array<int, string>
     */
    public function evaluateWarnings(array $vitals): array
    {
        $warnings = [];

        $bps = (float) ($vitals['bps'] ?? 0);
        $bpd = (float) ($vitals['bpd'] ?? 0);
        $pulse = (float) ($vitals['pulse'] ?? 0);
        $temp = (float) ($vitals['temperature'] ?? 0);
        $spo2 = (float) ($vitals['oxygen_saturation'] ?? 0);
        $resp = (float) ($vitals['respiration'] ?? 0);

        if ($bps > 0 && ($bps < 90 || $bps > 180)) {
            $warnings[] = 'Systolic BP outside normal range';
        }
        if ($bpd > 0 && ($bpd < 60 || $bpd > 110)) {
            $warnings[] = 'Diastolic BP outside normal range';
        }
        if ($pulse > 0 && ($pulse < 50 || $pulse > 120)) {
            $warnings[] = 'Pulse outside normal range';
        }
        if ($temp > 0 && ($temp < 35 || $temp > 38.5)) {
            $warnings[] = 'Temperature outside normal range';
        }
        if ($spo2 > 0 && $spo2 < 94) {
            $warnings[] = 'SpO2 below 94%';
        }
        if ($resp > 0 && ($resp < 10 || $resp > 24)) {
            $warnings[] = 'Respiratory rate outside normal range';
        }

        return $warnings;
    }

    /**
     * Form input is Celsius; convert to OpenEMR storage units when needed.
     */
    public function normalizeTemperatureForStorage(float $celsiusInput): float
    {
        if ($this->persistsMetric()) {
            return round($celsiusInput, 1);
        }

        return round(($celsiusInput * 9 / 5) + 32, 1);
    }

    /**
     * Convert stored temperature to Celsius for threshold checks.
     */
    public function temperatureForEvaluation(float $storedTemperature): float
    {
        if ($this->persistsMetric()) {
            return $storedTemperature;
        }

        return round(($storedTemperature - 32) * 5 / 9, 1);
    }

    public function temperatureUnitLabel(): string
    {
        return $this->persistsMetric() ? '°C' : '°F';
    }

    /**
     * Triage form always accepts Celsius regardless of storage units.
     */
    public function formTemperatureUnitLabel(): string
    {
        return '°C';
    }

    private function persistsMetric(): bool
    {
        $units = (int) ($GLOBALS['units_of_measurement'] ?? VitalsService::MEASUREMENT_PERSIST_IN_USA);

        return in_array($units, [
            VitalsService::MEASUREMENT_PERSIST_IN_METRIC,
            VitalsService::MEASUREMENT_METRIC_ONLY,
        ], true);
    }
}
