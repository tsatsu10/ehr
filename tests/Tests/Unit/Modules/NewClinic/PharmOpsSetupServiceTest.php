<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmOpsFormularyImportService;
use PHPUnit\Framework\TestCase;

class PharmOpsSetupServiceTest extends TestCase
{
    public function testAjaxPolicyMapsSetupActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.setup_status')['type']);
        $this->assertSame('pharm_ops_catalog_acl', $policy->describe('pharm_ops.warehouse_create')['type']);
        $this->assertSame('pharm_ops_catalog_acl', $policy->describe('pharm_ops.formulary_import')['type']);
    }

    public function testStarterCsvPathPointsAtDocumentationSample(): void
    {
        $path = PharmOpsFormularyImportService::starterCsvPath();
        $this->assertStringEndsWith('opd_formulary_starter.csv', $path);
        $this->assertFileExists($path);
    }
}
