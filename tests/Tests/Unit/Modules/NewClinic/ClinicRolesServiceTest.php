<?php

/**
 * Unit tests for clinic roles ACL catalog
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicRolesService;
use PHPUnit\Framework\TestCase;

class ClinicRolesServiceTest extends TestCase
{
    public function testGrantMatrixIncludesDeskGroups(): void
    {
        $matrix = ClinicRolesService::buildGrantMatrix();

        $this->assertContains('New Clinic Reception', $matrix['new_reception']);
        $this->assertContains('New Clinic Doctor', $matrix['new_doctor']);
        $this->assertContains('New Clinic Admin', $matrix['new_admin']);
    }

    public function testGrantMatrixIncludesLeadPrivileges(): void
    {
        $matrix = ClinicRolesService::buildGrantMatrix();

        $this->assertContains('New Clinic Reception Lead', $matrix['new_visit_cancel']);
        $this->assertContains('New Clinic Cashier Lead', $matrix['new_visit_mark_outstanding']);
        $this->assertContains('New Clinic Doctor', $matrix['new_visit_skip_queue']);
    }

    public function testAdminGroupHasReportsAcl(): void
    {
        $matrix = ClinicRolesService::buildGrantMatrix();

        $this->assertContains('New Clinic Admin', $matrix['reports']);
    }
}
