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
    private ClinicConfigService $config;
    private ?string $previousReportHubFlag = null;

    protected function setUp(): void
    {
        $this->config = new ClinicConfigService();
        $this->previousReportHubFlag = $this->config->get('enable_report_hub', '0', 0);
        $this->config->set('enable_report_hub', '1', 0);

        $access = new ReportHubAccessService(
            config: $this->config,
            aclChecker: static fn (string $section, string $aco): bool =>
                $section === 'new_clinic'
                && in_array($aco, ['new_reports_hub', 'new_reports_clinical', 'reports'], true),
        );
        $catalog = new ReportHubCatalogService(access: $access, config: $this->config);

        $this->service = new ReportHubExportService(
            access: $access,
            catalog: $catalog,
        );
    }

    protected function tearDown(): void
    {
        if ($this->previousReportHubFlag !== null) {
            $this->config->set('enable_report_hub', $this->previousReportHubFlag, 0);
        }
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

    private function rawConfigRow(string $key, int $facilityId): ?string
    {
        $row = sqlQuery(
            'SELECT config_value FROM new_clinic_config WHERE facility_id = ? AND config_key = ?',
            [$facilityId, $key]
        );

        return is_array($row) && array_key_exists('config_value', $row)
            ? (string) $row['config_value']
            : null;
    }

    public function testRequestExportReturnsAsyncWhenAboveThreshold(): void
    {
        $config = new ClinicConfigService();
        $prevHub = $config->get('enable_report_hub', '0', 0);
        $prevThreshold = $config->get('report_hub_async_export_threshold', '1000', 0);
        // A facility-scoped row wins over the global row when the service resolves
        // the reader's facility (an Admin Hub facility-scope save mirrors every
        // setting there), so the resolved facility must be pinned too or this test
        // silently reads someone else's saved threshold.
        $readerFacilityId = $config->resolveReaderFacilityId();
        $prevFacilityHub = null;
        $prevFacilityThreshold = null;
        if ($readerFacilityId > 0) {
            // Raw row reads: ClinicConfigService::get() falls back to the global row,
            // which would make a missing facility row indistinguishable from a real one.
            $prevFacilityHub = $this->rawConfigRow('enable_report_hub', $readerFacilityId);
            $prevFacilityThreshold = $this->rawConfigRow('report_hub_async_export_threshold', $readerFacilityId);
        }
        try {
            $config->set('enable_report_hub', '1', 0);
            $config->set('report_hub_async_export_threshold', '10', 0);
            if ($readerFacilityId > 0) {
                $config->set('enable_report_hub', '1', $readerFacilityId);
                $config->set('report_hub_async_export_threshold', '10', $readerFacilityId);
            }

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
        } finally {
            $config->set('enable_report_hub', (string) $prevHub, 0);
            $config->set('report_hub_async_export_threshold', (string) $prevThreshold, 0);
            if ($readerFacilityId > 0) {
                foreach ([
                    'enable_report_hub' => $prevFacilityHub,
                    'report_hub_async_export_threshold' => $prevFacilityThreshold,
                ] as $key => $prev) {
                    if ($prev !== null) {
                        $config->set($key, $prev, $readerFacilityId);
                    } else {
                        sqlStatement(
                            'DELETE FROM new_clinic_config WHERE facility_id = ? AND config_key = ?',
                            [$readerFacilityId, $key]
                        );
                    }
                }
            }
        }
    }

    public function testAdvancedOpenAuditsAsDistinctEvent(): void
    {
        // §16.3 — Advanced escape-hatch opens must not be conflated with export runs.
        $this->assertSame(
            'reports.hub_advanced_open',
            ReportHubExportService::resolveAuditEventName(['source' => 'advanced_open'])
        );
        $this->assertSame(
            'reports.export_run',
            ReportHubExportService::resolveAuditEventName([])
        );
        $this->assertSame(
            'reports.export_run',
            ReportHubExportService::resolveAuditEventName(['source' => 'card_open'])
        );

        $recorded = $this->service->recordExportRun([
            'report_key' => 'clinical_cohort',
            'source' => 'advanced_open',
        ], 1);
        $this->assertSame('ok', $recorded['status']);
    }
}
