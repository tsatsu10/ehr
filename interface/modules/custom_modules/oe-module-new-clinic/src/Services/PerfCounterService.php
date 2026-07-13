<?php

/**
 * Per-day per-action request counters for perf visibility (SCALE-4.5)
 *
 * Extends SCALE-0.1's NC_PERF error-log lines with something an operator can
 * actually query: every AJAX request lands one atomic upsert into
 * `new_clinic_perf_daily`, keyed by (day, action), maintaining call/error
 * counts, total/max latency, and a fixed latency histogram. Counters were
 * chosen over log parsing deliberately (the plan's Windows-brittleness note):
 * the write is one PK upsert, NoLog so it can't spam the audit trail, and
 * always fail-open — observability must never break the request it observes.
 *
 * p95 is estimated from the histogram (the upper bound of the bucket where the
 * cumulative count crosses 95%, or max_ms in the overflow bucket) — accurate
 * enough to rank "yesterday's slowest actions", which is all the Admin Hub
 * panel promises. The job worker freezes the estimate into `p95_ms` for
 * completed days and purges rows past retention.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PerfCounterService
{
    /** Disposable operational data (runbook §8) — keep 90 days, then drop. */
    private const RETENTION_DAYS = 90;

    /** Histogram bucket columns and their upper bounds in ms, ascending. */
    private const BUCKETS = [
        'b_100' => 100,
        'b_250' => 250,
        'b_500' => 500,
        'b_1000' => 1000,
        'b_2500' => 2500,
    ];

    /**
     * Count one finished request. Called from the perf shutdown hook on EVERY
     * ajax request, so this must stay one statement and swallow every failure
     * (e.g. the table not existing yet mid-upgrade).
     */
    public function record(string $action, int $ms, bool $errored): void
    {
        $ms = max(0, $ms);
        $bucket = 'b_over';
        foreach (self::BUCKETS as $column => $upperMs) {
            if ($ms <= $upperMs) {
                $bucket = $column;
                break;
            }
        }

        try {
            // $bucket comes from the fixed column map above, never from input.
            sqlStatementNoLog(
                "INSERT INTO new_clinic_perf_daily
                    (`day`, `action`, `calls`, `errors`, `total_ms`, `max_ms`, `$bucket`)
                 VALUES (CURDATE(), ?, 1, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                    `calls` = `calls` + 1,
                    `errors` = `errors` + VALUES(`errors`),
                    `total_ms` = `total_ms` + VALUES(`total_ms`),
                    `max_ms` = GREATEST(`max_ms`, VALUES(`max_ms`)),
                    `$bucket` = `$bucket` + 1",
                [mb_substr($action !== '' ? $action : '(none)', 0, 64), $errored ? 1 : 0, $ms, $ms],
                true
            );
        } catch (\Throwable) {
            // Fail open: a broken counter must never break the request.
        }
    }

    /**
     * Estimate p95 from a counter row's histogram: the upper bound of the
     * bucket where the cumulative count reaches 95% of calls, or max_ms when
     * that lands in the overflow bucket. Pure, so the math is unit-testable.
     *
     * @param array<string, mixed> $row
     */
    public function estimateP95(array $row): int
    {
        $calls = (int) ($row['calls'] ?? 0);
        if ($calls < 1) {
            return 0;
        }

        $target = (int) ceil($calls * 0.95);
        $cumulative = 0;
        foreach (self::BUCKETS as $column => $upperMs) {
            $cumulative += (int) ($row[$column] ?? 0);
            if ($cumulative >= $target) {
                return $upperMs;
            }
        }

        return (int) ($row['max_ms'] ?? 0);
    }

    /**
     * Admin Hub panel payload for one day (default: yesterday): the slowest
     * actions by p95 estimate plus the actions that errored, with day totals.
     *
     * @return array{day: string, totals: array{calls: int, errors: int}, slowest: array<int, array<string, mixed>>, errors: array<int, array<string, mixed>>}
     */
    public function summary(string $day = '', int $limit = 10): array
    {
        $day = trim($day);
        if ($day === '') {
            $day = date('Y-m-d', strtotime('-1 day'));
        }
        $parsed = \DateTimeImmutable::createFromFormat('Y-m-d', $day);
        if ($parsed === false || $parsed->format('Y-m-d') !== $day) {
            throw new \InvalidArgumentException('Invalid day (expected YYYY-MM-DD)');
        }
        $limit = min(50, max(1, $limit));

        $rows = QueryUtils::fetchRecords(
            'SELECT * FROM new_clinic_perf_daily WHERE `day` = ?',
            [$day]
        ) ?: [];

        $totals = ['calls' => 0, 'errors' => 0];
        $actions = [];
        foreach ($rows as $row) {
            $calls = (int) $row['calls'];
            $totals['calls'] += $calls;
            $totals['errors'] += (int) $row['errors'];
            $actions[] = [
                'action' => (string) $row['action'],
                'calls' => $calls,
                'errors' => (int) $row['errors'],
                'avg_ms' => $calls > 0 ? (int) round(((int) $row['total_ms']) / $calls) : 0,
                // Completed days carry the frozen rollup value; today estimates live.
                'p95_ms' => $row['p95_ms'] !== null ? (int) $row['p95_ms'] : $this->estimateP95($row),
                'max_ms' => (int) $row['max_ms'],
            ];
        }

        $slowest = $actions;
        usort($slowest, static fn (array $a, array $b): int => [$b['p95_ms'], $b['max_ms']] <=> [$a['p95_ms'], $a['max_ms']]);

        $errors = array_values(array_filter($actions, static fn (array $a): bool => $a['errors'] > 0));
        usort($errors, static fn (array $a, array $b): int => $b['errors'] <=> $a['errors']);

        return [
            'day' => $day,
            'totals' => $totals,
            'slowest' => array_slice($slowest, 0, $limit),
            'errors' => array_slice($errors, 0, $limit),
        ];
    }

    /**
     * Worker pass (scripts/run-jobs.php): freeze the p95 estimate into rows of
     * completed days, then drop rows past retention. Row count per day is
     * bounded by the action catalog (~300), so this stays trivial.
     *
     * @return array{rolled_up: int, purged: int}
     */
    public function rollupAndPurge(): array
    {
        $pending = QueryUtils::fetchRecords(
            'SELECT * FROM new_clinic_perf_daily WHERE `p95_ms` IS NULL AND `day` < CURDATE()'
        ) ?: [];
        foreach ($pending as $row) {
            sqlStatementNoLog(
                'UPDATE new_clinic_perf_daily SET `p95_ms` = ? WHERE `day` = ? AND `action` = ?',
                [$this->estimateP95($row), $row['day'], $row['action']],
                true
            );
        }

        $cutoff = date('Y-m-d', strtotime('-' . self::RETENTION_DAYS . ' days'));
        $stale = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS stale FROM new_clinic_perf_daily WHERE `day` < ?',
            [$cutoff]
        );
        sqlStatementNoLog('DELETE FROM new_clinic_perf_daily WHERE `day` < ?', [$cutoff], true);

        return ['rolled_up' => count($pending), 'purged' => (int) ($stale['stale'] ?? 0)];
    }
}
