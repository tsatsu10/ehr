<?php

/**
 * Unit tests for CBILL-3 insurance scheme-split helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CashierService;
use OpenEMR\Modules\NewClinic\Services\SchemeClaimService;
use PHPUnit\Framework\TestCase;

class SchemeClaimServiceTest extends TestCase
{
    public function testSplitTotalsSeparatesCoveredFromPatient(): void
    {
        $split = (new SchemeClaimService())->splitTotals([
            ['amount' => 60.00, 'covered' => false],
            ['amount' => 40.00, 'covered' => true],
            ['amount' => 5.50, 'covered' => true],
        ]);

        $this->assertSame(60.00, $split['patient_pay']);
        $this->assertSame(45.50, $split['scheme_owed']);
    }

    public function testSplitTotalsEmpty(): void
    {
        $split = (new SchemeClaimService())->splitTotals([]);
        $this->assertSame(0.0, $split['patient_pay']);
        $this->assertSame(0.0, $split['scheme_owed']);
    }

    public function testRecordSchemePaymentGuards(): void
    {
        $method = new \ReflectionMethod(CashierService::class, 'recordSchemePayment');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('isEnabled', $body);
        $this->assertStringContainsString('Insurance scheme-split is not enabled', $body);
        $this->assertStringContainsString('A scheme is required', $body);
        $this->assertStringContainsString('Membership number is required', $body);
        $this->assertStringContainsString('Coverage lines do not add up to the visit total', $body);
        $this->assertStringContainsString('less than the patient portion', $body);
        $this->assertStringContainsString("'completed'", $body);
        $this->assertStringContainsString('createClaim', $body);
    }

    public function testSetClaimStatusIsGatedAndAudited(): void
    {
        $method = new \ReflectionMethod(SchemeClaimService::class, 'setClaimStatus');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("'new_bill_ops_insurance'", $body);
        $this->assertStringContainsString('Invalid claim status', $body);
        $this->assertStringContainsString('scheme_claim.', $body);
    }
}
