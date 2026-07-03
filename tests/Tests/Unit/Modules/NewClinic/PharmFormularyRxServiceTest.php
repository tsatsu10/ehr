<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\PharmFormularyRxService;
use PHPUnit\Framework\TestCase;

class PharmFormularyRxServiceTest extends TestCase
{
    public function testAjaxPolicyMapsFormularyRxActions(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('new_doctor', $policy->requiresSingleAcl('doctor.formulary_rx_catalog'));
        $this->assertSame('new_doctor', $policy->requiresSingleAcl('doctor.formulary_rx_place'));
    }

    public function testStarterDrugNamesMatchSampleCsv(): void
    {
        $this->assertContains('Amoxicillin', PharmFormularyRxService::STARTER_DRUG_NAMES);
        $this->assertContains('Paracetamol', PharmFormularyRxService::STARTER_DRUG_NAMES);
        $this->assertCount(10, PharmFormularyRxService::STARTER_DRUG_NAMES);
    }

    public function testCatalogLimitIsFifty(): void
    {
        $this->assertSame(50, PharmFormularyRxService::CATALOG_LIMIT);
    }
}
