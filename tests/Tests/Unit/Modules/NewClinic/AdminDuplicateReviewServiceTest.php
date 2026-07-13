<?php

/**
 * AdminDuplicateReviewService tests (GAP-D D2).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminDuplicateReviewService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class AdminDuplicateReviewServiceTest extends TestCase
{
    public function testDisabledByDefault(): void
    {
        $this->assertFalse((new AdminDuplicateReviewService())->isEnabled());
    }

    public function testGetReviewShortCircuitsWhenDisabled(): void
    {
        // Flag defaults OFF → no query runs, no chrome surfaced (PRD §5.6).
        $review = (new AdminDuplicateReviewService())->getReview();
        $this->assertFalse($review['enabled']);
        $this->assertSame([], $review['pairs']);
    }

    public function testNameDobJoinIsBoundedAndAvoidsSelfAndReversePairs(): void
    {
        // Self-join must use b.pid > a.pid (no self-match, no A/B + B/A duplicate),
        // a LIMIT placeholder, and an un-wrapped DOB equality so idx_patient_dob anchors it.
        $method = new ReflectionMethod(AdminDuplicateReviewService::class, 'nameDobSql');
        $method->setAccessible(true);
        $sql = (string) $method->invoke(new AdminDuplicateReviewService());
        $this->assertStringContainsString('b.pid > a.pid', $sql);
        $this->assertStringContainsString('LIMIT ?', $sql);
        $this->assertStringContainsString('a.DOB = b.DOB', $sql);
    }

    public function testNationalIdUsesAggregateNotSelfJoin(): void
    {
        // `ss` is un-indexed — the national-ID signal must group-then-fetch (O(n)),
        // never self-join (O(n²)).
        $method = new ReflectionMethod(AdminDuplicateReviewService::class, 'nationalIdPairs');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode("\n", array_slice(explode("\n", $source), $start - 1, $end - $start + 1));
        $this->assertStringContainsString('GROUP BY ss', $body);
        $this->assertStringContainsString('HAVING COUNT(*) > 1', $body);
    }
}
