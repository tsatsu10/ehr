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
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ReportHubCatalogServiceTest extends TestCase
{
    public function testClinicalLensIncludesNativeImmunizations(): void
    {
        $service = $this->catalogWithClinicalAccess();

        $catalog = $service->getCatalog('clinical', 1);
        $ids = array_column($catalog['cards'], 'id');

        $this->assertContains('clinical_immunizations', $ids);
    }

    public function testPatientRegistryCardWhenEnabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            return match ($key) {
                'enable_report_hub' => 1,
                'enable_patient_registry' => 1,
                default => 0,
            };
        });

        $access = new ReportHubAccessService(
            $config,
            new VisitScopeService(),
            static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_reports_clinical',
        );

        $service = new ReportHubCatalogService($access, $config, new VisitScopeService());
        $catalog = $service->getCatalog('clinical', 1);
        $ids = array_column($catalog['cards'], 'id');

        $this->assertContains('clinical_patient_registry', $ids);
    }

    public function testUsQualityCardsHiddenWhenFlagOff(): void
    {
        $service = $this->catalogWithAuditAccess(showUsQuality: false);
        $catalog = $service->getCatalog('audit', 1);
        $ids = array_column($catalog['cards'], 'id');

        $this->assertNotContains('audit_cqm', $ids);
        $this->assertNotContains('audit_amc', $ids);
    }

    public function testPublicHealthLensIncludesNativeOpdAttendance(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            return $key === 'enable_report_hub' ? 1 : 0;
        });

        $access = new ReportHubAccessService(
            $config,
            new VisitScopeService(),
            static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_reports_public_health',
        );

        $service = new ReportHubCatalogService($access, $config, new VisitScopeService());
        $catalog = $service->getCatalog('public_health', 1);
        $opd = array_values(array_filter(
            $catalog['cards'],
            static fn (array $card): bool => $card['id'] === 'ph_opd_attendance'
        ));

        $this->assertNotEmpty($opd);
        $this->assertSame('native', $opd[0]['kind']);
    }

    public function testPublicHealthLensIncludesNativeMalariaSurveillance(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            return $key === 'enable_report_hub' ? 1 : 0;
        });

        $access = new ReportHubAccessService(
            $config,
            new VisitScopeService(),
            static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_reports_public_health',
        );

        $service = new ReportHubCatalogService($access, $config, new VisitScopeService());
        $catalog = $service->getCatalog('public_health', 1);
        $ids = array_column($catalog['cards'], 'id');

        $this->assertContains('ph_malaria_surveillance', $ids);
    }

    public function testFinancialOutstandingCardWhenBillOpsOutstandingEnabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            return match ($key) {
                'enable_report_hub' => 1,
                'enable_bill_ops' => 1,
                'enable_bill_ops_outstanding' => 1,
                default => 0,
            };
        });

        $access = new ReportHubAccessService(
            $config,
            new VisitScopeService(),
            static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_reports_financial',
        );

        $service = new ReportHubCatalogService($access, $config, new VisitScopeService());
        $catalog = $service->getCatalog('financial', 1);
        $ids = array_column($catalog['cards'], 'id');

        $this->assertContains('fin_bill_ops_outstanding', $ids);
    }

    private function catalogWithClinicalAccess(): ReportHubCatalogService
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key): int {
            return $key === 'enable_report_hub' ? 1 : 0;
        });

        $access = new ReportHubAccessService(
            $config,
            new VisitScopeService(),
            static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_reports_clinical',
        );

        return new ReportHubCatalogService($access, $config, new VisitScopeService());
    }

    private function catalogWithAuditAccess(bool $showUsQuality): ReportHubCatalogService
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturnCallback(static function (string $key) use ($showUsQuality): int {
            if ($key === 'enable_report_hub') {
                return 1;
            }
            if ($key === 'report_hub_show_us_quality') {
                return $showUsQuality ? 1 : 0;
            }

            return 0;
        });

        $access = new ReportHubAccessService(
            $config,
            new VisitScopeService(),
            static fn (string $section, string $aco): bool => $section === 'new_clinic' && $aco === 'new_reports_audit',
        );

        return new ReportHubCatalogService($access, $config, new VisitScopeService());
    }
}
