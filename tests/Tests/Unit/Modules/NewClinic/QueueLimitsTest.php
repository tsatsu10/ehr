<?php

/**
 * QueueLimits cap/truncation logic (SCALE-1.2).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\QueueLimits;
use PHPUnit\Framework\TestCase;

class QueueLimitsTest extends TestCase
{
    public function testLimitClauseFetchesOneMoreThanCap(): void
    {
        // Fetch cap+1 so we can detect "there was more" without a second COUNT query.
        $this->assertSame(' LIMIT 201', QueueLimits::limitClause(QueueLimits::QUEUE_HARD_CAP));
        $this->assertSame(' LIMIT 101', QueueLimits::limitClause(QueueLimits::BOARD_LANE_CAP));
    }

    public function testUnderCapIsNotTruncated(): void
    {
        $rows = $this->rows(50);
        [$capped, $truncated] = QueueLimits::applyCap($rows, QueueLimits::QUEUE_HARD_CAP);

        $this->assertCount(50, $capped);
        $this->assertFalse($truncated);
    }

    public function testExactlyCapIsNotTruncated(): void
    {
        // A full page with no overflow row is NOT truncated (nothing was withheld).
        $rows = $this->rows(QueueLimits::QUEUE_HARD_CAP);
        [$capped, $truncated] = QueueLimits::applyCap($rows, QueueLimits::QUEUE_HARD_CAP);

        $this->assertCount(QueueLimits::QUEUE_HARD_CAP, $capped);
        $this->assertFalse($truncated);
    }

    public function testOverCapIsSlicedAndFlagged(): void
    {
        // cap+1 fetched (the overflow probe) → slice to cap, flag truncated.
        $rows = $this->rows(QueueLimits::QUEUE_HARD_CAP + 1);
        [$capped, $truncated] = QueueLimits::applyCap($rows, QueueLimits::QUEUE_HARD_CAP);

        $this->assertCount(QueueLimits::QUEUE_HARD_CAP, $capped);
        $this->assertTrue($truncated);
        // Order preserved: the kept slice is the first N rows.
        $this->assertSame(0, $capped[0]['id']);
        $this->assertSame(QueueLimits::QUEUE_HARD_CAP - 1, $capped[QueueLimits::QUEUE_HARD_CAP - 1]['id']);
    }

    /**
     * @return array<int, array{id: int}>
     */
    private function rows(int $n): array
    {
        $rows = [];
        for ($i = 0; $i < $n; $i++) {
            $rows[] = ['id' => $i];
        }

        return $rows;
    }
}
