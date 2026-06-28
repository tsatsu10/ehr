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
}
