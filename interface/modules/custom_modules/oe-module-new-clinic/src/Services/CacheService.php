<?php

/**
 * Cross-request cache abstraction (SCALE-3.3)
 *
 * Tiny get/set/delete/getOrSet/withLock layer so hot reads (config maps,
 * queue.counts) stop hitting MySQL on every poll. Drivers:
 *   - `apcu` — in-process shared memory, used automatically when the extension
 *     is loaded (near-free hits; per-server, so TTLs must stay ≤ 30 s for
 *     cross-server freshness — charter rule BP-5).
 *   - `db`   — `new_clinic_cache` table, the universal fallback (works on stock
 *     XAMPP; a cache hit is one primary-key SELECT instead of the work cached).
 *   - a Redis driver can slot in here later behind the same config key when a
 *     second server exists (BP-12: seam now, infra when measured).
 * Selection: config key `cache_driver` = auto|apcu|db (default auto = apcu→db).
 * Read directly from `new_clinic_config` (NOT via ClinicConfigService — that
 * service consumes this one; a service-level read here would recurse).
 *
 * Every operation fails OPEN (miss / run-the-producer) — a broken cache must
 * degrade to "slower", never to "down" (BP-8).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class CacheService
{
    /** Namespace prefix — APCu memory may be shared with other apps. */
    private const PREFIX = 'nc:';

    /** Resolved once per request (one PK read at most). */
    private static ?string $resolvedDriver = null;

    public function get(string $key): mixed
    {
        if ($this->driver() === 'apcu') {
            $hit = false;
            $value = apcu_fetch(self::PREFIX . $key, $hit);

            return $hit ? $value : null;
        }

        try {
            $row = QueryUtils::querySingleRow(
                'SELECT cache_value FROM new_clinic_cache WHERE cache_key = ? AND expires_at > NOW()',
                [self::PREFIX . $key]
            );
        } catch (\Throwable) {
            return null; // fail open (table missing pre-upgrade, DB hiccup)
        }
        if (!is_array($row) || !is_string($row['cache_value'] ?? null)) {
            return null;
        }
        $decoded = json_decode($row['cache_value'], true);

        // Values are wrapped as {"v": ...} so a cached literal null is a HIT.
        return is_array($decoded) && array_key_exists('v', $decoded) ? $decoded['v'] : null;
    }

    public function set(string $key, mixed $value, int $ttlSeconds): void
    {
        $ttlSeconds = max(1, $ttlSeconds);
        if ($this->driver() === 'apcu') {
            apcu_store(self::PREFIX . $key, $value, $ttlSeconds);

            return;
        }

        $encoded = json_encode(['v' => $value]);
        if ($encoded === false) {
            return; // unencodable → just don't cache
        }
        try {
            sqlStatement(
                'INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
                 ON DUPLICATE KEY UPDATE cache_value = VALUES(cache_value), expires_at = VALUES(expires_at)',
                [self::PREFIX . $key, $encoded, $ttlSeconds]
            );
        } catch (\Throwable) {
            // fail open
        }
    }

    public function delete(string $key): void
    {
        if ($this->driver() === 'apcu') {
            apcu_delete(self::PREFIX . $key);

            return;
        }
        try {
            sqlStatement('DELETE FROM new_clinic_cache WHERE cache_key = ?', [self::PREFIX . $key]);
        } catch (\Throwable) {
            // fail open
        }
    }

    /** Read-through helper: cached value, or produce + cache + return it. */
    public function getOrSet(string $key, int $ttlSeconds, callable $producer): mixed
    {
        $cached = $this->get($key);
        if ($cached !== null) {
            return $cached;
        }
        $value = $producer();
        if ($value !== null) {
            $this->set($key, $value, $ttlSeconds);
        }

        return $value;
    }

    /**
     * SCALE-6.1 — serve-stale-while-one-rebuilds. Prevents the cache-stampede
     * that a bare get→miss→set has: when a hot key expires and N pollers hit it
     * at once, ALL of them recompute simultaneously. Here the value carries a
     * SOFT "fresh" window shorter than its HARD row TTL:
     *   - within the fresh window → return it, no work;
     *   - past fresh but before the hard TTL → the ONE caller that wins the
     *     rebuild lock recomputes and refreshes while every other concurrent
     *     caller instantly returns the still-present STALE value (no stampede,
     *     no blocked worker);
     *   - cold (no row / hard-expired) → the lock winner computes; a caller that
     *     loses the lock on a cold key computes directly once (rare, first-hit).
     *
     * PHP single-thread caveat: unlike HTTP stale-while-revalidate we cannot
     * refresh "after the response" — the lock winner recomputes synchronously in
     * its own request — but because only ONE request does and the rest serve
     * stale, the stampede is still eliminated. Everything fails OPEN (BP-8): any
     * cache/lock failure degrades to computing directly (today's behaviour).
     *
     * Keep hardSeconds ≤ 30 (BP-5) so cross-server (apcu) staleness stays bounded;
     * freshSeconds < hardSeconds gives the stale-serve window its room.
     */
    public function remember(string $key, int $freshSeconds, int $hardSeconds, callable $producer): mixed
    {
        $freshSeconds = max(1, $freshSeconds);
        $hardSeconds = max($freshSeconds, $hardSeconds);
        $now = time();

        $wrapped = $this->get($key);
        $haveStale = is_array($wrapped)
            && array_key_exists('nc_v', $wrapped)
            && array_key_exists('nc_f', $wrapped);

        if ($haveStale && $now < (int) $wrapped['nc_f']) {
            return $wrapped['nc_v']; // fresh hit — no work
        }

        // Stale or cold: exactly one caller rebuilds (whoever wins the lock).
        $rebuilt = $this->withLock($key, $hardSeconds, function () use ($key, $freshSeconds, $hardSeconds, $now, $producer) {
            $value = $producer();
            $this->set($key, ['nc_v' => $value, 'nc_f' => $now + $freshSeconds], $hardSeconds);

            return ['nc_rebuilt' => true, 'nc_v' => $value];
        });
        if (is_array($rebuilt) && ($rebuilt['nc_rebuilt'] ?? false)) {
            return $rebuilt['nc_v']; // we were the rebuilder
        }

        // Lost the rebuild lock. If we have a stale value, serve it (the whole
        // point — no stampede). Cold + lost lock is the only case that computes
        // directly (and does NOT store, leaving the lock winner authoritative).
        return $haveStale ? $wrapped['nc_v'] : $producer();
    }

    /**
     * Run $fn only if this call wins the named lock (cross-request, TTL-bounded);
     * returns $fn's result, or null when another holder has the lock. The lock is
     * released after $fn unless it expired mid-run.
     */
    public function withLock(string $key, int $ttlSeconds, callable $fn): mixed
    {
        $lockKey = self::PREFIX . 'lock:' . $key;
        $ttlSeconds = max(1, $ttlSeconds);

        if ($this->driver() === 'apcu') {
            if (!apcu_add($lockKey, 1, $ttlSeconds)) {
                return null;
            }
            try {
                return $fn();
            } finally {
                apcu_delete($lockKey);
            }
        }

        // Atomic claim via owner token + read-back: affected-rows is unreliable
        // under OpenEMR's query logging (same pattern as the maintenance lock).
        $token = bin2hex(random_bytes(16));
        try {
            sqlStatement(
                'INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
                 VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
                 ON DUPLICATE KEY UPDATE
                     cache_value = IF(expires_at < NOW(), VALUES(cache_value), cache_value),
                     expires_at = IF(expires_at < NOW(), VALUES(expires_at), expires_at)',
                [$lockKey, $token, $ttlSeconds]
            );
            $row = QueryUtils::querySingleRow(
                'SELECT cache_value FROM new_clinic_cache WHERE cache_key = ?',
                [$lockKey]
            );
        } catch (\Throwable) {
            return null; // can't lock safely → treat as busy
        }
        if (!is_array($row) || ($row['cache_value'] ?? '') !== $token) {
            return null; // someone else holds it
        }

        try {
            return $fn();
        } finally {
            try {
                sqlStatement(
                    'DELETE FROM new_clinic_cache WHERE cache_key = ? AND cache_value = ?',
                    [$lockKey, $token]
                );
            } catch (\Throwable) {
                // expires via TTL
            }
        }
    }

    /** Worker cleanup (scripts/run-jobs.php): drop expired DB cache rows. */
    public function purgeExpired(): int
    {
        if ($this->driver() === 'apcu') {
            return 0; // APCu evicts by TTL on its own
        }
        try {
            $row = QueryUtils::querySingleRow(
                'SELECT COUNT(*) AS stale FROM new_clinic_cache WHERE expires_at < NOW()'
            );
            sqlStatement('DELETE FROM new_clinic_cache WHERE expires_at < NOW()');

            return (int) ($row['stale'] ?? 0);
        } catch (\Throwable) {
            return 0;
        }
    }

    /** Test seam. */
    public static function resetDriverResolution(): void
    {
        self::$resolvedDriver = null;
    }

    private function driver(): string
    {
        if (self::$resolvedDriver === null) {
            $configured = 'auto';
            try {
                $row = QueryUtils::querySingleRow(
                    "SELECT config_value FROM new_clinic_config
                     WHERE facility_id = 0 AND config_key = 'cache_driver'"
                );
                if (is_array($row) && in_array($row['config_value'] ?? '', ['auto', 'apcu', 'db'], true)) {
                    $configured = (string) $row['config_value'];
                }
            } catch (\Throwable) {
                // no DB / no table → keep auto
            }

            $apcuAvailable = function_exists('apcu_fetch')
                && function_exists('apcu_enabled') && apcu_enabled();
            self::$resolvedDriver = match ($configured) {
                'apcu' => $apcuAvailable ? 'apcu' : 'db',
                'db' => 'db',
                default => $apcuAvailable ? 'apcu' : 'db',
            };
        }

        return self::$resolvedDriver;
    }
}
