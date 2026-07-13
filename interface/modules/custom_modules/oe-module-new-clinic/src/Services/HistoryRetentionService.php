<?php

/**
 * Retention for append-only history tables (SCALE-6.3)
 *
 * The module's infrastructure tables self-purge (rate-limit, cache, perf-daily,
 * export files/jobs), but the append-only history tables grow with clinic
 * activity forever. This worker pass prunes them — but they are NOT equal, so
 * each carries its own retention config with a deliberately SAFE default:
 *
 *   - new_visit_state_log — the visit-FSM transition audit ("who moved this
 *     visit through which states"). A clinical/compliance record. DEFAULT 0 =
 *     NEVER auto-purge; enabling a cutoff is a records-retention *policy*
 *     decision the clinic signs off, never a performance default.
 *   - new_config_log — config-change audit, low volume. Default 730 days.
 *   - new_visit_notify_log — doctor-ready notify debounce; already bounded
 *     (UNIQUE per visit+recipient). Default 730 days, belt-and-braces.
 *
 * Deletes are BOUNDED and batched (never one giant DELETE): pre-count with the
 * index, then loop a capped number of `DELETE … LIMIT` statements (a large
 * backlog drains over successive worker passes). affected_rows is unreliable
 * under OpenEMR's query logging, so termination is count-driven, not
 * affected-rows-driven. Everything fails soft — a purge error is reported, never
 * fatal to the worker.
 *
 * Future (NOT V1): if a real clinic's volumes ever make batched DELETE too slow,
 * RANGE-partition-by-date makes retention a near-instant DROP PARTITION — but the
 * partition column must be in the primary key, so it's a PK re-architecture.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class HistoryRetentionService
{
    private const BATCH = 2000;

    /** Max DELETE batches per table per pass (200k rows); backlog drains over passes. */
    private const MAX_ITERATIONS = 100;

    /**
     * table => [config key, age column, safe default days]. The table + column
     * come only from this fixed map (never input), so interpolating them into
     * SQL below is injection-safe.
     *
     * @var array<string, array{key: string, col: string, default: int}>
     */
    private const TABLES = [
        'new_visit_state_log'  => ['key' => 'retention_state_log_days',  'col' => 'created_at',  'default' => 0],
        'new_config_log'       => ['key' => 'retention_config_log_days', 'col' => 'applied_at',  'default' => 730],
        'new_visit_notify_log' => ['key' => 'retention_notify_log_days', 'col' => 'notified_at', 'default' => 730],
    ];

    /**
     * Worker entry: prune every history table per its configured retention.
     *
     * @return array<string, int|string> table => rows purged, 'disabled', or 'error: …'
     */
    public function purgeAll(): array
    {
        $out = [];
        foreach (self::TABLES as $table => $meta) {
            $out[$table] = $this->purge($table, $this->retentionDays($meta['key'], $meta['default']));
        }

        return $out;
    }

    /**
     * Prune one known history table of rows older than $retentionDays, in bounded
     * batches. $retentionDays ≤ 0 → 'disabled' (never purge). Public so the worker
     * math is unit-testable with an explicit retention; the table must be one of
     * the known history tables (allowlist), so it is never arbitrary.
     *
     * @return int|string rows purged (approx), 'disabled', or 'error: …'
     */
    public function purge(string $table, int $retentionDays): int|string
    {
        if (!isset(self::TABLES[$table])) {
            throw new \InvalidArgumentException('Unknown history table');
        }
        if ($retentionDays <= 0) {
            return 'disabled';
        }

        $col = self::TABLES[$table]['col'];
        $cutoff = date('Y-m-d H:i:s', time() - $retentionDays * 86400);

        try {
            $countRow = QueryUtils::querySingleRow(
                "SELECT COUNT(*) AS n FROM `$table` WHERE `$col` < ?",
                [$cutoff]
            );
            $total = (int) ($countRow['n'] ?? 0);
            if ($total === 0) {
                return 0;
            }
            $iterations = min((int) ceil($total / self::BATCH), self::MAX_ITERATIONS);
            for ($i = 0; $i < $iterations; $i++) {
                sqlStatement("DELETE FROM `$table` WHERE `$col` < ? LIMIT " . self::BATCH, [$cutoff]);
            }

            return min($total, $iterations * self::BATCH);
        } catch (\Throwable $e) {
            return 'error: ' . $e->getMessage();
        }
    }

    /**
     * Retention days for a config key, read directly from facility-0 global config
     * (the worker has no session/facility). Missing/blank → the caller's safe
     * default; never throws.
     */
    private function retentionDays(string $configKey, int $default): int
    {
        try {
            $row = QueryUtils::querySingleRow(
                "SELECT config_value FROM new_clinic_config WHERE facility_id = 0 AND config_key = ?",
                [$configKey]
            );
        } catch (\Throwable) {
            return $default;
        }
        if (!is_array($row) || !array_key_exists('config_value', $row)) {
            return $default;
        }
        $value = $row['config_value'];

        return ($value === null || $value === '') ? $default : max(0, (int) $value);
    }
}
