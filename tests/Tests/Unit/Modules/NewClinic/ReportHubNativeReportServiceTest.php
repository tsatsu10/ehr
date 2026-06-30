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
use PHPUnit\Framework\TestCase;

class ReportHubNativeReportServiceTest extends TestCase
{
    private ReportHubNativeReportService $service;

    protected function setUp(): void
    {
        $this->service = new ReportHubNativeReportService();
    }

    public function testRejectsUnknownNativeKey(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->countRows('not_native', null, null, 0);
    }

    public function testRejectsMalformedDate(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('YYYY-MM-DD');

        $this->service->countRows(
            ReportHubNativeReportService::KEY_IMMUNIZATIONS,
            'bad-date',
            null,
            0
        );
    }

    public function testBuildCsvReturnsFilenameAndHeaders(): void
    {
        $csv = $this->service->buildCsv(
            ReportHubNativeReportService::KEY_DESTROYED_DRUGS,
            '2099-01-01',
            '2099-01-02',
            0
        );

        $this->assertStringContainsString('destroyed-medicines-', $csv['filename']);
        $this->assertStringContainsString('Drug,NDC,Lot', $csv['content']);
        $this->assertSame(0, $csv['row_count']);
    }
}
