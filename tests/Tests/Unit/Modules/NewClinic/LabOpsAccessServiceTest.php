<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\LabOpsAccessService;
use PHPUnit\Framework\TestCase;

class LabOpsAccessServiceTest extends TestCase
{
    use MandatoryTestHelpers;

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
        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.setup_model')['type']);
        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.provider_create')['type']);
        $this->assertSame('lab_ops_catalog_acl', $policy->describe('lab_ops.sendout_provider_create')['type']);
    }

    /**
     * Regression guard (2026-07-13 audit): AjaxController::authorizeAction()'s
     * 'lab_ops_catalog_acl' arm was wired to requireLabOpsEnterAcl() instead of a
     * dedicated catalog check -- catalog actions (setup_model, provider_create,
     * panel_import, fee_map_save, ...) were only actually gated by
     * LabOpsSetupService's own duplicate check, not the declared ajax-layer policy.
     * Assert the wiring directly from source so this can't silently regress again.
     */
    public function testCatalogAclPolicyIsWiredToDedicatedCatalogCheck(): void
    {
        $authorizeBody = $this->methodBody(AjaxController::class, 'authorizeAction');
        $this->assertStringContainsString(
            "'lab_ops_catalog_acl' => \$this->requireLabOpsCatalogAcl(),",
            $authorizeBody,
            'lab_ops_catalog_acl must resolve to its own requireLabOpsCatalogAcl(), not requireLabOpsEnterAcl()'
        );

        $requireCatalogBody = $this->methodBody(AjaxController::class, 'requireLabOpsCatalogAcl');
        $this->assertStringContainsString('assertCatalogAccess', $requireCatalogBody);
    }

    public function testCatalogAclListIsAdminOrDedicatedAcoOnly(): void
    {
        $this->assertContains('new_lab_ops_catalog', LabOpsAccessService::CATALOG_ACLS);
        $this->assertContains('new_admin', LabOpsAccessService::CATALOG_ACLS);
        $this->assertNotContains('new_lab', LabOpsAccessService::CATALOG_ACLS);
        $this->assertNotContains('new_lab_lead', LabOpsAccessService::CATALOG_ACLS);
    }

    public function testReleaseAclListIsLabLeadOnlyAmongDeskRoles(): void
    {
        $this->assertContains('new_lab_lead', LabOpsAccessService::RELEASE_ACLS);
        $this->assertNotContains('new_lab', LabOpsAccessService::RELEASE_ACLS);
    }
}
