<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy;
use OpenEMR\Modules\NewClinic\Services\CashierOtherPaymentService;
use PHPUnit\Framework\TestCase;

class CashierOtherPaymentServiceTest extends TestCase
{
    public function testAjaxPolicyMapsBothActionsToTheNewAco(): void
    {
        $policy = new AjaxActionPolicy();

        $this->assertSame(
            'new_cashier_other_payment',
            $policy->describe('cashier.other_payment.context')['acl'] ?? null
        );
        $this->assertSame(
            'new_cashier_other_payment',
            $policy->describe('cashier.other_payment.post')['acl'] ?? null
        );
    }

    public function testValidateAmountAcceptsAndRounds(): void
    {
        $this->assertSame(120.5, CashierOtherPaymentService::validateAmount('120.499'));
        $this->assertSame(0.01, CashierOtherPaymentService::validateAmount(0.01));
    }

    public function testValidateAmountRejectsZero(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        CashierOtherPaymentService::validateAmount(0);
    }

    public function testValidateAmountRejectsNegative(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        CashierOtherPaymentService::validateAmount(-5);
    }

    public function testValidateAmountRejectsNonNumeric(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        CashierOtherPaymentService::validateAmount('ten cedis');
    }

    public function testValidateAmountRejectsAbsurdlyLarge(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        CashierOtherPaymentService::validateAmount(1000000);
    }
}
