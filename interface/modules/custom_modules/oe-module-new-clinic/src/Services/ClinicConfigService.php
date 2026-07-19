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
    /** SCALE-3.3 — cross-request config-map cache HARD TTL (BP-5: TTL ≤ 30 s). */
    private const CACHE_TTL_SECONDS = 30;

    /**
     * SCALE-6.1 — soft "fresh" window for the serve-stale rebuild. Shorter than
     * the hard TTL so a rebuild is triggered before the row hard-expires; the gap
     * (25→30 s) is the window in which one caller rebuilds while others serve the
     * still-valid map. Config is low-churn and writes invalidate immediately, so a
     * few seconds of serve-stale here is harmless.
     */
    private const CACHE_FRESH_SECONDS = 25;

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
            //
            // SCALE-6.1 — served via remember() (serve-stale-while-one-rebuilds) so a
            // burst of requests at the 30 s expiry boundary (e.g. after a restart)
            // doesn't all re-query config at once; one rebuilds, the rest serve the
            // still-valid map.
            $map = $this->getCache()->remember(
                'cfg:' . $facilityId,
                self::CACHE_FRESH_SECONDS,
                self::CACHE_TTL_SECONDS,
                function () use ($facilityId): array {
                    $out = [];
                    $rows = QueryUtils::fetchRecords(
                        "SELECT config_key, config_value FROM new_clinic_config WHERE facility_id = ?",
                        [$facilityId]
                    ) ?: [];
                    foreach ($rows as $row) {
                        if (($row['config_value'] ?? null) !== null) {
                            $out[(string) $row['config_key']] = (string) $row['config_value'];
                        }
                    }

                    return $out;
                }
            );
            // Defensive (BP-8): remember() returns the producer's map on every real
            // path, but a corrupt/foreign cache wrapper (non-array nc_v) must not
            // fatal downstream array_key_exists()/array reads — degrade to an empty
            // map (all flags read as default) for this request; the row self-expires
            // within the hard TTL. loadFacility() is on nearly every request path.
            /** @var array<string, string> $map */
            $this->facilityConfig[$facilityId] = is_array($map) ? $map : [];
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
     * ADM-5 — whether `$key` has an explicit row at `$facilityId` (not falling
     * back to global/default). Uses the same per-request/cross-request cache
     * `get()` already warms for that facility, so this costs no extra query
     * when called alongside a normal get() loop over the same facility.
     */
    public function hasFacilityOverride(string $key, int $facilityId): bool
    {
        if ($facilityId === 0) {
            return false; // Global scope has nothing to "override".
        }

        return $this->cachedValue($facilityId, $key) !== null;
    }

    /** ADM-5 — the facility-0 (global default) value for `$key`, or null if unset there. */
    public function getGlobalValue(string $key): ?string
    {
        return $this->cachedValue(0, $key);
    }

    /**
     * ADM-5 — "Use global value": delete the facility-level row for `$key`
     * (a true reset, not a copy of today's global value). No-op if no row
     * exists there. Never touches facility 0 through this path.
     */
    public function deleteFacilityOverride(string $key, int $facilityId): void
    {
        if ($facilityId === 0) {
            return;
        }

        sqlStatement(
            "DELETE FROM new_clinic_config WHERE facility_id = ? AND config_key = ?",
            [$facilityId, $key]
        );
        $this->invalidate([$facilityId]);
    }

    /**
     * Drop the cached config maps after a write so the next read reflects it.
     * Clears the in-process map, plus the cross-request cache keys for the
     * facilities passed (SCALE-3.3 watch-out: a write must delete the facility
     * key AND the global key, or stale flags linger for up to the TTL).
     *
     * SCALE-6.1 audit — also stamps each key invalidated so a serve-stale rebuild
     * that started before this write can't re-cache the pre-write value after our
     * delete (the "admin toggle doesn't take effect for ≤TTL" race).
     *
     * @param array<int, int> $facilityIds
     */
    public function invalidate(array $facilityIds = []): void
    {
        $this->facilityConfig = [];
        $cache = $this->getCache();
        foreach (array_unique(array_merge($facilityIds, [0])) as $facilityId) {
            $cache->delete('cfg:' . (int) $facilityId);
            $cache->markInvalidated('cfg:' . (int) $facilityId);
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
     *
     * SCALE-4.3 — `panic_poll_multiplier` (default 1, clamped 1–10) multiplies the
     * interval every island receives from Twig. Flipping it in the DB slows the
     * whole fleet's polling within one page reload, no deploy — the incident lever
     * when the DB is drowning. This method is the single choke point for pollMs.
     */
    public function resolveQueuePollIntervalMs(int $facilityId = 0): int
    {
        $multiplier = max(1, min(10, $this->getInt('panic_poll_multiplier', 1, $facilityId)));

        if ($this->getInt('enable_faster_queue_interrupts', 0, $facilityId) !== 1) {
            return 30000 * $multiplier;
        }

        $seconds = $this->getInt('faster_queue_interrupt_poll_seconds', 10, $facilityId);

        return max(10, min(30, $seconds)) * 1000 * $multiplier;
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
