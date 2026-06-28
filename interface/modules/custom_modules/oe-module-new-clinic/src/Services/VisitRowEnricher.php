<?php

/**
 * Shared visit row enrichment for queue cards and boards
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class VisitRowEnricher
{
    /**
     * @param array<string, mixed> $row
     * @param array<int, bool>|null $skippedTriageMap visit_id => skipped
     * @return array<string, mixed>
     */
    public function enrichVisitRow(array $row, ?int $visitId = null, ?array $skippedTriageMap = null): array
    {
        $visitId = $visitId ?? (int) ($row['id'] ?? 0);
        $row['display_name'] = trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
        $row['age_years'] = self::ageFromDob($row['DOB'] ?? null);
        $waitMins = self::waitMinutes($row['started_at'] ?? null);
        $row['wait_minutes'] = $waitMins;
        $row['wait_label'] = self::formatWaitLabel($waitMins);
        if ($skippedTriageMap !== null) {
            $row['skipped_triage'] = !empty($skippedTriageMap[$visitId]);
        } else {
            $row['skipped_triage'] = $this->hasSkippedTriage($visitId);
        }
        $row['visit_type_label'] = $row['visit_type_label'] ?? 'Visit';

        return $row;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, bool>
     */
    public function batchSkippedTriage(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, fn ($id) => $id > 0)));
        if (empty($visitIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT DISTINCT visit_id FROM new_visit_state_log
             WHERE visit_id IN ($placeholders)
             AND from_state = 'waiting' AND to_state = 'ready_for_doctor'",
            $visitIds
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $map[(int) ($row['visit_id'] ?? 0)] = true;
        }

        return $map;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, int>
     */
    public function batchLabOrderCounts(array $visitIds): array
    {
        return $this->batchEncounterCounts(
            $visitIds,
            'procedure_order',
            'patient_id',
            'encounter_id',
            'procedure_order_id'
        );
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, int>
     */
    public function batchLabUnreleasedCounts(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, fn ($id) => $id > 0)));
        if ($visitIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, COUNT(DISTINCT pr.procedure_report_id) AS cnt
             FROM new_visit v
             INNER JOIN procedure_order po
                ON po.patient_id = v.pid AND po.encounter_id = v.encounter AND po.activity = 1
             INNER JOIN procedure_report pr ON pr.procedure_order_id = po.procedure_order_id
             INNER JOIN procedure_result pres ON pres.procedure_report_id = pr.procedure_report_id
             WHERE v.id IN ($placeholders)
               AND (pr.review_status IS NULL OR pr.review_status != 'reviewed')
               AND pres.result IS NOT NULL AND pres.result != ''
             GROUP BY v.id",
            $visitIds
        ) ?: [];

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int) ($row['visit_id'] ?? 0)] = (int) ($row['cnt'] ?? 0);
        }

        return $counts;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, int>
     */
    public function batchRxCounts(array $visitIds): array
    {
        return $this->batchEncounterCounts(
            $visitIds,
            'prescriptions',
            'patient_id',
            'encounter',
            'id',
            'active = 1'
        );
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, int>
     */
    private function batchEncounterCounts(
        array $visitIds,
        string $childTable,
        string $pidColumn,
        string $encounterColumn,
        string $countColumn,
        string $extraWhere = 'activity = 1'
    ): array {
        $visitIds = array_values(array_unique(array_filter($visitIds, fn ($id) => $id > 0)));
        if (empty($visitIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT v.id AS visit_id, COUNT(c.{$countColumn}) AS cnt
             FROM new_visit v
             LEFT JOIN {$childTable} c
                ON c.{$pidColumn} = v.pid AND c.{$encounterColumn} = v.encounter AND {$extraWhere}
             WHERE v.id IN ($placeholders)
             GROUP BY v.id",
            $visitIds
        ) ?: [];

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int) ($row['visit_id'] ?? 0)] = (int) ($row['cnt'] ?? 0);
        }

        return $counts;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, array<string, mixed>>
     */
    public function batchTriageHolders(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, fn ($id) => $id > 0)));
        if (empty($visitIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $sql = "SELECT l.visit_id, l.actor_user_id, l.created_at, u.fname, u.lname
                FROM new_visit_state_log l
                INNER JOIN (
                    SELECT visit_id, MAX(id) AS max_id
                    FROM new_visit_state_log
                    WHERE visit_id IN ($placeholders) AND to_state = 'in_triage'
                    GROUP BY visit_id
                ) latest ON l.id = latest.max_id
                LEFT JOIN users u ON u.id = l.actor_user_id";

        $rows = QueryUtils::fetchRecords($sql, $visitIds) ?: [];
        $holders = [];

        foreach ($rows as $row) {
            $visitId = (int) ($row['visit_id'] ?? 0);
            $name = trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
            $holders[$visitId] = [
                'actor_user_id' => (int) ($row['actor_user_id'] ?? 0),
                'actor_name' => $name !== '' ? $name : null,
                'created_at' => $row['created_at'] ?? null,
            ];
        }

        return $holders;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, array<string, mixed>>
     */
    public function batchLabHolders(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, fn ($id) => $id > 0)));
        if (empty($visitIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $sql = "SELECT l.visit_id, l.actor_user_id, l.created_at, u.fname, u.lname
                FROM new_visit_state_log l
                INNER JOIN (
                    SELECT visit_id, MAX(id) AS max_id
                    FROM new_visit_state_log
                    WHERE visit_id IN ($placeholders) AND to_state = 'in_lab'
                    GROUP BY visit_id
                ) latest ON l.id = latest.max_id
                LEFT JOIN users u ON u.id = l.actor_user_id";

        $rows = QueryUtils::fetchRecords($sql, $visitIds) ?: [];
        $holders = [];

        foreach ($rows as $row) {
            $visitId = (int) ($row['visit_id'] ?? 0);
            $name = trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
            $holders[$visitId] = [
                'actor_user_id' => (int) ($row['actor_user_id'] ?? 0),
                'actor_name' => $name !== '' ? $name : null,
                'created_at' => $row['created_at'] ?? null,
            ];
        }

        return $holders;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, array<string, mixed>>
     */
    public function batchPharmacyHolders(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, fn ($id) => $id > 0)));
        if (empty($visitIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $sql = "SELECT l.visit_id, l.actor_user_id, l.created_at, u.fname, u.lname
                FROM new_visit_state_log l
                INNER JOIN (
                    SELECT visit_id, MAX(id) AS max_id
                    FROM new_visit_state_log
                    WHERE visit_id IN ($placeholders) AND to_state = 'in_pharmacy'
                    GROUP BY visit_id
                ) latest ON l.id = latest.max_id
                LEFT JOIN users u ON u.id = l.actor_user_id";

        $rows = QueryUtils::fetchRecords($sql, $visitIds) ?: [];
        $holders = [];

        foreach ($rows as $row) {
            $visitId = (int) ($row['visit_id'] ?? 0);
            $name = trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
            $holders[$visitId] = [
                'actor_user_id' => (int) ($row['actor_user_id'] ?? 0),
                'actor_name' => $name !== '' ? $name : null,
                'created_at' => $row['created_at'] ?? null,
            ];
        }

        return $holders;
    }

    public function hasSkippedTriage(int $visitId): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM new_visit_state_log
             WHERE visit_id = ? AND from_state = 'waiting' AND to_state = 'ready_for_doctor'
             LIMIT 1",
            [$visitId]
        );

        return is_array($row) && !empty($row['id']);
    }

    public static function ageFromDob(?string $dob): ?int
    {
        if (empty($dob) || $dob === '0000-00-00') {
            return null;
        }

        try {
            $birth = new \DateTime($dob);
            $now = new \DateTime('today');

            return (int) $birth->diff($now)->y;
        } catch (\Exception) {
            return null;
        }
    }

    public static function waitMinutes(?string $startedAt): int
    {
        if (empty($startedAt)) {
            return 0;
        }

        $start = strtotime($startedAt);
        if ($start === false) {
            return 0;
        }

        return max(0, (int) floor((time() - $start) / 60));
    }

    /**
     * Converts raw minutes into a compact human-readable label.
     * Under 60 min → "45m", over → "2h 15m", over 24h → "1d 2h".
     */
    public static function formatWaitLabel(int $minutes): string
    {
        if ($minutes < 1) {
            return '< 1m';
        }
        if ($minutes < 60) {
            return $minutes . 'm';
        }
        $hours = intdiv($minutes, 60);
        $mins  = $minutes % 60;
        if ($hours < 24) {
            return $mins > 0 ? $hours . 'h ' . $mins . 'm' : $hours . 'h';
        }
        $days     = intdiv($hours, 24);
        $remHours = $hours % 24;
        return $remHours > 0 ? $days . 'd ' . $remHours . 'h' : $days . 'd';
    }
}
