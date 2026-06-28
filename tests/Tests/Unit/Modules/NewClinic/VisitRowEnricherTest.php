<?php

/**
 * Unit tests for shared visit row enrichment
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitRowEnricher;
use PHPUnit\Framework\TestCase;

class VisitRowEnricherTest extends TestCase
{
    public function testAgeFromDob(): void
    {
        $year = (int) date('Y') - 30;
        $age = VisitRowEnricher::ageFromDob($year . '-01-15');

        $this->assertSame(30, $age);
    }

    public function testWaitMinutesFromStartedAt(): void
    {
        $started = date('Y-m-d H:i:s', time() - 600);
        $minutes = VisitRowEnricher::waitMinutes($started);

        $this->assertGreaterThanOrEqual(9, $minutes);
        $this->assertLessThanOrEqual(11, $minutes);
    }

    public function testBatchTriageHoldersEmptyInput(): void
    {
        $enricher = new VisitRowEnricher();

        $this->assertSame([], $enricher->batchTriageHolders([]));
    }

    public function testBatchSkippedTriageEmptyInput(): void
    {
        $enricher = new VisitRowEnricher();

        $this->assertSame([], $enricher->batchSkippedTriage([]));
    }

    public function testBatchLabOrderCountsEmptyInput(): void
    {
        $enricher = new VisitRowEnricher();

        $this->assertSame([], $enricher->batchLabOrderCounts([]));
    }

    public function testBatchRxCountsEmptyInput(): void
    {
        $enricher = new VisitRowEnricher();

        $this->assertSame([], $enricher->batchRxCounts([]));
    }

    public function testEnrichVisitRowUsesSkippedMapWhenProvided(): void
    {
        $enricher = new VisitRowEnricher();
        $row = [
            'id' => 42,
            'fname' => 'Sam',
            'lname' => 'Smith',
            'started_at' => date('Y-m-d H:i:s'),
        ];

        $enriched = $enricher->enrichVisitRow($row, 42, [42 => true]);

        $this->assertTrue($enriched['skipped_triage']);
        $this->assertSame('Sam Smith', $enriched['display_name']);
    }
}
