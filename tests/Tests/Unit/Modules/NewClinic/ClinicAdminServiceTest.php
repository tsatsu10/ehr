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

    public function testSaveRejectsAncillaryWithoutDeskRoles(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Ancillary walk-in services require at least one of lab desk or pharmacy desk');
        $service->saveSettings('global', [
            'enable_ancillary_services' => '1',
            'enable_lab_role' => '0',
            'enable_pharmacy_role' => '0',
        ], 1);
    }

    public function testGlobalMigrationDefaultsIncludesAncillaryKeys(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();
        $this->assertSame('0', $defaults['enable_ancillary_services']);
        $this->assertSame('4', $defaults['ancillary_refer_window_hours']);
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

    public function testApplySettingDependenciesEnablesClinicalDocHubWhenScreeningOn(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'enable_clinical_doc_hub' => '0',
            'clinical_doc_show_screening' => '1',
        ]);

        $this->assertSame('1', $normalized['enable_clinical_doc_hub']);
        $this->assertSame('1', $normalized['enable_react_clinical_doc_hub']);
    }

    public function testGlobalMigrationDefaultsIncludesClinicalDocFlags(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        $this->assertArrayHasKey('enable_clinical_doc_hub', $defaults);
        $this->assertSame('0', $defaults['enable_clinical_doc_hub']);
        $this->assertArrayHasKey('clinical_doc_show_us_quality', $defaults);
        $this->assertArrayHasKey('enable_react_clinical_doc_hub', $defaults);
    }

    public function testGlobalMigrationDefaultsIncludesAdminHubFlags(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        $this->assertArrayHasKey('enable_admin_hub', $defaults);
        $this->assertSame('0', $defaults['enable_admin_hub']);
        $this->assertArrayHasKey('admin_hub_backup_retention_days', $defaults);
        $this->assertSame('30', $defaults['admin_hub_backup_retention_days']);
        $this->assertArrayHasKey('admin_hub_setup_complete', $defaults);
        $this->assertSame('0', $defaults['admin_hub_setup_complete']);
    }

    public function testApplySettingDependenciesEnablesScheduledIntegrationWhenQueueBridgeOn(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'enable_queue_bridge' => '1',
            'enable_scheduled_integration' => '0',
        ]);

        $this->assertSame('1', $normalized['enable_queue_bridge']);
        $this->assertSame('1', $normalized['enable_scheduled_integration']);
    }

    public function testApplySettingDependenciesEnablesScheduledIntegrationWhenSchedulingRedesignOn(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'enable_scheduling_redesign' => '1',
            'enable_scheduled_integration' => '0',
        ]);

        $this->assertSame('1', $normalized['enable_scheduling_redesign']);
        $this->assertSame('1', $normalized['enable_scheduled_integration']);
    }

    public function testApplySettingDependenciesEnablesReactAdminHubWhenAdminHubOn(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'enable_admin_hub' => '1',
            'enable_react_admin_hub' => '0',
        ]);

        $this->assertSame('1', $normalized['enable_admin_hub']);
        $this->assertSame('1', $normalized['enable_react_admin_hub']);
    }

    public function testApplySettingDependenciesCouplesDoctorReadyNotifyFlags(): void
    {
        $on = ClinicAdminService::applySettingDependencies([
            'enable_doctor_ready_web_push' => '1',
            'enable_doctor_ready_notify' => '0',
        ]);
        $this->assertSame('1', $on['enable_doctor_ready_notify']);

        $off = ClinicAdminService::applySettingDependencies([
            'enable_doctor_ready_notify' => '0',
            'notify_unassigned_to_all_on_duty' => '1',
            'enable_doctor_ready_web_push' => '1',
        ]);
        $this->assertSame('0', $off['notify_unassigned_to_all_on_duty']);
        $this->assertSame('0', $off['enable_doctor_ready_web_push']);
    }

    public function testApplySettingDependenciesNormalizesUnknownClinicalDocBundle(): void
    {
        $normalized = ClinicAdminService::applySettingDependencies([
            'clinical_doc_bundle' => 'unknown_bundle',
        ]);

        $this->assertSame('ghana_opd_v1', $normalized['clinical_doc_bundle']);
    }

    public function testGlobalMigrationDefaultsIncludesQueueBridgeFlags(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        $this->assertArrayHasKey('enable_queue_bridge', $defaults);
        $this->assertSame('0', $defaults['enable_queue_bridge']);
        $this->assertArrayHasKey('queue_bridge_show_recurring_info', $defaults);
        $this->assertArrayHasKey('enable_react_queue_bridge', $defaults);
    }

    public function testSaveRejectsBackupRetentionOutOfRange(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $service->saveSettings('global', [
            'admin_hub_backup_retention_days' => '999',
        ], 1);
    }

    /**
     * Regression guard for the class of bug behind the enable_office_notes /
     * enable_admin_hub / encounter_note_lbf_export_formdir audit (2026-07-11):
     * a field's own declared default in EDITABLE_SETTINGS must always pass its
     * own type's validation, because Admin Hub sends every known key's current
     * value on every save -- once a key is exposed to the UI at all, its
     * untouched default is exactly what gets round-tripped through save.
     */
    public function testEveryEditableSettingsDefaultSurvivesASave(): void
    {
        $service = new ClinicAdminService();

        $result = $service->saveSettings('global', ClinicAdminService::globalMigrationDefaults(), 1);

        $this->assertIsArray($result);
    }

    public function testSaveAcceptsEmptyLbfExportFormdirDefault(): void
    {
        $service = new ClinicAdminService();

        $result = $service->saveSettings('global', [
            'encounter_note_lbf_export_on_save' => '0',
            'encounter_note_lbf_export_formdir' => '',
        ], 1);

        $this->assertIsArray($result);
    }
}
