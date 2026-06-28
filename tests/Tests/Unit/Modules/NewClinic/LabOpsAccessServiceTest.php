<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use PHPUnit\Framework\TestCase;

class LabOpsAccessServiceTest extends TestCase
{
    public function testAjaxPolicyRegistersLabOpsActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('lab_ops_read_acl', $policy->describe('lab_ops.worklist')['type']);
        $this->assertSame('lab_ops_read_acl', $policy->describe('lab_ops.result_get')['type']);
        $this->assertSame('lab_ops_enter_acl', $policy->describe('lab_ops.result_save')['type']);
        $this->assertSame('lab_ops_enter_acl', $policy->describe('lab_ops.specimen_collect')['type']);
        $this->assertSame('lab_ops_release_acl', $policy->describe('lab_ops.result_release')['type']);
        $this->assertSame('lab_ops_read_acl', $policy->describe('lab_ops.setup_status')['type']);
        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.panel_import')['type']);
        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.fee_map_list')['type']);
        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.fee_map_save')['type']);
    }

    public function testReleaseAclListIsLabLeadOnlyAmongDeskRoles(): void
    {
        $this->assertContains('new_lab_lead', LabOpsAccessService::RELEASE_ACLS);
        $this->assertNotContains('new_lab', LabOpsAccessService::RELEASE_ACLS);
    }
}
