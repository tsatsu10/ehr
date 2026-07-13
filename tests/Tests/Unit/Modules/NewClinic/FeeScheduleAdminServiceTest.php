<?php

/**
 * Unit tests for fee schedule admin service
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\FeeScheduleAdminService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class FeeScheduleAdminServiceTest extends TestCase
{
    public function testCategoriesAreDocumented(): void
    {
        $this->assertArrayHasKey('consult', FeeScheduleAdminService::CATEGORIES);
        $this->assertArrayHasKey('lab', FeeScheduleAdminService::CATEGORIES);
        $this->assertTrue(FeeScheduleAdminService::isValidCategory('pharmacy'));
        $this->assertFalse(FeeScheduleAdminService::isValidCategory('invalid'));
    }

    public function testTemplatesIncludeOpdConsult(): void
    {
        $service = new FeeScheduleAdminService();
        $templates = $service->getTemplates();
        $ids = array_column($templates, 'id');
        $this->assertContains('opd_consult', $ids);
    }

    public function testSaveRejectsMissingBillingCode(): void
    {
        $service = new FeeScheduleAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Billing code is required');
        $service->save(0, [
            'code' => 'TEST',
            'name' => 'Test fee',
            'code_type' => 'CPT4',
            'billing_code' => '',
            'price_amount' => 10,
        ], 1);
    }

    public function testSaveRejectsNegativePrice(): void
    {
        $service = new FeeScheduleAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Price cannot be negative');
        $service->save(0, [
            'code' => 'TEST',
            'name' => 'Test fee',
            'code_type' => 'CPT4',
            'billing_code' => 'TEST',
            'price_amount' => -1,
        ], 1);
    }

    public function testListForDeskFiltersActiveFacilityScopedRows(): void
    {
        $method = new ReflectionMethod(FeeScheduleAdminService::class, 'listForDesk');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('is_active = 1', $body);
        $this->assertStringContainsString('facility_id = 0 OR facility_id = ?', $body);
    }

    public function testSaveValidatesBillingCodeAgainstOpenEmrCodes(): void
    {
        $method = new ReflectionMethod(FeeScheduleAdminService::class, 'save');
        $source = file_get_contents($method->getFileName());
        $start = $method->getStartLine();
        $end = $method->getEndLine();
        $body = implode('', array_slice(explode("\n", $source), $start - 1, $end - $start + 1));

        $this->assertStringContainsString('assertBillingCodeExists', $body);
    }

    public function testBulkPriceRejectsUnknownMode(): void
    {
        $service = new FeeScheduleAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Choose how to change prices');
        $service->bulkPriceUpdate(0, ['mode' => 'bogus', 'value' => 10], 1, true);
    }

    public function testBulkPriceRejectsExcessivePercentDecrease(): void
    {
        $service = new FeeScheduleAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('cannot exceed 100%');
        $service->bulkPriceUpdate(0, ['mode' => 'decrease_percent', 'value' => 150], 1, true);
    }

    public function testBulkPriceRejectsNegativeValue(): void
    {
        $service = new FeeScheduleAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Value cannot be negative');
        $service->bulkPriceUpdate(0, ['mode' => 'increase_amount', 'value' => -5], 1, true);
    }

    public function testApplyPriceModeMath(): void
    {
        $method = new ReflectionMethod(FeeScheduleAdminService::class, 'applyPriceMode');
        $method->setAccessible(true);
        $service = new FeeScheduleAdminService();

        // Raw arithmetic (the caller rounds to 2dp) — tolerate float representation.
        $this->assertEqualsWithDelta(55.0, $method->invoke($service, 50.0, 'increase_percent', 10.0), 0.0001);
        $this->assertEqualsWithDelta(45.0, $method->invoke($service, 50.0, 'decrease_percent', 10.0), 0.0001);
        $this->assertEqualsWithDelta(60.0, $method->invoke($service, 50.0, 'increase_amount', 10.0), 0.0001);
        $this->assertEqualsWithDelta(40.0, $method->invoke($service, 50.0, 'decrease_amount', 10.0), 0.0001);
        $this->assertEqualsWithDelta(99.0, $method->invoke($service, 50.0, 'set', 99.0), 0.0001);
    }
}
