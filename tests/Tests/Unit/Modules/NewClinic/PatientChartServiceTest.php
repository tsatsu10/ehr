<?php

/**
 * Unit tests for patient chart visits pagination contract (MRD §8.5 / test 41)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientChartService;
use PHPUnit\Framework\TestCase;

class PatientChartServiceTest extends TestCase
{
    public function testPastVisitsPageSizeMatchesMrdSpec(): void
    {
        $this->assertSame(20, PatientChartService::PAST_VISITS_PAGE_SIZE);
    }

    public function testGetVisitsPayloadClampsLimit(): void
    {
        $source = file_get_contents(
            (new \ReflectionMethod(PatientChartService::class, 'getVisitsPayload'))->getFileName()
        );

        $this->assertNotFalse($source);
        $this->assertStringContainsString('past_has_more', $source);
        $this->assertStringContainsString('documentation_url', $source);
    }
}
