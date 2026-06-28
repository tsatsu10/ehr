<?php

/**
 * Unit tests for Ghana region / district lookup (M1b §9)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\GeoService;
use PHPUnit\Framework\TestCase;

class GeoServiceTest extends TestCase
{
    private GeoService $service;

    protected function setUp(): void
    {
        $this->service = new GeoService();
    }

    public function testListRegionsIncludesGreaterAccra(): void
    {
        $regions = $this->service->listRegions('GH');
        $codes = array_column($regions, 'code');

        $this->assertContains('GAR', $codes);
    }

    public function testValidateDistrictInRegionAcceptsValidPair(): void
    {
        $this->assertTrue($this->service->validateDistrictInRegion('GAR', 'GAR-ACC'));
    }

    public function testValidateDistrictInRegionRejectsMismatchedRegion(): void
    {
        $this->assertFalse($this->service->validateDistrictInRegion('ASH', 'GAR-ACC'));
    }

    public function testRegionAndDistrictLabelsResolve(): void
    {
        $this->assertSame('Greater Accra', $this->service->regionLabel('GAR'));
        $this->assertSame('Accra Metropolitan', $this->service->districtLabel('GAR', 'GAR-ACC'));
    }
}
