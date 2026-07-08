<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\FacilityUserAdminService;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use PHPUnit\Framework\TestCase;

class FacilityUserAdminServiceTest extends TestCase
{
    private function makeDeniedService(): FacilityUserAdminService
    {
        $staffAdmin = $this->createMock(StaffAdminService::class);
        $staffAdmin->method('assertCanManageStaff')
            ->willThrowException(new \RuntimeException('Forbidden', 403));

        return new FacilityUserAdminService($staffAdmin);
    }

    public function testListMatrixRequiresStaffManagePermission(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->makeDeniedService()->listMatrix();
    }

    public function testGetForUserFacilityRequiresStaffManagePermission(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->makeDeniedService()->getForUserFacility(1, 1);
    }

    public function testSaveForUserFacilityRequiresStaffManagePermission(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->makeDeniedService()->saveForUserFacility(1, 1, ['badge' => 'A1']);
    }

    public function testGetMatrixGridRequiresStaffManagePermission(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->makeDeniedService()->getMatrixGrid();
    }
}
