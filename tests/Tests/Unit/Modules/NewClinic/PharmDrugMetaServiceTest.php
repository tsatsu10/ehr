<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmDrugMetaService;
use PHPUnit\Framework\TestCase;

class PharmDrugMetaServiceTest extends TestCase
{
    public function testAjaxPolicyMapsControlledCatalogActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_catalog_acl', $policy->describe('pharm_ops.controlled_catalog')['type']);
        $this->assertSame('pharm_ops_catalog_acl', $policy->describe('pharm_ops.controlled_catalog_save')['type']);
    }

    public function testScheduleCodeRejectsOverlongValue(): void
    {
        $service = new PharmDrugMetaService();

        $this->expectException(\InvalidArgumentException::class);
        $service->saveControlledFlags([
            [
                'drug_id' => 1,
                'is_controlled' => true,
                'controlled_schedule_code' => str_repeat('A', PharmDrugMetaService::MAX_SCHEDULE_CODE_LEN + 1),
            ],
        ]);
    }
}
