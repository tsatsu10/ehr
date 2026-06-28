<?php

/**
 * Patient profile completion scoring (M1c)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\PatientService;

class PatientCompletionService
{
    /** @var array<int, string> */
    private const NKDA_TITLE_PATTERNS = [
        'nkda',
        'nka',
        'no known allergies',
        'no known allergy',
        'no known drug allergies',
        'no known drug allergy',
        'none known',
        'no allergy',
        'no allergies',
    ];

    private const FIELD_LABELS = [
        'fname' => 'First name',
        'lname' => 'Last name',
        'mname' => 'Middle name',
        'DOB' => 'Date of birth (exact)',
        'sex' => 'Sex',
        'phone_cell' => 'Phone number',
        'street' => 'Street address',
        'city' => 'District',
        'state' => 'Region',
        'region_code' => 'Region',
        'district_code' => 'District',
        'landmark' => 'Landmark',
        'national_id' => 'National ID',
        'emergency_contact' => 'Emergency contact',
        'email' => 'Email',
        'nhis_number' => 'NHIS number',
        'allergies_documented' => 'Allergies (or document None known)',
    ];

    /**
     * @return array{score: int, missing: array<int, string>, missing_labels: array<int, string>, status: string}
     */
    public function recompute(int $pid): array
    {
        $patientService = new PatientService();
        $patient = $patientService->findByPid($pid);
        if (empty($patient)) {
            return ['score' => 0, 'missing' => [], 'missing_labels' => [], 'status' => 'incomplete'];
        }

        $meta = QueryUtils::querySingleRow(
            "SELECT * FROM new_patient_meta WHERE pid = ?",
            [$pid]
        );
        $dobEstimated = is_array($meta) ? (int) ($meta['dob_estimated'] ?? 0) : 0;

        $weights = QueryUtils::fetchRecords(
            "SELECT field_key, weight FROM new_completion_field_weight WHERE is_active = 1 ORDER BY level ASC, field_key ASC"
        ) ?: [];

        if (empty($weights)) {
            $weights = $this->defaultWeights();
        }

        $result = $this->computeScore($weights, $patient, $dobEstimated, $pid, is_array($meta) ? $meta : []);
        $score = $result['score'];
        $missing = $result['missing'];
        $missingLabels = $result['missing_labels'];
        $status = $result['status'];

        QueryUtils::sqlInsert(
            "INSERT INTO new_patient_completion (pid, completion_score, missing_fields_json, last_recomputed_at, status)
             VALUES (?, ?, ?, NOW(), ?)
             ON DUPLICATE KEY UPDATE
                completion_score = VALUES(completion_score),
                missing_fields_json = VALUES(missing_fields_json),
                last_recomputed_at = NOW(),
                status = VALUES(status)",
            [$pid, $score, json_encode($missing), $status]
        );

        return $result;
    }

    /**
     * Pure scoring for unit tests and recompute().
     *
     * @param array<int, array{field_key: string, weight: int}> $weights
     * @param array<string, mixed> $patient
     * @param array<string, mixed> $meta
     * @return array{score: int, missing: array<int, string>, missing_labels: array<int, string>, status: string}
     */
    public function computeScore(array $weights, array $patient, int $dobEstimated, int $pid, array $meta = []): array
    {
        $earned = 0;
        $totalWeight = 0;
        $missing = [];

        foreach ($weights as $row) {
            $fieldKey = (string) ($row['field_key'] ?? '');
            $weight = (int) ($row['weight'] ?? 0);
            if ($fieldKey === '' || $weight <= 0) {
                continue;
            }

            $totalWeight += $weight;
            if ($this->isFieldComplete($fieldKey, $patient, $dobEstimated, $pid, $meta)) {
                $earned += $weight;
            } else {
                $missing[] = $fieldKey;
            }
        }

        $score = $totalWeight > 0 ? (int) round(($earned / $totalWeight) * 100) : 0;
        $score = max(0, min(100, $score));
        $threshold = $this->getBillingThreshold();
        $status = $score >= $threshold ? 'complete' : 'incomplete';

        $missingLabels = array_map(
            fn (string $key) => self::FIELD_LABELS[$key] ?? $key,
            $missing
        );

        return [
            'score' => $score,
            'missing' => $missing,
            'missing_labels' => $missingLabels,
            'status' => $status,
        ];
    }

    /**
     * Read cached completion or recompute when missing.
     *
     * @return array{score: int, missing: array<int, string>, missing_labels: array<int, string>, status: string}
     */
    public function readCached(int $pid, bool $forceRecompute = false): array
    {
        if (!$forceRecompute) {
            $cached = QueryUtils::querySingleRow(
                "SELECT completion_score, missing_fields_json, status FROM new_patient_completion WHERE pid = ?",
                [$pid]
            );
            if (!empty($cached)) {
                $missing = json_decode((string) ($cached['missing_fields_json'] ?? '[]'), true);
                if (!is_array($missing)) {
                    $missing = [];
                }
                $missingLabels = array_map(
                    fn (string $key) => self::FIELD_LABELS[$key] ?? $key,
                    $missing
                );

                return [
                    'score' => (int) ($cached['completion_score'] ?? 0),
                    'missing' => $missing,
                    'missing_labels' => $missingLabels,
                    'status' => (string) ($cached['status'] ?? 'incomplete'),
                ];
            }
        }

        return $this->recompute($pid);
    }

    /**
     * @return array{score: int, missing: array<int, string>, missing_labels: array<int, string>, status: string, demographics_url: string}
     */
    public function snapshot(int $pid, bool $forceRecompute = false): array
    {
        $result = $this->readCached($pid, $forceRecompute);
        $result['demographics_url'] = ($GLOBALS['webroot'] ?? '')
            . '/interface/patient_file/summary/demographics.php?set_pid=' . urlencode((string) $pid);
        $result['chart_url'] = self::chartUrl($pid);
        $result['billing_threshold'] = $this->getBillingThreshold();

        return $result;
    }

    public function getBillingThreshold(): int
    {
        $config = new ClinicConfigService();

        return max(0, min(100, $config->getInt('completion_required_for_billing', 70)));
    }

    public static function chartUrl(int $pid, ?string $tab = 'profile'): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';

        $url = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-chart.php?pid='
            . urlencode((string) $pid);

        if ($tab !== null && $tab !== '') {
            $url .= '&tab=' . urlencode($tab);
        }

        return $url;
    }

    /**
     * @return array<int, array{level: int, label: string, complete: bool, fields: array<int, array{key: string, label: string, complete: bool}>}>
     */
    public function checklistByLevel(int $pid, bool $forceRecompute = false): array
    {
        $snapshot = $this->readCached($pid, $forceRecompute);
        $missing = array_flip($snapshot['missing'] ?? []);

        $weights = QueryUtils::fetchRecords(
            "SELECT field_key, level FROM new_completion_field_weight WHERE is_active = 1 ORDER BY level ASC, field_key ASC"
        ) ?: [];

        if (empty($weights)) {
            $weights = [
                ['field_key' => 'fname', 'level' => 1],
                ['field_key' => 'lname', 'level' => 1],
                ['field_key' => 'mname', 'level' => 1],
                ['field_key' => 'DOB', 'level' => 1],
                ['field_key' => 'sex', 'level' => 1],
                ['field_key' => 'phone_cell', 'level' => 1],
                ['field_key' => 'street', 'level' => 2],
                ['field_key' => 'region_code', 'level' => 2],
                ['field_key' => 'district_code', 'level' => 2],
                ['field_key' => 'landmark', 'level' => 2],
                ['field_key' => 'national_id', 'level' => 2],
                ['field_key' => 'emergency_contact', 'level' => 2],
                ['field_key' => 'email', 'level' => 2],
                ['field_key' => 'allergies_documented', 'level' => 3],
                ['field_key' => 'nhis_number', 'level' => 4],
            ];
        }

        /** @var array<int, array{level: int, label: string, complete: bool, fields: array<int, array{key: string, label: string, complete: bool}>}> $levels */
        $levels = [];
        foreach ($weights as $row) {
            $level = (int) ($row['level'] ?? 1);
            $key = (string) ($row['field_key'] ?? '');
            if ($key === '') {
                continue;
            }

            if (!isset($levels[$level])) {
                $levels[$level] = [
                    'level' => $level,
                    'label' => $this->levelLabel($level),
                    'complete' => true,
                    'fields' => [],
                ];
            }

            $complete = !isset($missing[$key]);
            $levels[$level]['fields'][] = [
                'key' => $key,
                'label' => self::FIELD_LABELS[$key] ?? $key,
                'complete' => $complete,
            ];
            if (!$complete) {
                $levels[$level]['complete'] = false;
            }
        }

        ksort($levels);

        return array_values($levels);
    }

    private function levelLabel(int $level): string
    {
        return match ($level) {
            1 => 'Basic info',
            2 => 'Contact & identity',
            3 => 'Clinical & demographics',
            4 => 'Admin & insurance',
            default => 'Level ' . $level,
        };
    }

    /**
     * True when an allergy list title documents allergies or explicit NKDA.
     */
    public static function isDocumentedAllergyTitle(?string $title): bool
    {
        return trim((string) $title) !== '';
    }

    /**
     * True when the list title is an explicit NKDA / none-known entry (not a real allergen).
     */
    public static function isNkdaOnlyTitle(?string $title): bool
    {
        $normalized = strtolower(trim((string) $title));
        if ($normalized === '') {
            return false;
        }

        foreach (self::NKDA_TITLE_PATTERNS as $pattern) {
            if ($normalized === $pattern) {
                return true;
            }
        }

        return false;
    }

    public static function isAllergiesUnknownTitle(?string $title): bool
    {
        return strtolower(trim((string) $title)) === 'allergies unknown';
    }

    public function hasAllergyDocumentationForPatient(int $pid): bool
    {
        return $this->hasAllergyDocumentation($pid);
    }

    /**
     * @param array<string, mixed> $meta
     * @param array<string, mixed> $patient
     */
    private function isFieldComplete(string $fieldKey, array $patient, int $dobEstimated, int $pid, array $meta = []): bool
    {
        if ($fieldKey === 'allergies_documented') {
            return $this->hasAllergyDocumentation($pid);
        }

        if ($fieldKey === 'emergency_contact') {
            return trim((string) ($meta['emergency_contact_name'] ?? '')) !== ''
                && trim((string) ($meta['emergency_contact_phone'] ?? '')) !== '';
        }

        if ($fieldKey === 'national_id') {
            return trim((string) ($patient['ss'] ?? '')) !== '';
        }

        if ($fieldKey === 'region_code') {
            return trim((string) ($meta['region_code'] ?? '')) !== '';
        }

        if ($fieldKey === 'district_code') {
            return trim((string) ($meta['district_code'] ?? '')) !== '';
        }

        if ($fieldKey === 'landmark') {
            return trim((string) ($meta['landmark'] ?? '')) !== '';
        }

        if ($fieldKey === 'nhis_number') {
            return PatientInsuranceUtil::effectiveType($meta) !== 'nhis'
                || trim((string) ($meta['nhis_number'] ?? '')) !== '';
        }

        if (in_array($fieldKey, ['city', 'state'], true)) {
            return false;
        }

        if ($fieldKey === 'DOB') {
            $dob = $patient['DOB'] ?? '';

            return !empty($dob)
                && $dob !== '0000-00-00'
                && $dobEstimated === 0;
        }

        if ($fieldKey === 'phone_cell') {
            return $this->hasPhone($patient, $meta);
        }

        $value = $patient[$fieldKey] ?? '';

        return trim((string) $value) !== '';
    }

    /**
     * @param array<string, mixed> $patient
     * @param array<string, mixed> $meta
     */
    private function hasPhone(array $patient, array $meta = []): bool
    {
        foreach (['phone_cell', 'phone_home', 'phone_biz'] as $field) {
            if (trim((string) ($patient[$field] ?? '')) !== '') {
                return true;
            }
        }

        if (trim((string) ($meta['reach_contact_phone'] ?? '')) !== '') {
            return true;
        }

        return false;
    }

    private function hasAllergyDocumentation(int $pid): bool
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT title FROM lists WHERE pid = ? AND type = 'allergy' AND activity = 1",
            [$pid]
        ) ?: [];

        foreach ($rows as $row) {
            if (self::isDocumentedAllergyTitle($row['title'] ?? '')) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<int, array{field_key: string, weight: int}>
     */
    private function defaultWeights(): array
    {
        return [
            ['field_key' => 'fname', 'weight' => 12],
            ['field_key' => 'lname', 'weight' => 12],
            ['field_key' => 'mname', 'weight' => 5],
            ['field_key' => 'DOB', 'weight' => 15],
            ['field_key' => 'sex', 'weight' => 8],
            ['field_key' => 'phone_cell', 'weight' => 13],
            ['field_key' => 'street', 'weight' => 8],
            ['field_key' => 'region_code', 'weight' => 3],
            ['field_key' => 'district_code', 'weight' => 2],
            ['field_key' => 'landmark', 'weight' => 2],
            ['field_key' => 'national_id', 'weight' => 8],
            ['field_key' => 'emergency_contact', 'weight' => 5],
            ['field_key' => 'email', 'weight' => 5],
            ['field_key' => 'allergies_documented', 'weight' => 12],
            ['field_key' => 'nhis_number', 'weight' => 5],
        ];
    }
}
