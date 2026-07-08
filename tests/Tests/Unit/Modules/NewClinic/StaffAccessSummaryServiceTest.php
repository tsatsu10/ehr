<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\StaffAccessSummaryService;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use PHPUnit\Framework\TestCase;

class StaffAccessSummaryServiceTest extends TestCase
{
    public function testSummaryRequiresStaffManagePermission(): void
    {
        $staffAdmin = $this->createMock(StaffAdminService::class);
        $staffAdmin->expects($this->once())
            ->method('assertCanManageStaff')
            ->willThrowException(new \RuntimeException('Forbidden', 403));
        $service = new StaffAccessSummaryService($staffAdmin);

        try {
            $service->getSummary(12);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }
}
