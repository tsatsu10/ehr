<?php

/**
 * Integration test for the vitals-trends series service (requires local DB).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicalVitalsSeriesService;
use PHPUnit\Framework\TestCase;

class ClinicalVitalsSeriesServiceIntegrationTest extends TestCase
{
    public function testGetSeriesReturnsEnabledAndMeasuresKeys(): void
    {
        $row = QueryUtils::querySingleRow('SELECT pid FROM patient_data ORDER BY pid DESC LIMIT 1', []);
        $pid = is_array($row) ? (int) ($row['pid'] ?? 0) : 0;
        if ($pid <= 0) {
            $this->markTestSkipped('No patient in database');
        }

        $payload = (new ClinicalVitalsSeriesService())->getSeries($pid);

        $this->assertArrayHasKey('enabled', $payload);
        $this->assertArrayHasKey('measures', $payload);
        $this->assertIsBool($payload['enabled']);
        $this->assertIsArray($payload['measures']);
        // Feature ships OFF by default, so an unconfigured DB returns no measures.
        if ($payload['enabled'] === false) {
            $this->assertSame([], $payload['measures']);
        }
    }
}
