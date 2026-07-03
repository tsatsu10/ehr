<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\BillOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\BillOpsOutstandingService;
use OpenEMR\Modules\NewClinic\Services\BillOpsPaymentsSearchService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class BillOpsServicesTest extends TestCase
{
    public function testHubDisabledWhenConfigOff(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);

        $access = new BillOpsAccessService($config, new VisitScopeService());

        $this->assertFalse($access->isHubEnabled(3));
    }

    public function testOutstandingRequiresHubEnabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            if ($key === 'enable_bill_ops') {
                return 0;
            }
            if ($key === 'enable_bill_ops_outstanding') {
                return 1;
            }

            return 0;
        });

        $access = new BillOpsAccessService($config, new VisitScopeService());

        $this->assertFalse($access->isOutstandingEnabled(1));
    }

    public function testPaymentAclIncludesBillOpsPayment(): void
    {
        $this->assertContains('new_bill_ops_payment', BillOpsAccessService::PAYMENT_ACLS);
    }

    public function testSearchRejectsInvertedDateRange(): void
    {
        $access = $this->createMock(BillOpsAccessService::class);
        $service = new BillOpsPaymentsSearchService(access: $access);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('date_from cannot be after date_to');

        $service->search('', '2026-06-20', '2026-06-10');
    }

    public function testNormalizeOptionalDateRejectsInvalid(): void
    {
        $service = new BillOpsPaymentsSearchService();
        $method = new ReflectionMethod(BillOpsPaymentsSearchService::class, 'normalizeOptionalDate');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid date');

        $method->invoke($service, 'not-a-date');
    }

    public function testNormalizeBucketRejectsUnknownValue(): void
    {
        $service = new BillOpsOutstandingService();
        $method = new ReflectionMethod(BillOpsOutstandingService::class, 'normalizeBucket');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid bucket');

        $method->invoke($service, 'bad_bucket');
    }

    public function testNormalizeBucketTreatsAllAsNull(): void
    {
        $service = new BillOpsOutstandingService();
        $method = new ReflectionMethod(BillOpsOutstandingService::class, 'normalizeBucket');

        $this->assertNull($method->invoke($service, 'all'));
        $this->assertNull($method->invoke($service, null));
        $this->assertSame('0_7', $method->invoke($service, '0_7'));
    }

    public function testInsuranceVaultRequiresInsuranceFlag(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            if ($key === 'enable_bill_ops') {
                return 1;
            }
            if ($key === 'enable_insurance') {
                return 0;
            }

            return 0;
        });

        $access = new BillOpsAccessService($config, new VisitScopeService());

        $this->assertFalse($access->isInsuranceVaultEnabled(1));
    }

    public function testInsuranceVaultEnabledWhenFlagsOn(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            return in_array($key, ['enable_bill_ops', 'enable_insurance'], true) ? 1 : 0;
        });

        $access = new BillOpsAccessService($config, new VisitScopeService());

        $this->assertTrue($access->isInsuranceVaultEnabled(1));
    }
}
