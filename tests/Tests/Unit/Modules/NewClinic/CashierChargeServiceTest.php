<?php

/**
 * Unit tests for cashier charge posting helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CashierChargeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class CashierChargeServiceTest extends TestCase
{
    public function testPostChargesRejectsEmptyLines(): void
    {
        $method = new ReflectionMethod(CashierChargeService::class, 'postCharges');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('Select at least one charge line', $body);
        $this->assertMatchesRegularExpression('/if \(empty\(\$lines\)\)/', $body);
    }

    public function testPostChargesUsesBillingUtilities(): void
    {
        $method = new ReflectionMethod(CashierChargeService::class, 'insertBillingLine');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('BillingUtilities::addBilling', $body);
    }

    public function testResolveChargeUnitPriceUsesScheduleWithoutDiscountAcl(): void
    {
        $this->assertSame(
            50.0,
            CashierChargeService::resolveChargeUnitPrice(50.0, true, 10.0, false)
        );
    }

    public function testResolveChargeUnitPriceHonorsDiscountWhenAllowed(): void
    {
        $this->assertSame(
            40.0,
            CashierChargeService::resolveChargeUnitPrice(50.0, true, 40.0, true)
        );
    }

    public function testResolveChargeUnitPriceRejectsNegative(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        CashierChargeService::resolveChargeUnitPrice(50.0, true, -1.0, true);
    }

    public function testResolveVisitTypeSuggestionsReadsHintJson(): void
    {
        $method = new ReflectionMethod(\OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService::class, 'resolveVisitTypeSuggestions');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('cashier_fee_hint_ids', $body);
        $this->assertStringContainsString('default_fee_schedule_id', $body);
    }
}
