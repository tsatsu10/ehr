<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use PHPUnit\Framework\TestCase;

class PharmOpsAccessServiceTest extends TestCase
{
    public function testAjaxPolicyRegistersPharmOpsWorklist(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.worklist')['type']);
        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.dispense_get')['type']);
        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.setup_status')['type']);
        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.reports_embed')['type']);
        $this->assertSame('pharm_ops_dispense_acl', $policy->describe('pharm_ops.dispense_confirm')['type']);
        $this->assertSame('pharm_ops_dispense_label_acl', $policy->describe('pharm_ops.dispense_label_pdf')['type']);
        $this->assertSame('pharm_ops_dispense_acl', $policy->describe('pharm_ops.otc_sale_confirm')['type']);
        $this->assertSame('pharm_ops_receive_acl', $policy->describe('pharm_ops.receive_get')['type']);
        $this->assertSame('pharm_ops_receive_acl', $policy->describe('pharm_ops.receive_save')['type']);
    }

    public function testReceiveAclIncludesPharmacyLead(): void
    {
        $this->assertContains('new_pharm_ops_receive', PharmOpsAccessService::RECEIVE_ACLS);
        $this->assertContains('new_pharmacy_lead', PharmOpsAccessService::RECEIVE_ACLS);
    }

    public function testDestroyAclIsLeadScoped(): void
    {
        $this->assertContains('new_pharm_ops_destroy', PharmOpsAccessService::DESTROY_ACLS);
        $this->assertContains('new_pharmacy_lead', PharmOpsAccessService::DESTROY_ACLS);
        $this->assertContains('new_admin', PharmOpsAccessService::DESTROY_ACLS);
    }

    public function testCatalogAclIsAdminScoped(): void
    {
        $this->assertContains('new_pharm_ops_catalog', PharmOpsAccessService::CATALOG_ACLS);
        $this->assertContains('new_admin', PharmOpsAccessService::CATALOG_ACLS);
    }

    public function testDispenseAclIncludesPharmacyDesk(): void
    {
        $this->assertContains('new_pharmacy', PharmOpsAccessService::DISPENSE_ACLS);
        $this->assertContains('new_pharm_ops_dispense', PharmOpsAccessService::DISPENSE_ACLS);
    }

    public function testHubReadAclIncludesPharmOpsAndPharmacy(): void
    {
        $this->assertContains('new_pharm_ops', PharmOpsAccessService::HUB_READ_ACLS);
        $this->assertContains('new_pharmacy', PharmOpsAccessService::HUB_READ_ACLS);
    }
}
