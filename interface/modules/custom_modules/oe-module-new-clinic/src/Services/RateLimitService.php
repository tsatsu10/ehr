<?php

/**
 * Fixed-window rate limiter (SEC06, SCALE-3.1)
 *
 * DB-backed (was $_SESSION-backed): counters key on userId + action + minute
 * window, so they can't be reset by clearing cookies, they aggregate across
 * web servers, and rate-limited actions no longer need the session lock held
 * (unblocking session_write_close for patients.search / patients.dup_check).
 *
 * The increment is a single atomic INSERT ... ON DUPLICATE KEY UPDATE with the
 * window baked into the key; the count is then read back by key (affected-rows
 * and insert-id are unreliable under OpenEMR's query logging). Dead windows are
 * purged by the job worker (scripts/run-jobs.php).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class RateLimitService
{
    /** Windows are one minute; anything older than this is unreachable garbage. */
    private const PURGE_AFTER_SECONDS = 3600;

    /**
     * SCALE-3.2 — default budget for recurring poll actions, per user per action
     * per minute. Deliberately generous: legitimate desk polling is ~6/min per tab
     * and export-status loops peak at 60/min; this only stops runaway clients.
     */
    public const POLL_LIMIT_PER_MINUTE_DEFAULT = 90;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService()
    ) {
    }

    public function assertWithinLimit(string $action, int $userId): void
    {
        $limit = match ($action) {
            'patients.search' => $this->config->getInt('rate_limit_patients_search', 30),
            'patients.dup_check' => $this->config->getInt('rate_limit_dup_check', 60),
            default => 60,
        };

        if ($this->consume($action, $userId, $this->currentWindow()) > $limit) {
            throw new \RuntimeException('Rate limit exceeded', 429);
        }
    }

    /**
     * SCALE-3.2 — generous devil-proofing budget for poll actions. Buckets are
     * prefixed 'poll.' so they never collide with an action's own tighter limit.
     */
    public function assertPollWithinLimit(string $action, int $userId): void
    {
        $limit = max(1, $this->config->getInt(
            'rate_limit_poll_per_minute',
            self::POLL_LIMIT_PER_MINUTE_DEFAULT
        ));

        if ($this->consume('poll.' . $action, $userId, $this->currentWindow()) > $limit) {
            throw new \RuntimeException('Rate limit exceeded', 429);
        }
    }

    /** How long until the current fixed window rolls over (for retry_after_ms). */
    public static function msUntilNextWindow(): int
    {
        return max(1000, (60 - (int) date('s')) * 1000);
    }

    /**
     * Atomically count one hit against the user+action bucket for the given
     * window and return the bucket's new total.
     *
     * @internal public so the window math is unit-testable with explicit windows
     */
    public function consume(string $action, int $userId, string $window): int
    {
        $bucketKey = $this->bucketKey($action, $userId, $window);

        sqlStatement(
            'INSERT INTO new_clinic_rate_limit (bucket_key, window_start, `count`)
             VALUES (?, NOW(), 1)
             ON DUPLICATE KEY UPDATE `count` = `count` + 1',
            [$bucketKey]
        );
        $row = QueryUtils::querySingleRow(
            'SELECT `count` FROM new_clinic_rate_limit WHERE bucket_key = ?',
            [$bucketKey]
        );

        // Audit follow-up (SCALE-3.1): the worker purges dead windows, but a
        // worker is not guaranteed to be scheduled (the inline-export fallback
        // exists for exactly that deployment) — and health.php writes per-IP
        // rows into this table too. Amortized self-cleaning keeps the table
        // bounded either way: ~1 request in 200 pays one indexed DELETE.
        if (random_int(1, 200) === 1) {
            $this->purgeOldWindows();
        }

        return (int) ($row['count'] ?? 1);
    }

    /**
     * Worker cleanup (scripts/run-jobs.php): drop counter rows whose window can
     * never be consulted again. Returns how many rows were removed.
     */
    public function purgeOldWindows(): int
    {
        $cutoff = date('Y-m-d H:i:s', time() - self::PURGE_AFTER_SECONDS);
        $row = QueryUtils::querySingleRow(
            'SELECT COUNT(*) AS stale FROM new_clinic_rate_limit WHERE window_start < ?',
            [$cutoff]
        );
        sqlStatement('DELETE FROM new_clinic_rate_limit WHERE window_start < ?', [$cutoff]);

        return (int) ($row['stale'] ?? 0);
    }

    private function currentWindow(): string
    {
        return date('YmdHi');
    }

    private function bucketKey(string $action, int $userId, string $window): string
    {
        // 128-char column budget: action(≤96) + ':u' + id + ':' + window(12).
        return mb_substr($action, 0, 96) . ':u' . $userId . ':' . $window;
    }
}
