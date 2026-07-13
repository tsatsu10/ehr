<?php

/**
 * Tests for the cross-request cache abstraction (SCALE-3.3)
 *
 * Exercises the DB driver against the live dev DB (this box has no APCu; the
 * APCu driver is the same interface over apcu_* primitives). Uses nc-test-*
 * keys and cleans up after itself.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CacheService;
use PHPUnit\Framework\TestCase;

class CacheServiceTest extends TestCase
{
    protected function setUp(): void
    {
        CacheService::resetDriverResolution();
    }

    protected function tearDown(): void
    {
        sqlStatement("DELETE FROM new_clinic_cache WHERE cache_key LIKE 'nc:nc-test-%'");
        sqlStatement("DELETE FROM new_clinic_cache WHERE cache_key LIKE 'nc:lock:nc-test-%'");
        sqlStatement("DELETE FROM new_clinic_cache WHERE cache_key LIKE 'nc:inval:nc-test-%'");
        CacheService::resetDriverResolution();
    }

    public function testSetGetRoundTripPreservesArrays(): void
    {
        $cache = new CacheService();
        $cache->set('nc-test-map', ['a' => '1', 'b' => 2], 30);

        $this->assertSame(['a' => '1', 'b' => 2], $cache->get('nc-test-map'));
    }

    public function testMissReturnsNull(): void
    {
        $this->assertNull((new CacheService())->get('nc-test-never-set'));
    }

    public function testExpiredEntryIsAMiss(): void
    {
        $cache = new CacheService();
        $cache->set('nc-test-expired', 'value', 30);
        sqlStatement(
            "UPDATE new_clinic_cache SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
             WHERE cache_key = 'nc:nc-test-expired'"
        );

        $this->assertNull($cache->get('nc-test-expired'));
    }

    public function testDeleteRemovesTheEntry(): void
    {
        $cache = new CacheService();
        $cache->set('nc-test-del', 'x', 30);
        $cache->delete('nc-test-del');

        $this->assertNull($cache->get('nc-test-del'));
    }

    public function testGetOrSetCachesTheProducerResult(): void
    {
        $cache = new CacheService();
        $calls = 0;
        $producer = static function () use (&$calls) {
            $calls++;

            return ['n' => $calls];
        };

        $first = $cache->getOrSet('nc-test-gos', 30, $producer);
        $second = $cache->getOrSet('nc-test-gos', 30, $producer);

        $this->assertSame(['n' => 1], $first);
        $this->assertSame(['n' => 1], $second);
        $this->assertSame(1, $calls);
    }

    public function testWithLockIsExclusiveAndReleases(): void
    {
        $cache = new CacheService();

        $result = $cache->withLock('nc-test-lock', 30, static function () use ($cache) {
            // While held, a second claim on the same lock must be refused.
            return ['inner' => $cache->withLock('nc-test-lock', 30, static fn () => 'stolen')];
        });

        $this->assertSame(['inner' => null], $result);
        // Released after the closure → a fresh claim succeeds.
        $this->assertSame('again', $cache->withLock('nc-test-lock', 30, static fn () => 'again'));
    }

    public function testExpiredLockIsReclaimable(): void
    {
        $cache = new CacheService();
        sqlStatement(
            "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
             VALUES ('nc:lock:nc-test-stale', 'dead-owner', DATE_SUB(NOW(), INTERVAL 1 MINUTE))"
        );

        $this->assertSame('won', $cache->withLock('nc-test-stale', 30, static fn () => 'won'));
    }

    public function testPurgeExpiredDropsOnlyExpiredRows(): void
    {
        $cache = new CacheService();
        $cache->set('nc-test-fresh', 'keep', 300);
        sqlStatement(
            "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
             VALUES ('nc:nc-test-old', '{\"v\":\"x\"}', DATE_SUB(NOW(), INTERVAL 1 HOUR))"
        );

        $cache->purgeExpired();

        $this->assertSame('keep', $cache->get('nc-test-fresh'));
        $row = sqlQuery("SELECT COUNT(*) AS n FROM new_clinic_cache WHERE cache_key = 'nc:nc-test-old'");
        $this->assertSame(0, (int) ($row['n'] ?? -1));
    }

    // ---- SCALE-6.1: remember() serve-stale-while-one-rebuilds --------------

    public function testRememberComputesOnceThenServesFresh(): void
    {
        $cache = new CacheService();
        $calls = 0;
        $producer = static function () use (&$calls): array {
            $calls++;

            return ['n' => $calls];
        };

        $first = $cache->remember('nc-test-rem', 5, 30, $producer);
        $second = $cache->remember('nc-test-rem', 5, 30, $producer);

        $this->assertSame(['n' => 1], $first);
        $this->assertSame(['n' => 1], $second); // fresh hit — not recomputed
        $this->assertSame(1, $calls);
    }

    /**
     * The core anti-stampede guarantee: value is present but past its fresh
     * window, and ANOTHER caller already holds the rebuild lock → serve the
     * stale value instantly and do NOT run the producer (no stampede).
     */
    public function testRememberServesStaleWhileAnotherRebuilds(): void
    {
        $cache = new CacheService();
        // Present-but-stale wrapper (nc_f in the past, row not hard-expired).
        $wrapper = json_encode(['v' => ['nc_v' => ['n' => 42], 'nc_f' => time() - 100]]);
        sqlStatement(
            "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
             VALUES ('nc:nc-test-rem-stale', ?, DATE_ADD(NOW(), INTERVAL 1 MINUTE))",
            [$wrapper]
        );
        // Someone else holds the rebuild lock.
        sqlStatement(
            "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
             VALUES ('nc:lock:nc-test-rem-stale', 'other-owner', DATE_ADD(NOW(), INTERVAL 1 MINUTE))"
        );

        $calls = 0;
        $result = $cache->remember('nc-test-rem-stale', 5, 30, static function () use (&$calls): array {
            $calls++;

            return ['n' => 999];
        });

        $this->assertSame(['n' => 42], $result); // served stale
        $this->assertSame(0, $calls);            // producer NOT stampeded
    }

    /**
     * Contract: remember() returns nc_v exactly as stored, with NO type coercion
     * — a fresh hit hands back whatever the wrapper holds. So a corrupt/foreign
     * wrapper (non-array nc_v) flows straight to the caller, which is why the hot
     * call sites (getCounts, loadFacility) type-guard the result (BP-8). This test
     * pins that behaviour so a future "helpful" coercion in remember() is caught.
     */
    public function testRememberReturnsFreshValueAsIsWithoutCoercion(): void
    {
        $cache = new CacheService();
        // Fresh wrapper whose nc_v is a scalar, not the array a caller expects.
        $wrapper = json_encode(['v' => ['nc_v' => 'not-an-array', 'nc_f' => time() + 100]]);
        sqlStatement(
            "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
             VALUES ('nc:nc-test-rem-scalar', ?, DATE_ADD(NOW(), INTERVAL 1 MINUTE))",
            [$wrapper]
        );

        $calls = 0;
        $result = $cache->remember('nc-test-rem-scalar', 5, 30, static function () use (&$calls) {
            $calls++;

            return ['ok' => true];
        });

        $this->assertSame('not-an-array', $result); // returned as-is, no coercion
        $this->assertSame(0, $calls);               // fresh → producer not run
    }

    public function testRememberRebuildsWhenStaleAndLockFree(): void
    {
        $cache = new CacheService();
        $wrapper = json_encode(['v' => ['nc_v' => ['n' => 1], 'nc_f' => time() - 100]]);
        sqlStatement(
            "INSERT INTO new_clinic_cache (cache_key, cache_value, expires_at)
             VALUES ('nc:nc-test-rem-rb', ?, DATE_ADD(NOW(), INTERVAL 1 MINUTE))",
            [$wrapper]
        );

        // Stale + no competing lock → this caller rebuilds.
        $result = $cache->remember('nc-test-rem-rb', 5, 30, static fn (): array => ['n' => 2]);
        $this->assertSame(['n' => 2], $result);

        // The refreshed value is now fresh — a follow-up serves it, no recompute.
        $again = $cache->remember('nc-test-rem-rb', 5, 30, static fn (): array => ['n' => 3]);
        $this->assertSame(['n' => 2], $again);
    }

    /**
     * SCALE-6.1 audit — a rebuild must NOT re-cache stale data if an invalidation
     * lands mid-produce (a write outracing the rebuild). We simulate the
     * concurrent write by calling markInvalidated() inside the producer: the
     * caller still gets its produced value, but it is NOT stored, so the next
     * read rebuilds fresh instead of serving the just-invalidated value.
     */
    public function testRememberSkipsStoreWhenInvalidatedMidRebuild(): void
    {
        $cache = new CacheService();
        $rebuilds = 0;

        $out = $cache->remember('nc-test-rem-inval', 5, 30, static function () use ($cache, &$rebuilds): array {
            $rebuilds++;
            usleep(2000); // ensure the invalidation instant is strictly after remember()'s $startedAt
            $cache->markInvalidated('nc-test-rem-inval'); // a concurrent write lands mid-produce

            return ['n' => $rebuilds];
        });
        $this->assertSame(['n' => 1], $out); // caller still gets its produced value

        // It was NOT cached (invalidated mid-rebuild) → the next call rebuilds.
        $out2 = $cache->remember('nc-test-rem-inval', 5, 30, static function () use (&$rebuilds): array {
            $rebuilds++;

            return ['n' => $rebuilds];
        });
        $this->assertSame(['n' => 2], $out2); // recomputed, not served the stale value
        $this->assertSame(2, $rebuilds);
    }
}
