<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmOpsOtcSaleService;
use PHPUnit\Framework\TestCase;

class PharmOpsOtcSaleServiceTest extends TestCase
{
    public function testFormatDrugLabelIncludesSizeAndUnit(): void
    {
        $label = PharmOpsOtcSaleService::formatDrugLabel([
            'name' => 'Paracetamol',
            'size' => '500',
            'unit' => 'mg',
        ]);

        $this->assertSame('Paracetamol 500 mg', $label);
    }

    public function testAjaxPolicyMapsOtcActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.otc_drugs_search')['type']);
        $this->assertSame('pharm_ops_read_acl', $policy->describe('pharm_ops.otc_sale_get')['type']);
        $this->assertSame('pharm_ops_dispense_acl', $policy->describe('pharm_ops.otc_sale_confirm')['type']);
    }
}
