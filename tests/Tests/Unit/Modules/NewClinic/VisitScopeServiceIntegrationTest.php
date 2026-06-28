<?php

/**
 * Integration tests for desk facility resolution (requires local DB)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class VisitScopeServiceIntegrationTest extends TestCase
{
    public function testResolveDeskFacilityIdUsesServiceLocationWhenSessionUnset(): void
    {
        unset($_SESSION['facilityId']);

        $facilityId = (new VisitScopeService())->resolveDeskFacilityId(null);

        $this->assertGreaterThan(0, $facilityId);
    }

    public function testResolveDeskFacilityIdPrefersValidSessionFacility(): void
    {
        $defaultId = (new VisitScopeService())->resolveDeskFacilityId(null);
        if ($defaultId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }

        $_SESSION['facilityId'] = $defaultId;

        $this->assertSame($defaultId, (new VisitScopeService())->resolveDeskFacilityId($defaultId));

        unset($_SESSION['facilityId']);
    }
}
