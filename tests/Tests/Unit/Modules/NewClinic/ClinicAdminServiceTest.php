<?php

/**
 * Unit tests for clinic admin settings normalization
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use PHPUnit\Framework\TestCase;

class ClinicAdminServiceTest extends TestCase
{
    public function testSaveRejectsOutOfRangeBillingThreshold(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $service->saveSettings('global', ['completion_required_for_billing' => 150], 1);
    }

    public function testGlobalMigrationDefaultsIncludesSafetyAndLegacyStripKeys(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        $this->assertSame('0', $defaults['enable_shared_device_session_warning']);
        $this->assertSame('0', $defaults['enable_legacy_patient_context_overlay']);
        $this->assertSame('0', $defaults['enable_legacy_strip_clinical_chips']);
        $this->assertSame('1', $defaults['enable_legacy_strip_desk_return']);
        $this->assertSame('0', $defaults['enable_faster_queue_interrupts']);
        $this->assertSame('10', $defaults['faster_queue_interrupt_poll_seconds']);
        $this->assertSame('0', $defaults['enable_similar_surname_queue_warning']);
        $this->assertSame('0', $defaults['enable_pinned_reception_preview']);
    }

    public function testReactIslandFlagsDefaultOnAfterCutover(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();
        $reactKeys = array_filter(
            array_keys($defaults),
            static fn (string $key): bool => str_starts_with($key, 'enable_react_')
        );

        $this->assertNotEmpty($reactKeys);
        foreach ($reactKeys as $key) {
            $this->assertSame(
                '1',
                $defaults[$key],
                "Expected {$key} default ON after w50react cutover"
            );
        }
    }

    public function testApplySettingDependenciesEnablesChartDepthMasterWhenSubFlagOn(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'enable_chart_depth' => '0',
            'enable_chart_depth_finance' => '1',
        ]);

        $this->assertSame('1', $normalized['enable_chart_depth']);
        $this->assertSame('1', $normalized['enable_chart_depth_finance']);
    }

    public function testApplySettingDependenciesLeavesMasterOffWhenAllSubFlagsOff(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'enable_chart_depth' => '0',
            'enable_chart_depth_finance' => '0',
            'enable_chart_depth_referral' => '0',
            'enable_chart_depth_export' => '0',
        ]);

        $this->assertSame('0', $normalized['enable_chart_depth']);
    }

    public function testSaveRejectsPharmOpsWithoutPharmacyRole(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Pharmacy Operations requires Pharmacy desk to be enabled');
        $service->saveSettings('global', [
            'enable_pharm_ops' => '1',
            'enable_pharmacy_role' => '0',
        ], 1);
    }

    public function testSaveRejectsPharmOpsWithoutInhousePharmacyGlobal(): void
    {
        $previous = $GLOBALS['inhouse_pharmacy'] ?? null;
        $GLOBALS['inhouse_pharmacy'] = false;

        try {
            $service = new ClinicAdminService();
            $this->expectException(\InvalidArgumentException::class);
            $this->expectExceptionMessage('in-house pharmacy');
            $service->saveSettings('global', [
                'enable_pharm_ops' => '1',
                'enable_pharmacy_role' => '1',
            ], 1);
        } finally {
            if ($previous === null) {
                unset($GLOBALS['inhouse_pharmacy']);
            } else {
                $GLOBALS['inhouse_pharmacy'] = $previous;
            }
        }
    }

    public function testSaveRejectsLabOpsWithoutLabRole(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Lab Operations requires Lab role to be enabled');
        $service->saveSettings('global', [
            'enable_lab_ops' => '1',
            'enable_lab_role' => '0',
        ], 1);
    }

    public function testGlobalMigrationDefaultsIncludesReactPharmOps(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        $this->assertArrayHasKey('enable_react_pharm_ops', $defaults);
        $this->assertSame('1', $defaults['enable_react_pharm_ops']);
    }

    public function testGlobalMigrationDefaultsIncludesReportHubFlags(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        $this->assertArrayHasKey('enable_report_hub', $defaults);
        $this->assertSame('0', $defaults['enable_report_hub']);
        $this->assertArrayHasKey('report_hub_show_us_quality', $defaults);
        $this->assertSame('0', $defaults['report_hub_show_us_quality']);
        $this->assertArrayHasKey('enable_react_report_hub', $defaults);
        $this->assertSame('1', $defaults['enable_react_report_hub']);
    }

    public function testApplySettingDependenciesEnablesReportHubWhenUsQualityOn(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'enable_report_hub' => '0',
            'report_hub_show_us_quality' => '1',
        ]);

        $this->assertSame('1', $normalized['enable_report_hub']);
        $this->assertSame('1', $normalized['report_hub_show_us_quality']);
    }
}
