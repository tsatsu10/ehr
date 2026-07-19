<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReviewVisitSuggestionService;
use PHPUnit\Framework\TestCase;

class ReviewVisitSuggestionServiceTest extends TestCase
{
    public function testDaysSinceCountsWholeDays(): void
    {
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertSame(5, ReviewVisitSuggestionService::daysSince('2026-07-14', $today));
        $this->assertSame(0, ReviewVisitSuggestionService::daysSince('2026-07-19', $today));
    }

    public function testDaysSinceHandlesDatetimeStrings(): void
    {
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertSame(5, ReviewVisitSuggestionService::daysSince('2026-07-14 15:42:00', $today));
    }

    public function testDaysSinceNullOnMissingOrGarbage(): void
    {
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertNull(ReviewVisitSuggestionService::daysSince(null, $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('', $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('0000-00-00', $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('not-a-date', $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('99', $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('2026-13-45', $today));
    }

    public function testDaysSinceNullOnFutureDate(): void
    {
        // A future encounter date (bad data / clock skew) must not suggest a review.
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertNull(ReviewVisitSuggestionService::daysSince('2026-07-25', $today));
    }

    public function testWithinWindowBoundaryIsInclusive(): void
    {
        // Window 14, seen exactly 14 days ago -> still eligible.
        $today = new \DateTimeImmutable('2026-07-19');
        $days = ReviewVisitSuggestionService::daysSince('2026-07-05', $today);
        $this->assertSame(14, $days);
        $this->assertTrue(ReviewVisitSuggestionService::withinWindow($days, 14));
        $this->assertFalse(ReviewVisitSuggestionService::withinWindow(15, 14));
        $this->assertFalse(ReviewVisitSuggestionService::withinWindow(null, 14));
        $this->assertFalse(ReviewVisitSuggestionService::withinWindow(3, 0));
    }
}
