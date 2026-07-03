<?php

/**
 * Admin editor for profile completion field weights (M6-F09)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class CompletionFieldWeightAdminService
{
    public const TARGET_TOTAL = 100;

    /**
     * @return array<string, mixed>
     */
    public function listForAdmin(): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT field_key, level, weight, is_active
             FROM new_completion_field_weight
             ORDER BY level ASC, field_key ASC'
        ) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $fieldKey = (string) ($row['field_key'] ?? '');
            if ($fieldKey === '') {
                continue;
            }

            $level = (int) ($row['level'] ?? 1);
            $items[] = [
                'field_key' => $fieldKey,
                'level' => $level,
                'level_label' => PatientCompletionService::labelForLevel($level),
                'label' => PatientCompletionService::labelForField($fieldKey),
                'weight' => max(0, (int) ($row['weight'] ?? 0)),
                'is_active' => (int) ($row['is_active'] ?? 0) === 1,
            ];
        }

        return [
            'items' => $items,
            'active_total' => $this->sumActiveWeights($items),
            'target_total' => self::TARGET_TOTAL,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    public function saveWeights(array $rows, int $actorUserId): array
    {
        $knownKeys = $this->knownFieldKeys();
        if ($knownKeys === []) {
            throw new \RuntimeException('Completion weights are not configured');
        }

        $normalized = $this->normalizeInputRows($rows, $knownKeys);
        $activeTotal = $this->sumActiveWeights($normalized);
        if ($activeTotal !== self::TARGET_TOTAL) {
            throw new \InvalidArgumentException(
                'Active completion weights must total ' . self::TARGET_TOTAL . ' (currently ' . $activeTotal . ')'
            );
        }

        foreach ($normalized as $row) {
            QueryUtils::sqlStatement(
                'UPDATE new_completion_field_weight SET weight = ?, is_active = ? WHERE field_key = ?',
                [
                    (int) $row['weight'],
                    !empty($row['is_active']) ? 1 : 0,
                    (string) $row['field_key'],
                ]
            );
        }

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'completion_weights',
            $actorUserId,
            1,
            'updated=' . count($normalized)
        );

        return $this->listForAdmin();
    }

    /**
     * @return array<int, string>
     */
    private function knownFieldKeys(): array
    {
        $rows = QueryUtils::fetchRecords(
            'SELECT field_key FROM new_completion_field_weight ORDER BY field_key ASC'
        ) ?: [];

        return array_values(array_filter(array_map(
            static fn (array $row): string => trim((string) ($row['field_key'] ?? '')),
            $rows
        ), static fn (string $key): bool => $key !== ''));
    }

    /**
     * @param array<int, string> $knownKeys
     * @return array<int, array<string, mixed>>
     */
    private function normalizeInputRows(array $rows, array $knownKeys): array
    {
        $knownMap = array_fill_keys($knownKeys, true);
        $byKey = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $fieldKey = trim((string) ($row['field_key'] ?? ''));
            if ($fieldKey === '' || !isset($knownMap[$fieldKey])) {
                continue;
            }

            $weight = (int) ($row['weight'] ?? 0);
            if ($weight < 0 || $weight > self::TARGET_TOTAL) {
                throw new \InvalidArgumentException('Weight for ' . $fieldKey . ' must be between 0 and 100');
            }

            $byKey[$fieldKey] = [
                'field_key' => $fieldKey,
                'weight' => $weight,
                'is_active' => !empty($row['is_active']),
            ];
        }

        if (count($byKey) !== count($knownKeys)) {
            throw new \InvalidArgumentException('All completion fields must be included in the save payload');
        }

        return array_values($byKey);
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function sumActiveWeights(array $items): int
    {
        $total = 0;
        foreach ($items as $item) {
            if (empty($item['is_active'])) {
                continue;
            }

            $total += (int) ($item['weight'] ?? 0);
        }

        return $total;
    }
}
