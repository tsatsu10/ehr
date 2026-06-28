<?php

/**
 * Shared vitals summary and preview enrichment for clinical desks
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Services\EncounterService;

class VitalsPreviewBuilder
{
    public function __construct(
        private readonly VitalsValidationService $vitalsValidation = new VitalsValidationService(),
    ) {
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getEncounterVitals(int $pid, int $encounter): array
    {
        $encounterService = new EncounterService();

        return $encounterService->getVitals($pid, $encounter) ?: [];
    }

    /**
     * @param array<int, array<string, mixed>> $vitalsRows
     * @return array<int, string>
     */
    public function evaluateWarnings(array $vitalsRows): array
    {
        if (empty($vitalsRows)) {
            return [];
        }

        $latest = $vitalsRows[count($vitalsRows) - 1];
        $eval = [
            'bps' => (float) ($latest['bps'] ?? 0),
            'bpd' => (float) ($latest['bpd'] ?? 0),
            'pulse' => (float) ($latest['pulse'] ?? 0),
            'oxygen_saturation' => (float) ($latest['oxygen_saturation'] ?? 0),
            'respiration' => (float) ($latest['respiration'] ?? 0),
        ];

        if (!empty($latest['temperature'])) {
            $eval['temperature'] = $this->vitalsValidation->temperatureForEvaluation((float) $latest['temperature']);
        }

        return $this->vitalsValidation->evaluateWarnings($eval);
    }

    /**
     * @param array<int, array<string, mixed>> $vitalsRows
     */
    public function hasCompleteTriageVitalsFromRows(array $vitalsRows): bool
    {
        if ($vitalsRows === []) {
            return false;
        }

        $latest = $vitalsRows[count($vitalsRows) - 1];
        foreach (['bps', 'bpd', 'pulse', 'temperature', 'weight'] as $field) {
            if (!array_key_exists($field, $latest) || $latest[$field] === '' || $latest[$field] === null) {
                return false;
            }
        }

        return true;
    }

    public function hasCompleteTriageVitals(int $pid, int $encounter): bool
    {
        if ($pid <= 0 || $encounter <= 0) {
            return false;
        }

        return $this->hasCompleteTriageVitalsFromRows($this->getEncounterVitals($pid, $encounter));
    }

    /**
     * @param array<string, mixed> $preview
     * @param array<int, array<string, mixed>> $vitalsRows
     * @param array<int, string> $warnings
     * @return array<string, mixed>
     */
    public function mergeIntoPreview(array $preview, array $vitalsRows, array $warnings, bool $extended = false): array
    {
        if (empty($vitalsRows)) {
            $preview['vitals_today'] = [
                'summary' => null,
                'vitals_missing_today' => true,
                'vitals_abnormal_today' => false,
                'vitals_breach_list' => [],
                'pain_score' => null,
            ];

            return $preview;
        }

        $latest = $vitalsRows[count($vitalsRows) - 1];
        $parts = [];
        if (!empty($latest['bps']) || !empty($latest['bpd'])) {
            $parts[] = 'BP ' . ($latest['bps'] ?? '—') . '/' . ($latest['bpd'] ?? '—');
        }
        if (!empty($latest['pulse'])) {
            $parts[] = 'HR ' . $latest['pulse'];
        }
        if (!empty($latest['temperature'])) {
            $temp = $this->vitalsValidation->temperatureForEvaluation((float) $latest['temperature']);
            $parts[] = 'T ' . $temp . ' °C';
        }
        if ($extended) {
            if (!empty($latest['oxygen_saturation'])) {
                $parts[] = 'SpO2 ' . $latest['oxygen_saturation'] . '%';
            }
            if (!empty($latest['respiration'])) {
                $parts[] = 'RR ' . $latest['respiration'];
            }
        }

        $vitalsToday = [
            'summary' => implode(' · ', $parts),
            'vitals_missing_today' => false,
            'vitals_abnormal_today' => !empty($warnings),
            'vitals_breach_list' => $warnings,
            'pain_score' => $extended ? ($latest['pain'] ?? null) : null,
        ];

        if ($extended) {
            $vitalsToday['record_count'] = count($vitalsRows);
        }

        $preview['vitals_today'] = $vitalsToday;

        return $preview;
    }

    /**
     * @param array<int, array<string, mixed>> $vitalsRows
     * @return array<string, mixed>
     */
    public function formatLatestForForm(array $vitalsRows): array
    {
        if (empty($vitalsRows)) {
            return [];
        }

        $latest = $vitalsRows[count($vitalsRows) - 1];
        if (!empty($latest['temperature'])) {
            $latest['temperature'] = $this->vitalsValidation->temperatureForEvaluation((float) $latest['temperature']);
        }

        return $latest;
    }
}
