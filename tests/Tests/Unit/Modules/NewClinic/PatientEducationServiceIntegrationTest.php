<?php

/**
 * Integration test for patient-education resource read (requires local DB).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientEducationService;
use PHPUnit\Framework\TestCase;

class PatientEducationServiceIntegrationTest extends TestCase
{
    public function testGetResourcesReturnsTitleUrlPairs(): void
    {
        $resources = (new PatientEducationService())->getResources();

        $this->assertIsArray($resources);
        foreach ($resources as $resource) {
            $this->assertArrayHasKey('title', $resource);
            $this->assertArrayHasKey('url', $resource);
            $this->assertNotSame('', $resource['title']);
            $this->assertNotSame('', $resource['url']);
        }
    }
}
