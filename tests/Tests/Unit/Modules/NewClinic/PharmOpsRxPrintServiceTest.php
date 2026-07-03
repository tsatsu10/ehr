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
use OpenEMR\Modules\NewClinic\Services\PharmOpsRxPrintService;
use PHPUnit\Framework\TestCase;

class PharmOpsRxPrintServiceTest extends TestCase
{
    public function testAjaxPolicyMapsRxPrintAction(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame('pharm_ops_rx_print_acl', $policy->describe('pharm_ops.rx_print_pdf')['type']);
    }

    public function testRxPrintAclIncludesDoctorPharmacyAndOps(): void
    {
        $this->assertContains('new_doctor', PharmOpsAccessService::RX_PRINT_ACLS);
        $this->assertContains('new_pharmacy', PharmOpsAccessService::RX_PRINT_ACLS);
        $this->assertContains('new_pharm_ops', PharmOpsAccessService::RX_PRINT_ACLS);
    }

    public function testFormatSigBuildsReadableLabel(): void
    {
        $sig = PharmOpsRxPrintService::formatSig('500 mg', 'PO', 8);

        $this->assertSame('500 mg PO q8', $sig);
    }

    public function testFormatAgeDisplayFromDob(): void
    {
        $this->assertSame('30y', PharmOpsRxPrintService::formatAgeDisplay('1996-01-15'));
        $this->assertSame('5y', PharmOpsRxPrintService::formatAgeDisplay('2021-06-01'));
    }

    public function testFormatSexLabelNormalizesValues(): void
    {
        $this->assertSame('Male', PharmOpsRxPrintService::formatSexLabel('Male'));
        $this->assertSame('Female', PharmOpsRxPrintService::formatSexLabel('f'));
    }
}
