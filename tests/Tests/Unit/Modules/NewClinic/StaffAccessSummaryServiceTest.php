<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
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

    public function testSummaryIncludesMfaEnabledBoolean(): void
    {
        $row = QueryUtils::querySingleRow(
            "SELECT id FROM users WHERE username IS NOT NULL AND username != '' ORDER BY id ASC LIMIT 1",
            []
        );
        $userId = is_array($row) ? (int) ($row['id'] ?? 0) : 0;
        if ($userId <= 0) {
            $this->markTestSkipped('No user in database');
        }

        // Permit the read; we are asserting the payload shape, not the ACL here.
        $staffAdmin = $this->createMock(StaffAdminService::class);
        $staffAdmin->method('assertCanManageStaff');
        $service = new StaffAccessSummaryService($staffAdmin);

        $summary = $service->getSummary($userId);

        $this->assertArrayHasKey('mfa_enabled', $summary);
        $this->assertIsBool($summary['mfa_enabled']);
    }
}
