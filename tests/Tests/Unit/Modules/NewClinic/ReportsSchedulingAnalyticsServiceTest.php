<?php

/**
 * Unit tests for S1-F09 full scheduling analytics
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReportsSchedulingAnalyticsService;
use PHPUnit\Framework\TestCase;

class ReportsSchedulingAnalyticsServiceTest extends TestCase
{
    public function testSummarizeLatenciesComputesMedianAndOnTime(): void
    {
        $service = new ReportsSchedulingAnalyticsService();
        $summary = $service->summarizeLatencies([-5, 0, 10, 12, 30]);

        $this->assertSame(5, $summary['sample_count']);
        $this->assertSame(10, $summary['median_minutes']);
        $this->assertSame(30, $summary['p90_minutes']);
        $this->assertSame(4, $summary['on_time_count']);
        $this->assertSame(80.0, $summary['on_time_pct']);
        $this->assertSame(1, $summary['early_count']);
        $this->assertSame(1, $summary['late_count']);
    }

    public function testSummarizeLatenciesEmpty(): void
    {
        $service = new ReportsSchedulingAnalyticsService();
        $summary = $service->summarizeLatencies([]);

        $this->assertSame(0, $summary['sample_count']);
        $this->assertNull($summary['median_minutes']);
    }

    public function testPercentile(): void
    {
        $values = [1, 2, 3, 4, 5];
        $this->assertSame(3, ReportsSchedulingAnalyticsService::percentile($values, 50));
        $this->assertSame(5, ReportsSchedulingAnalyticsService::percentile($values, 90));
    }
}
