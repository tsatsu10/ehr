<?php

/**
 * Unit tests for daily reports helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReportsService;
use PHPUnit\Framework\TestCase;

class ReportsServiceTest extends TestCase
{
    public function testNormalizeVisitDateAcceptsIsoDate(): void
    {
        $this->assertSame('2026-06-24', ReportsService::normalizeVisitDate('2026-06-24'));
    }

    public function testNormalizeVisitDateDefaultsToToday(): void
    {
        $this->assertSame(date('Y-m-d'), ReportsService::normalizeVisitDate(null));
    }

    public function testNormalizeVisitDateRejectsInvalidInput(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        ReportsService::normalizeVisitDate('24-06-2026');
    }

    public function testNormalizeVisitDateRejectsGarbage(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        ReportsService::normalizeVisitDate('not-a-date');
    }

    public function testSummarizeOpenVisitsGroupsByState(): void
    {
        $summary = ReportsService::summarizeOpenVisits([
            ['state' => 'waiting', 'wait_minutes' => 30],
            ['state' => 'waiting', 'wait_minutes' => 90],
            ['state' => 'ready_for_doctor', 'wait_minutes' => 45],
        ]);

        $this->assertSame(2, $summary['waiting']['count']);
        $this->assertSame(90, $summary['waiting']['oldest_wait_minutes']);
        $this->assertSame(1, $summary['ready_for_doctor']['count']);
    }

    public function testSummarizeUnsignedAlerts(): void
    {
        $alerts = ReportsService::summarizeUnsignedAlerts([
            ['state' => 'with_doctor'],
            ['state' => 'with_doctor'],
            ['state' => 'ready_for_payment'],
        ]);

        $this->assertSame(2, $alerts['with_doctor']);
        $this->assertSame(1, $alerts['ready_for_payment']);
    }

    public function testHoursSinceTimestamp(): void
    {
        $twoHoursAgo = date('Y-m-d H:i:s', time() - 7200);
        $hours = ReportsService::hoursSinceTimestamp($twoHoursAgo);

        $this->assertGreaterThanOrEqual(1.9, $hours);
        $this->assertLessThanOrEqual(2.1, $hours);
    }
}
