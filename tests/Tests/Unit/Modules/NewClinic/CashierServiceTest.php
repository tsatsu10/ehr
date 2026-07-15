<?php

/**
 * Unit tests for cashier payment helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CashierService;
use PHPUnit\Framework\TestCase;

class CashierServiceTest extends TestCase
{
    public function testSumChargeLines(): void
    {
        $total = CashierService::sumChargeLines([
            ['amount' => 10.5],
            ['amount' => 5.25],
        ]);

        $this->assertSame(15.75, $total);
    }

    public function testSumChargeLinesEmpty(): void
    {
        $this->assertSame(0.0, CashierService::sumChargeLines([]));
    }

    public function testRecordPaymentRejectsNonPositiveAmount(): void
    {
        $method = new \ReflectionMethod(CashierService::class, 'recordPayment');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('Payment amount must be greater than zero', $body);
        $this->assertStringContainsString('completionOverrideReason', $body);
        $this->assertStringContainsString('logCompletionOverride', $body);
        $this->assertStringContainsString("'billing'", $body);
    }

    public function testRecordPartialPaymentGuards(): void
    {
        $method = new \ReflectionMethod(CashierService::class, 'recordPartialPayment');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        // Manager gate + reason + feature flag + partial-amount bounds.
        $this->assertStringContainsString("'new_visit_mark_outstanding'", $body);
        $this->assertStringContainsString('Reason is required for a partial payment', $body);
        $this->assertStringContainsString("'enable_partial_payment'", $body);
        $this->assertStringContainsString('Amount covers the full total', $body);
        $this->assertStringContainsString('Payment amount must be greater than zero', $body);
        // Completes the visit and reports the remaining balance.
        $this->assertStringContainsString("'completed'", $body);
        $this->assertStringContainsString("'balance_due'", $body);
    }

    public function testResolvePatientCheckoutRequiresPid(): void
    {
        $method = new \ReflectionMethod(CashierService::class, 'resolvePatientCheckout');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("state = 'ready_for_payment'", $body);
        $this->assertStringContainsString('pick_visit', $body);
        $this->assertStringContainsString('assertPatientAccessible', $body);
    }

    public function testRecordPaymentSupportsMomoMethod(): void
    {
        $method = new \ReflectionMethod(CashierService::class, 'postPatientPayment');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString("'momo'", $body);
        $this->assertStringContainsString('MoMo · Ref:', $body);
    }
}
