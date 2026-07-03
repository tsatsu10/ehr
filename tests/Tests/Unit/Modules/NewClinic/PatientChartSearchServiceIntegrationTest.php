<?php

/**
 * Integration tests for in-chart patient search (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\PatientChartSearchService;
use PHPUnit\Framework\TestCase;

class PatientChartSearchServiceIntegrationTest extends TestCase
{
    public function testSearchPayloadShape(): void
    {
        $pid = $this->resolveAnyPatientPid();
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $payload = (new PatientChartSearchService())->search($pid, 'test', 5);

        $this->assertArrayHasKey('query', $payload);
        $this->assertArrayHasKey('items', $payload);
        $this->assertArrayHasKey('truncated', $payload);
        $this->assertArrayHasKey('min_query_length', $payload);
        $this->assertIsArray($payload['items']);

        if ($payload['items'] !== []) {
            $item = $payload['items'][0];
            $this->assertArrayHasKey('category', $item);
            $this->assertArrayHasKey('title', $item);
            $this->assertArrayHasKey('tab', $item);
        }
    }

    private function resolveAnyPatientPid(): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT pid FROM patient_data ORDER BY pid DESC LIMIT 1',
            []
        );

        return is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
    }
}
