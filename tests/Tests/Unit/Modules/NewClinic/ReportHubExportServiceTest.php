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
use OpenEMR\Modules\NewClinic\Services\ReportHubAccessService;
use OpenEMR\Modules\NewClinic\Services\ReportHubCatalogService;
use OpenEMR\Modules\NewClinic\Services\ReportHubExportService;
use OpenEMR\Modules\NewClinic\Services\ReportHubNativeReportService;
use PHPUnit\Framework\TestCase;

class ReportHubExportServiceTest extends TestCase
{
    private ReportHubExportService $service;

    protected function setUp(): void
    {
        $config = new ClinicConfigService();
        $config->set('enable_report_hub', '1', 0);

        $access = new ReportHubAccessService(
            config: $config,
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic'
                && in_array($aco, ['new_reports_hub', 'new_reports_clinical', 'reports'], true),
        );
        $catalog = new ReportHubCatalogService(access: $access, config: $config);

        $this->service = new ReportHubExportService(
            access: $access,
            catalog: $catalog,
        );
    }

    public function testRejectsEmptyReportKey(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('report_key is required');

        $this->service->recordExportRun(['report_key' => ''], 1);
    }

    public function testRejectsMalformedDate(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('YYYY-MM-DD');

        $this->service->recordExportRun([
            'report_key' => 'clinical_immunizations',
            'date_from' => 'not-a-date',
        ], 1);
    }

    public function testRejectsUnknownReportKey(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not available');

        $this->service->recordExportRun(['report_key' => 'not_in_catalog'], 1);
    }

    public function testRejectsExportForStockReportKey(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('native hub reports');

        $this->service->requestExport([
            'report_key' => 'clinical_cohort',
            'date_from' => '2026-01-01',
            'date_to' => '2026-06-01',
        ], 1);
    }

    public function testRequestExportReturnsAsyncWhenAboveThreshold(): void
    {
        $config = new ClinicConfigService();
        $config->set('enable_report_hub', '1', 0);
        $config->set('report_hub_async_export_threshold', '10', 0);

        $access = new ReportHubAccessService(
            config: $config,
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic'
                && in_array($aco, ['new_reports_hub', 'new_reports_clinical', 'reports'], true),
        );
        $catalog = new ReportHubCatalogService(access: $access, config: $config);
        $native = new class extends ReportHubNativeReportService {
            public function countRows(string $reportKey, ?string $dateFrom, ?string $dateTo, int $facilityId = 0): int
            {
                return 25;
            }

            public function isNativeKey(string $reportKey): bool
            {
                return $reportKey === ReportHubNativeReportService::KEY_IMMUNIZATIONS;
            }
        };

        $service = new ReportHubExportService(
            access: $access,
            catalog: $catalog,
            nativeReports: $native,
            config: $config,
        );

        $result = $service->requestExport([
            'report_key' => ReportHubNativeReportService::KEY_IMMUNIZATIONS,
            'date_from' => '2099-01-01',
            'date_to' => '2099-01-02',
        ], 1);

        $this->assertSame('async', $result['mode']);
        $this->assertArrayHasKey('job_id', $result);
        $this->assertSame(25, $result['row_count_estimate']);
    }
}
