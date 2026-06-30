<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\PharmOpsSafetyService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsVisitMatch;
use PHPUnit\Framework\TestCase;

class PharmOpsSafetyServiceTest extends TestCase
{
    public function testTokenMatchFlagsPenicillinAgainstAmoxicillin(): void
    {
        $warning = PharmOpsSafetyService::hasDrugAllergyWarning(
            'Amoxicillin 500 mg',
            ['Penicillin']
        );

        $this->assertFalse($warning);
    }

    public function testExactTokenMatchFlagsAllergy(): void
    {
        $warning = PharmOpsSafetyService::hasDrugAllergyWarning(
            'Sulfamethoxazole 400 mg',
            ['Sulfamethoxazole allergy']
        );

        $this->assertTrue($warning);
    }

    public function testShortTokensIgnored(): void
    {
        $tokens = PharmOpsSafetyService::normalizeTokens('Rx 500 mg tab');

        $this->assertNotContains('mg', $tokens);
        $this->assertContains('tab', $tokens);
    }

    public function testVisitSubqueryUsesSingleDateBind(): void
    {
        $sql = PharmOpsVisitMatch::todayVisitSubquerySql();

        $this->assertSame(1, substr_count($sql, '?'));
        $this->assertStringContainsString('visit_date = ?', $sql);
        $this->assertStringContainsString('rx.encounter', $sql);
    }
}
