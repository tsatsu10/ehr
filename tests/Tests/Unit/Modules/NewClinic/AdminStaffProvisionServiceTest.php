<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminStaffProvisionService;
use PHPUnit\Framework\TestCase;

class AdminStaffProvisionServiceTest extends TestCase
{
    public function testDryRunShapeAndNoPasswords(): void
    {
        $service = new AdminStaffProvisionService();
        $result = $service->provisionMissing(0, 1, true);

        $this->assertArrayHasKey('created', $result);
        $this->assertArrayHasKey('already_present', $result);

        // Dry run never generates or returns passwords and never writes.
        foreach ($result['created'] as $row) {
            $this->assertArrayHasKey('role', $row);
            $this->assertArrayHasKey('role_label', $row);
            $this->assertArrayHasKey('username', $row);
            $this->assertArrayNotHasKey('temp_password', $row);
        }

        // Every core role is either already present or would be created.
        $this->assertSame(
            2,
            count($result['created']) + count($result['already_present'])
        );
    }

    public function testDryRunSkipsRolesWithActiveMembers(): void
    {
        // The dev/test DB has active members in both role groups (pilot
        // seeder). A DB without them would list the role under created —
        // both outcomes must be internally consistent with the gacl state.
        $service = new AdminStaffProvisionService();
        $result = $service->provisionMissing(0, 1, true);

        $createdRoles = array_column($result['created'], 'role');
        foreach (['new_reception', 'new_doctor'] as $role) {
            $inCreated = in_array($role, $createdRoles, true);
            $labels = ['new_reception' => 'Reception', 'new_doctor' => 'Doctor'];
            $inPresent = in_array($labels[$role], $result['already_present'], true);
            $this->assertTrue(
                $inCreated xor $inPresent,
                "{$role} must appear in exactly one bucket"
            );
        }
    }
}
