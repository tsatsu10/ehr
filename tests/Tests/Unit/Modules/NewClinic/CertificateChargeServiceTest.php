<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CertificateChargeService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class CertificateChargeServiceTest extends TestCase
{
    private function configStub(int $autoBill): ClinicConfigService
    {
        return new class ($autoBill) extends ClinicConfigService {
            public function __construct(private readonly int $autoBill)
            {
            }

            public function getInt(string $key, int $default = 0, int $facilityId = 0): int
            {
                return $key === 'certificate_auto_bill' ? $this->autoBill : $default;
            }

            public function get(string $key, ?string $default = null, int $facilityId = 0): ?string
            {
                return $default;
            }
        };
    }

    public function testDisabledToggleReturnsWithoutPosting(): void
    {
        $service = new CertificateChargeService(config: $this->configStub(0));

        $result = $service->postCertificateCharge(1, 99999, 1, 3, 1);

        $this->assertFalse($result['enabled']);
        $this->assertFalse($result['posted']);
        $this->assertFalse($result['missing_fee']);
        $this->assertSame(0.0, $result['amount']);
    }

    public function testEnabledWithoutFeeScheduleRowFlagsMissingFee(): void
    {
        // Facility 999999 has no MED_CERT fee-schedule row — the toggle being on
        // must surface missing_fee (admin action needed) and post nothing.
        $service = new CertificateChargeService(config: $this->configStub(1));

        $result = $service->postCertificateCharge(1, 99999, 1, 999999, 1);

        $this->assertTrue($result['enabled']);
        $this->assertFalse($result['posted']);
        $this->assertTrue($result['missing_fee']);
        $this->assertSame(0.0, $result['amount']);
    }
}
