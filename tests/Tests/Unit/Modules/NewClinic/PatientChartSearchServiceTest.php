<?php

/**
 * Unit tests for in-chart patient search (NG15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientChartSearchService;
use PHPUnit\Framework\TestCase;

class PatientChartSearchServiceTest extends TestCase
{
    public function testShortQueryReturnsEmptyItems(): void
    {
        $service = new PatientChartSearchService();
        $payload = $service->search(1, 'a');

        $this->assertSame('a', $payload['query']);
        $this->assertSame([], $payload['items']);
        $this->assertFalse($payload['truncated']);
        $this->assertSame(PatientChartSearchService::MIN_QUERY_LENGTH, $payload['min_query_length']);
    }

    public function testWhitespaceQueryReturnsEmptyItems(): void
    {
        $service = new PatientChartSearchService();
        $payload = $service->search(1, '   ');

        $this->assertSame('', $payload['query']);
        $this->assertSame([], $payload['items']);
    }
}
