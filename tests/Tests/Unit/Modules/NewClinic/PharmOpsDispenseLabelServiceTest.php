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
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseLabelService;
use PHPUnit\Framework\TestCase;

class PharmOpsDispenseLabelServiceTest extends TestCase
{
    public function testAjaxPolicyMapsDispenseLabelAction(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame(
            'pharm_ops_dispense_label_acl',
            $policy->describe('pharm_ops.dispense_label_pdf')['type']
        );
    }

    public function testDispenseLabelUsesDispenseAcls(): void
    {
        $this->assertContains('new_pharmacy', PharmOpsAccessService::DISPENSE_ACLS);
        $this->assertContains('new_pharm_ops_dispense', PharmOpsAccessService::DISPENSE_ACLS);
    }

    public function testFormatDisplayDateParsesIsoDate(): void
    {
        $formatted = PharmOpsDispenseLabelService::formatDisplayDate('2026-12-31');

        $this->assertSame('31 Dec 2026', $formatted);
    }

    public function testFormatDisplayDateRejectsEmpty(): void
    {
        $this->assertNull(PharmOpsDispenseLabelService::formatDisplayDate(''));
        $this->assertNull(PharmOpsDispenseLabelService::formatDisplayDate('0000-00-00'));
    }
}
