<?php

/**
 * Tests for the per-day per-action perf counters (SCALE-4.5)
 *
 * Runs against the live dev DB (like RateLimitServiceTest): the counter's
 * correctness IS its atomic histogram upsert. Uses dedicated nc_test.* action
 * names and cleans them up; the p95 math is tested purely.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PerfCounterService;
use PHPUnit\Framework\TestCase;

class PerfCounterServiceTest extends TestCase
{
    private const ACTION = 'nc_test.perf';

    protected function tearDown(): void
    {
        sqlStatement(
            'DELETE FROM new_clinic_perf_daily WHERE `action` LIKE ?',
            ['nc_test.perf%']
        );
    }

    // ---- estimateP95 (pure math) ------------------------------------------

    public function testP95IsTheBucketWhereTheCumulative95thCallLands(): void
    {
        $svc = new PerfCounterService();

        // 100 calls: 90 fast, 5 medium, 5 slow → the 95th call is in b_250.
        $row = [
            'calls' => 100, 'max_ms' => 4000,
            'b_100' => 90, 'b_250' => 5, 'b_500' => 0, 'b_1000' => 0, 'b_2500' => 0, 'b_over' => 5,
        ];
        $this->assertSame(250, $svc->estimateP95($row));

        // All calls in one bucket → that bucket's upper bound.
        $row = [
            'calls' => 10, 'max_ms' => 90,
            'b_100' => 10, 'b_250' => 0, 'b_500' => 0, 'b_1000' => 0, 'b_2500' => 0, 'b_over' => 0,
        ];
        $this->assertSame(100, $svc->estimateP95($row));
    }

    public function testP95FallsBackToMaxMsInTheOverflowBucket(): void
    {
        $svc = new PerfCounterService();

        $row = [
            'calls' => 10, 'max_ms' => 12000,
            'b_100' => 0, 'b_250' => 0, 'b_500' => 0, 'b_1000' => 0, 'b_2500' => 0, 'b_over' => 10,
        ];
        $this->assertSame(12000, $svc->estimateP95($row));
        $this->assertSame(0, $svc->estimateP95(['calls' => 0]));
    }

    // ---- record + summary (live DB) ---------------------------------------

    public function testRecordAccumulatesCallsErrorsAndHistogram(): void
    {
        $svc = new PerfCounterService();

        $svc->record(self::ACTION, 50, false);   // b_100
        $svc->record(self::ACTION, 200, false);  // b_250
        $svc->record(self::ACTION, 3000, true);  // b_over + error

        $summary = $svc->summary(date('Y-m-d'), 50);
        $mine = array_values(array_filter(
            $summary['slowest'],
            static fn (array $r): bool => $r['action'] === self::ACTION
        ));

        $this->assertCount(1, $mine);
        $this->assertSame(3, $mine[0]['calls']);
        $this->assertSame(1, $mine[0]['errors']);
        $this->assertSame(3000, $mine[0]['max_ms']);
        $this->assertSame((int) round(3250 / 3), $mine[0]['avg_ms']);
        // 95th percentile of 3 calls = the 3rd (ceil(2.85)) → overflow → max_ms.
        $this->assertSame(3000, $mine[0]['p95_ms']);

        $errored = array_values(array_filter(
            $summary['errors'],
            static fn (array $r): bool => $r['action'] === self::ACTION
        ));
        $this->assertCount(1, $errored);
    }

    public function testSummaryRejectsMalformedDays(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new PerfCounterService())->summary('not-a-date');
    }

    public function testSummaryResolvesDayTokensOnTheServerClock(): void
    {
        $svc = new PerfCounterService();

        $this->assertSame(date('Y-m-d'), $svc->summary('today')['day']);
        $this->assertSame(date('Y-m-d', strtotime('-1 day')), $svc->summary('yesterday')['day']);
        $this->assertSame(date('Y-m-d', strtotime('-1 day')), $svc->summary('')['day']);
        $this->assertSame(date('Y-m-d'), $svc->summary('Today')['day']);
    }

    public function testRollupFreezesP95ForCompletedDays(): void
    {
        $svc = new PerfCounterService();
        $yesterday = date('Y-m-d', strtotime('-1 day'));

        sqlStatement(
            'INSERT INTO new_clinic_perf_daily
                (`day`, `action`, `calls`, `errors`, `total_ms`, `max_ms`, `b_100`, `b_250`)
             VALUES (?, ?, 20, 0, 2000, 240, 19, 1)',
            [$yesterday, self::ACTION]
        );

        $result = $svc->rollupAndPurge();
        $this->assertGreaterThanOrEqual(1, $result['rolled_up']);

        $row = sqlQuery(
            'SELECT p95_ms FROM new_clinic_perf_daily WHERE `day` = ? AND `action` = ?',
            [$yesterday, self::ACTION]
        );
        // 95th of 20 calls = the 19th → still inside b_100.
        $this->assertSame(100, (int) $row['p95_ms']);
    }
}
