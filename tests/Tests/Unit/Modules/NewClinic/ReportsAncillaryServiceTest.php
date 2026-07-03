<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ReportsAncillaryService;
use PHPUnit\Framework\TestCase;

class ReportsAncillaryServiceTest extends TestCase
{
    private function serviceWithAncillaryEnabled(bool $enabled): ReportsAncillaryService
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(
            static function (string $key, int $default = 0, ?int $facilityId = null) use ($enabled): int {
                if ($key === 'enable_ancillary_services') {
                    return $enabled ? 1 : 0;
                }

                return $default;
            }
        );

        return new ReportsAncillaryService($config);
    }

    public function testPharmacyOutcomesMatchPrd(): void
    {
        $this->assertSame(
            [
                'otc_dispensed',
                'external_rx_dispensed',
                'rx_required_refer_to_opd',
                'rx_required_no_doctor_available',
                'rx_required_patient_declined',
            ],
            ReportsAncillaryService::PHARMACY_OUTCOMES
        );
    }

    public function testDisabledReportPayload(): void
    {
        $service = $this->serviceWithAncillaryEnabled(false);
        $report = $service->getReport(0, '2099-01-01', '2099-01-01');

        $this->assertFalse($report['enabled']);
        $this->assertSame('2099-01-01', $report['start_date']);
        $this->assertSame('2099-01-01', $report['end_date']);
    }

    public function testExportCsvRejectedWhenDisabled(): void
    {
        $service = $this->serviceWithAncillaryEnabled(false);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Ancillary services reporting is not enabled');
        $service->exportCsv(0, '2099-01-01', '2099-01-01');
    }

    public function testInvalidDateRangeRejected(): void
    {
        $service = $this->serviceWithAncillaryEnabled(false);
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('end_date must be on or after start_date');
        $service->getReport(0, '2099-01-02', '2099-01-01');
    }
}
