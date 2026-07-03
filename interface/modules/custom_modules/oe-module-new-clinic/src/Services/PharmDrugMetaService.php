<?php

/**
 * Optional drug metadata for M13 — FDA/EML codes and controlled-substance flags (O-PHARM-5)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PharmDrugMetaService
{
    public const MAX_SCHEDULE_CODE_LEN = 32;

    /**
     * @return list<array{drug_id: int, drug_name: string, is_controlled: bool, controlled_schedule_code: string|null}>
     */
    public function listActiveCatalogFlags(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT d.drug_id, d.name AS drug_name,
                    COALESCE(m.is_controlled, 0) AS is_controlled,
                    m.controlled_schedule_code
             FROM drugs d
             LEFT JOIN new_drug_meta m ON m.drug_id = d.drug_id
             WHERE d.active = 1
             ORDER BY d.name ASC"
        ) ?: [];

        return array_map(static function (array $row): array {
            $schedule = trim((string) ($row['controlled_schedule_code'] ?? ''));

            return [
                'drug_id' => (int) ($row['drug_id'] ?? 0),
                'drug_name' => trim((string) ($row['drug_name'] ?? '')),
                'is_controlled' => (int) ($row['is_controlled'] ?? 0) === 1,
                'controlled_schedule_code' => $schedule !== '' ? $schedule : null,
            ];
        }, $rows);
    }

    public function isControlled(int $drugId): bool
    {
        if ($drugId <= 0) {
            return false;
        }

        $row = sqlQuery(
            "SELECT is_controlled FROM new_drug_meta WHERE drug_id = ? LIMIT 1",
            [$drugId]
        );

        return (int) ($row['is_controlled'] ?? 0) === 1;
    }

    /**
     * @param list<array{drug_id?: mixed, is_controlled?: mixed, controlled_schedule_code?: mixed}> $updates
     */
    public function saveControlledFlags(array $updates): int
    {
        $saved = 0;

        foreach ($updates as $update) {
            $drugId = (int) ($update['drug_id'] ?? 0);
            if ($drugId <= 0) {
                continue;
            }

            $isControlled = !empty($update['is_controlled']) ? 1 : 0;
            $schedule = $this->normalizeScheduleCode($update['controlled_schedule_code'] ?? null);

            if ($isControlled === 0) {
                $schedule = null;
            }

            $this->upsertMeta($drugId, $isControlled, $schedule);
            $saved++;
        }

        return $saved;
    }

    private function normalizeScheduleCode(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $schedule = trim((string) $value);
        if ($schedule === '') {
            return null;
        }

        if (strlen($schedule) > self::MAX_SCHEDULE_CODE_LEN) {
            throw new \InvalidArgumentException('Schedule code is too long');
        }

        return $schedule;
    }

    private function upsertMeta(int $drugId, int $isControlled, ?string $scheduleCode): void
    {
        $existing = sqlQuery("SELECT id FROM new_drug_meta WHERE drug_id = ? LIMIT 1", [$drugId]);
        $now = date('Y-m-d H:i:s');

        if (!empty($existing['id'])) {
            sqlStatement(
                "UPDATE new_drug_meta
                 SET is_controlled = ?, controlled_schedule_code = ?, updated_at = ?
                 WHERE drug_id = ?",
                [$isControlled, $scheduleCode, $now, $drugId]
            );

            return;
        }

        sqlStatement(
            "INSERT INTO new_drug_meta (drug_id, is_controlled, controlled_schedule_code, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)",
            [$drugId, $isControlled, $scheduleCode, $now, $now]
        );
    }
}
