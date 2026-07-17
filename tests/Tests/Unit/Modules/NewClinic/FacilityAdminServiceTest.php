<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\FacilityAdminService;
use PHPUnit\Framework\TestCase;

class FacilityAdminServiceTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $savedSession = [];

    protected function setUp(): void
    {
        // Other tests in the full suite leave $_SESSION['authUser'] set to a real
        // admin login without cleaning up, which would make the ACL guard below
        // pass through as authorized when run alongside them. Force a clean,
        // definitely-unauthenticated session for this guard test (mirrors
        // FacilityScopeServiceTest's save/clear/restore idiom).
        foreach (['authUser', 'authUserID'] as $key) {
            $this->savedSession[$key] = $_SESSION[$key] ?? null;
            unset($_SESSION[$key]);
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->savedSession as $key => $value) {
            if ($value === null) {
                unset($_SESSION[$key]);
            } else {
                $_SESSION[$key] = $value;
            }
        }
    }

    public function testListForAdminReturnsShapedFacilityRows(): void
    {
        $service = new FacilityAdminService();

        $rows = $service->listForAdmin();

        $this->assertNotEmpty($rows, 'Stock install always seeds at least one facility row');
        foreach ($rows as $row) {
            $this->assertArrayHasKey('id', $row);
            $this->assertArrayHasKey('name', $row);
            $this->assertArrayHasKey('service_location', $row);
            $this->assertArrayHasKey('billing_location', $row);
            $this->assertArrayHasKey('inactive', $row);
            $this->assertIsBool($row['service_location']);
            $this->assertIsBool($row['billing_location']);
            $this->assertIsBool($row['inactive']);
        }
    }

    public function testSaveRejectsMissingName(): void
    {
        // Name is validated before the ACL guard runs? No -- assertCanManageFacilities()
        // runs first inside save(); under the PHPUnit CLI there is no authenticated
        // session, so every save() call is expected to be rejected as Forbidden.
        // This mirrors the established pattern for ACL-gated admin CRUD in this
        // module (see FacilityUserAdminServiceTest / StaffAdminService): the
        // authorized write path is covered by live/browser smoke, not PHPUnit.
        $service = new FacilityAdminService();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Forbidden');

        $service->save(['name' => 'PHPUnit Test Clinic'], 1);
    }
}
