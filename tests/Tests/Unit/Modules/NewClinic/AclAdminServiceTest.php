<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AclAdminService;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use PHPUnit\Framework\TestCase;

class AclAdminServiceTest extends TestCase
{
    private function makeServiceBypassingAccessGate(): AclAdminService
    {
        return $this->createPartialMock(AclAdminService::class, ['assertCanManageAcl']);
    }

    public function testEveryEntryPointRequiresStaffManagePermission(): void
    {
        $staffAdmin = $this->createMock(StaffAdminService::class);
        $staffAdmin->method('assertCanManageStaff')
            ->willThrowException(new \RuntimeException('Forbidden', 403));
        $service = new AclAdminService($staffAdmin);

        try {
            $service->listUsers();
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }

    public function testAdministratorsGroupCannotBeDeleted(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Not allowed to delete the Administrators group');

        $service->removeGroup('Administrators', '0');
    }

    public function testCreateGroupRequiresAllFields(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('title, identifier, return_value, and description are required');

        $service->createGroup('Records Clerks', '', '0', 'records clerks');
    }

    public function testCreateGroupRejectsNonAlphaTitle(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Title may only contain alphabetic characters and spaces');

        $service->createGroup('Clerks-2', 'clerks', '0', 'records clerks');
    }

    public function testCreateGroupRejectsIdentifierWithSpaces(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Identifier may only contain alphabetic characters with no spaces');

        $service->createGroup('Records Clerks', 'records clerks', '0', 'records clerks');
    }

    public function testGetMembershipRequiresUsername(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('username required');

        $service->getMembership('   ');
    }

    public function testAddMembershipRequiresUsernameAndGroups(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('username and groups required');

        $service->addMembership('nurse1', []);
    }

    public function testGetGroupPermissionsRequiresGroupAndReturnValue(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('group and return_value required');

        $service->getGroupPermissions('', '0');
    }

    public function testAddGroupPermissionsRequiresAcoIds(): void
    {
        $service = $this->makeServiceBypassingAccessGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('group, return_value, and aco_ids required');

        $service->addGroupPermissions('Clinicians', '0', []);
    }
}
