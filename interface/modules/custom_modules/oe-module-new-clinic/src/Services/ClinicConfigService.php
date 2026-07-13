<?php

/**
 * Read per-facility module configuration
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ClinicConfigService
{
    /** SCALE-3.3 — cross-request config-map cache TTL (BP-5: TTL ≤ 30 s). */
    private const CACHE_TTL_SECONDS = 30;

    private ?VisitScopeService $visitScope = null;
    private ?CacheService $cache = null;

    /**
     * SCALE-1.4 — per-instance config cache: facility_id → (config_key → value).
     * The first read for a facility loads ALL of that facility's rows in ONE query;
     * every later get()/getInt()/getMany() for it is an array lookup. Before this,
     * each get() ran up to 3 SELECTs and the admin page looped ~125 keys
     * (~125–375 queries). Invalidated on every write (set/clearGlobalOverrides).
     *
     * @var array<int, array<string, string>>
     */
    private array $facilityConfig = [];

    /** Resolved once per instance — resolveDefaultFacilityId() is itself a DB hit. */
    private ?int $readerFacilityIdCache = null;

    private function getVisitScope(): VisitScopeService
    {
        if ($this->visitScope === null) {
            $this->visitScope = new VisitScopeService();
        }
        return $this->visitScope;
    }

    private function getCache(): CacheService
    {
        if ($this->cache === null) {
            $this->cache = new CacheService();
        }
        return $this->cache;
    }

    public function resolveReaderFacilityId(): int
    {
        if ($this->readerFacilityIdCache === null) {
            $this->readerFacilityIdCache = $this->getVisitScope()->resolveDefaultFacilityId();
        }

        return $this->readerFacilityIdCache;
    }

    /**
     * Load (and cache) every config row for a facility as key → value. Only non-null
     * values are stored; presence in the map means "set" (an empty string is a valid
     * set value, matching the pre-cache behaviour of get()).
     *
     * @return array<string, string>
     */
    private function loadFacility(int $facilityId): array
    {
        if (!array_key_exists($facilityId, $this->facilityConfig)) {
            // SCALE-3.3 — cross-request cache in front of the per-request map, so a
            // busy fleet re-reads each facility's config from MySQL at most every
            // 30 s per server instead of once per request. Writes delete the key
            // (see set()/clearGlobalOverrides), so same-request read-after-write
            // still sees fresh values; cross-server staleness is bounded by the TTL.
            $cached = $this->getCache()->get('cfg:' . $facilityId);
            if (is_array($cached)) {
                /** @var array<string, string> $cached */
                $this->facilityConfig[$facilityId] = $cached;

                return $this->facilityConfig[$facilityId];
            }

            $map = [];
            $rows = QueryUtils::fetchRecords(
                "SELECT config_key, config_value FROM new_clinic_config WHERE facility_id = ?",
                [$facilityId]
            ) ?: [];
            foreach ($rows as $row) {
                if (($row['config_value'] ?? null) !== null) {
                    $map[(string) $row['config_key']] = (string) $row['config_value'];
                }
            }
            $this->facilityConfig[$facilityId] = $map;
            $this->getCache()->set('cfg:' . $facilityId, $map, self::CACHE_TTL_SECONDS);
        }

        return $this->facilityConfig[$facilityId];
    }

    /** Cached value for exactly (facilityId, key), or null if unset there. */
    private function cachedValue(int $facilityId, string $key): ?string
    {
        $map = $this->loadFacility($facilityId);

        return array_key_exists($key, $map) ? $map[$key] : null;
    }

    /**
     * Drop the cached config maps after a write so the next read reflects it.
     * Clears the in-process map, plus the cross-request cache keys for the
     * facilities passed (SCALE-3.3 watch-out: a write must delete the facility
     * key AND the global key, or stale flags linger for up to the TTL).
     *
     * @param array<int, int> $facilityIds
     */
    public function invalidate(array $facilityIds = []): void
    {
        $this->facilityConfig = [];
        $cache = $this->getCache();
        foreach (array_unique(array_merge($facilityIds, [0])) as $facilityId) {
            $cache->delete('cfg:' . (int) $facilityId);
        }
    }

    public function isEnabled(string $key, int $default = 0, ?int $facilityId = null): bool
    {
        if ($facilityId === null) {
            $facilityId = $this->resolveReaderFacilityId();
        }

        return $this->getInt($key, $default, $facilityId) === 1;
    }

    public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
    {
        // Precedence preserved exactly from the pre-cache recursion:
        //   (requested facility) → (global facility 0) → (reader/default facility) → default.
        $value = $this->cachedValue($facilityId, $key);
        if ($value !== null) {
            return $value;
        }

        if ($facilityId !== 0) {
            $value = $this->cachedValue(0, $key);
            if ($value !== null) {
                return $value;
            }
        }

        // Per-facility saves clear global overrides; single-clinic desks often read facility_id=0.
        $readerFacilityId = $this->resolveReaderFacilityId();
        if ($readerFacilityId > 0) {
            $value = $this->cachedValue($readerFacilityId, $key);
            if ($value !== null) {
                return $value;
            }
        }

        return $default;
    }

    public function getInt(string $key, int $default = 0, int $facilityId = 0): int
    {
        return (int) ($this->get($key, (string) $default, $facilityId) ?? $default);
    }

    public function getBool(string $key, bool $default = false, int $facilityId = 0): bool
    {
        return $this->getInt($key, $default ? 1 : 0, $facilityId) === 1;
    }

    /**
     * Desk queue poll interval — 30s default; 10–30s when faster interrupts enabled (M0-F34).
     */
    public function resolveQueuePollIntervalMs(int $facilityId = 0): int
    {
        if ($this->getInt('enable_faster_queue_interrupts', 0, $facilityId) !== 1) {
            return 30000;
        }

        $seconds = $this->getInt('faster_queue_interrupt_poll_seconds', 10, $facilityId);

        return max(10, min(30, $seconds)) * 1000;
    }

    /**
     * @param array<int, string> $keys
     * @return array<string, string>
     */
    public function getMany(array $keys, int $facilityId = 0): array
    {
        $out = [];
        foreach ($keys as $key) {
            $out[$key] = (string) ($this->get($key, null, $facilityId) ?? '');
        }

        return $out;
    }

    public function set(string $key, string $value, int $facilityId = 0): void
    {
        $existing = QueryUtils::querySingleRow(
            "SELECT config_value FROM new_clinic_config WHERE facility_id = ? AND config_key = ?",
            [$facilityId, $key]
        );

        if (is_array($existing) && array_key_exists('config_value', $existing)) {
            sqlStatement(
                "UPDATE new_clinic_config SET config_value = ?, updated_at = NOW()
                 WHERE facility_id = ? AND config_key = ?",
                [$value, $facilityId, $key]
            );
            $this->invalidate([$facilityId]);

            return;
        }

        sqlStatement(
            "INSERT INTO new_clinic_config (facility_id, config_key, config_value) VALUES (?, ?, ?)",
            [$facilityId, $key, $value]
        );
        $this->invalidate([$facilityId]);
    }

    /**
     * Remove facility-global overrides so per-facility saves are authoritative.
     *
     * @param array<int, string> $keys
     */
    public function clearGlobalOverrides(array $keys): void
    {
        if (empty($keys)) {
            return;
        }

        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        sqlStatement(
            "DELETE FROM new_clinic_config WHERE facility_id = 0 AND config_key IN ($placeholders)",
            $keys
        );
        $this->invalidate();
    }
}
