<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReportHubNativeReportService;
use OpenEMR\Modules\NewClinic\Services\ReportHubPublicHealthNativeReportService;
use PHPUnit\Framework\TestCase;

class ReportHubPublicHealthNativeReportServiceTest extends TestCase
{
    private ReportHubPublicHealthNativeReportService $service;

    protected function setUp(): void
    {
        $this->service = new ReportHubPublicHealthNativeReportService();
    }

    public function testRequiresDateRangeForOpdAttendance(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('date_from and date_to are required');

        $this->service->countRows(
            ReportHubPublicHealthNativeReportService::KEY_OPD_ATTENDANCE,
            null,
            '2026-06-30',
            0
        );
    }

    public function testOpdAttendanceCsvHeadersViaNativeService(): void
    {
        $native = new ReportHubNativeReportService();
        $csv = $native->buildCsv(
            ReportHubNativeReportService::KEY_OPD_ATTENDANCE,
            '2099-01-01',
            '2099-01-31',
            0
        );

        $this->assertStringContainsString('opd-attendance-', $csv['filename']);
        $this->assertStringContainsString('Age band', $csv['content']);
    }

    public function testMalariaSurveillanceCsvHeadersViaNativeService(): void
    {
        $native = new ReportHubNativeReportService();
        $csv = $native->buildCsv(
            ReportHubNativeReportService::KEY_MALARIA_SURVEILLANCE,
            '2099-01-01',
            '2099-01-31',
            0
        );

        $this->assertStringContainsString('malaria-surveillance-', $csv['filename']);
        $this->assertStringContainsString('Indicator', $csv['content']);
        $this->assertStringContainsString('Suspected', $csv['content']);
        $this->assertSame(4, $csv['row_count']);
    }

    public function testMohPackLabelDefaultsToGhanaV1(): void
    {
        $this->assertSame('Ghana MOH v1', $this->service->mohPackLabel(0));
    }
}
