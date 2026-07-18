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

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
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

    public function testGlobalMigrationDefaultsIncludesClinicalDocFlags(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        // 2026-07-18 flip: enable_clinical_doc_hub + encounter_note_engine retired.
        $this->assertArrayNotHasKey('enable_clinical_doc_hub', $defaults);
        $this->assertArrayNotHasKey('encounter_note_engine', $defaults);
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

    /**
     * Regression guard for the 2026-07-11 "dont assume check and fix" audit:
     * report_hub_async_export_threshold, lab_intake_formdir, pharmacy_service_formdir,
     * pharmacy_refer_to_opd_terminal_state, pharmacy_declined_terminal_state, and
     * clinical_doc_specialty_pack were already in EDITABLE_SETTINGS (so saveable via a
     * hand-crafted request) but had no adminFieldDefs.ts entry, so no real admin could
     * ever reach them. This confirms the backend side of the fix keeps working now that
     * they're wired to the UI.
     */
    public function testSaveAcceptsPreviouslyOrphanedSettings(): void
    {
        $service = new ClinicAdminService();

        $result = $service->saveSettings('global', [
            'report_hub_async_export_threshold' => '2500',
            'lab_intake_formdir' => 'lab_intake',
            'pharmacy_service_formdir' => 'pharmacy_service',
            'pharmacy_refer_to_opd_terminal_state' => 'closed_no_charge',
            'pharmacy_declined_terminal_state' => 'closed_no_charge',
            'clinical_doc_specialty_pack' => '["eye_mag","painmap"]',
        ], 1);

        $this->assertIsArray($result);

        // Restore defaults so this test leaves no residue for later tests/smokes.
        $service->saveSettings('global', [
            'report_hub_async_export_threshold' => '5000',
            'pharmacy_refer_to_opd_terminal_state' => 'cancelled',
            'pharmacy_declined_terminal_state' => 'cancelled',
            'clinical_doc_specialty_pack' => '[]',
        ], 1);
    }

    public function testSaveRejectsInvalidPharmacyTerminalState(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('pharmacy_refer_to_opd_terminal_state must be cancelled or closed_no_charge');
        $service->saveSettings('global', [
            'pharmacy_refer_to_opd_terminal_state' => 'voided',
        ], 1);
    }

    public function testSaveRejectsInvalidSpecialtyPackJson(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('clinical_doc_specialty_pack must be a valid JSON array');
        $service->saveSettings('global', [
            'clinical_doc_specialty_pack' => 'not json',
        ], 1);
    }

    /**
     * Regression guard for a silent-corruption bug found while adding
     * clinical_doc_specialty_pack to the UI (2026-07-11): normalizeValue()'s generic
     * 'string' branch truncated every string setting to 32 chars with no error, which
     * would have silently mangled JSON values like this pack list or
     * encounter_note_variant_map. Confirms values over the old 32-char cap now
     * round-trip intact.
     */
    public function testSaveDoesNotTruncateLongJsonStringSettings(): void
    {
        $service = new ClinicAdminService();
        $pack = '["eye_mag","bronchitis","ankleinjury","painmap","CAMOS"]';
        $variantMap = '{"Referral consult":"referral_consult","Follow-up":"follow_up"}';

        $service->saveSettings('global', [
            'clinical_doc_specialty_pack' => $pack,
            'encounter_note_variant_map' => $variantMap,
        ], 1);

        $payload = $service->getSettingsPayload('global', 1);
        $this->assertSame($pack, $payload['settings']['clinical_doc_specialty_pack']);
        $this->assertSame($variantMap, $payload['settings']['encounter_note_variant_map']);

        // Restore defaults so this test leaves no residue for later tests/smokes.
        $service->saveSettings('global', [
            'clinical_doc_specialty_pack' => '[]',
            'encounter_note_variant_map' => '{}',
        ], 1);
    }

    /**
     * Second batch of the same audit (2026-07-11, full codebase sweep): these keys were
     * consumed by real services (duplicate detection, phone validation/normalization,
     * lab auto-billing, MoH pack, registration mode, timezone, rate limits, branding)
     * but were missing from EDITABLE_SETTINGS entirely -- no Admin Hub field, no setup
     * wizard, no write path anywhere. Only a direct DB edit could change them.
     */
    public function testSaveAcceptsSecondBatchOfPreviouslyOrphanedSettings(): void
    {
        $service = new ClinicAdminService();

        $result = $service->saveSettings('global', [
            'registration_mode' => 'progressive',
            'dup_warn_threshold' => '8',
            'dup_block_threshold' => '20',
            'phone_validation_regex' => '^0\d{9}$',
            'country_code' => '234',
            'clinic_tz' => 'Africa/Lagos',
            'clinic_logo_path' => '',
            'search_all_facilities_for_admin' => '1',
            'rate_limit_patients_search' => '45',
            'rate_limit_dup_check' => '90',
            'mrd_activity_feed_days' => '120',
            'lab_auto_bill_on_order' => '0',
            'report_hub_moh_pack' => 'ghana_v1',
        ], 1);

        $this->assertIsArray($result);

        // Restore defaults so this test leaves no residue for later tests/smokes.
        $service->saveSettings('global', [
            'registration_mode' => 'desk_full_form',
            'dup_warn_threshold' => '10',
            'dup_block_threshold' => '17',
            'phone_validation_regex' => '^0[235]\d{8}$',
            'country_code' => '233',
            'clinic_tz' => 'Africa/Accra',
            'rate_limit_patients_search' => '30',
            'rate_limit_dup_check' => '60',
            'mrd_activity_feed_days' => '90',
            'lab_auto_bill_on_order' => '1',
        ], 1);
    }

    public function testSaveRejectsUnknownRegistrationMode(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('registration_mode must be desk_full_form or progressive');
        $service->saveSettings('global', ['registration_mode' => 'kiosk'], 1);
    }

    public function testSaveRejectsInvalidPhoneRegex(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('phone_validation_regex is not a valid regular expression');
        $service->saveSettings('global', ['phone_validation_regex' => '^0[23'], 1);
    }

    public function testSaveRejectsNonNumericCountryCode(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('country_code must be a 1-4 digit dialing code');
        $service->saveSettings('global', ['country_code' => 'GH'], 1);
    }

    public function testSaveRejectsInvalidClinicTimezone(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('clinic_tz must be a valid IANA timezone identifier');
        $service->saveSettings('global', ['clinic_tz' => 'Accra'], 1);
    }

    public function testSaveRejectsWarnThresholdAboveBlockThreshold(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Duplicate warn threshold cannot exceed the block threshold');
        $service->saveSettings('global', [
            'dup_warn_threshold' => '30',
            'dup_block_threshold' => '17',
        ], 1);
    }

    public function testSaveRespectsExplicitMaxLengthForQueueSlipText(): void
    {
        $service = new ClinicAdminService();
        $longText = str_repeat('a', 300);

        $service->saveSettings('global', [
            'queue_slip_instruction_text' => $longText,
        ], 1);

        $payload = $service->getSettingsPayload('global', 1);
        $this->assertSame(255, strlen((string) $payload['settings']['queue_slip_instruction_text']));

        // Restore the default so this test leaves no residue for later tests/smokes.
        $service->saveSettings('global', [
            'queue_slip_instruction_text' => 'Please wait to be called',
        ], 1);
    }

    /**
     * BACKUP-M4b: a database backup is whole-DB, never per-facility (M4 —
     * AdminBackupService). Backup config must always land at the facility-0
     * sentinel, even when the save request resolves to a specific non-zero
     * facility — otherwise a multi-facility clinic saving Admin Hub settings
     * from a non-first facility would write its backup schedule under that
     * facility's row, and then have clearGlobalOverrides() DELETE the real
     * facility-0 config underneath it, silently breaking the schedule for
     * every facility (the worker has no per-facility context to fall back to).
     */
    public function testBackupKeysAlwaysWriteAtFacilityZeroRegardlessOfScope(): void
    {
        $facRow = QueryUtils::querySingleRow('SELECT id FROM facility ORDER BY id LIMIT 1');
        $facilityId = is_array($facRow) ? (int) ($facRow['id'] ?? 0) : 0;
        if ($facilityId <= 0) {
            $this->markTestSkipped('No facility row available to exercise non-global scoping');
        }

        $config = new ClinicConfigService();
        $prevGlobal = $config->get('backup_frequency_days', '0', 0);
        $service = new ClinicAdminService();
        try {
            $service->saveSettings('facility', ['backup_frequency_days' => 5], 1, $facilityId);

            // Read back via a FRESH ClinicConfigService instance — $config's own
            // per-instance config map (SCALE-1.4) was already populated by the
            // $prevGlobal read above and is never told about writes made through
            // $service's own internal ClinicConfigService instance (only the
            // shared cross-request cache + DB are updated); reusing $config here
            // would read its stale pre-save snapshot, not prove anything about
            // the actual write.
            $fresh = new ClinicConfigService();
            $this->assertSame('5', $fresh->get('backup_frequency_days', '0', 0));

            // ...and the key must NOT have been written under the request-resolved
            // facility at all (config_value NULL when no row exists there).
            $row = QueryUtils::querySingleRow(
                'SELECT config_value FROM new_clinic_config WHERE facility_id = ? AND config_key = ?',
                [$facilityId, 'backup_frequency_days']
            );
            $this->assertTrue(
                !is_array($row) || $row['config_value'] === null,
                'backup_frequency_days must never be written at a non-zero facility'
            );
        } finally {
            $config->set('backup_frequency_days', (string) $prevGlobal, 0);
            sqlStatement(
                'DELETE FROM new_clinic_config WHERE facility_id = ? AND config_key = ?',
                [$facilityId, 'backup_frequency_days']
            );
        }
    }

    /**
     * BACKUP-M4b regression: before the fix, saving a NON-backup key at a
     * specific facility called clearGlobalOverrides() on every changed key in
     * the same request, which would have also deleted the facility-0 backup
     * row if backup keys weren't exempted. Prove a normal facility-scoped save
     * alongside a backup key leaves the facility-0 backup config intact.
     */
    public function testFacilityScopedSaveNeverClearsGlobalBackupConfig(): void
    {
        $facRow = QueryUtils::querySingleRow('SELECT id FROM facility ORDER BY id LIMIT 1');
        $facilityId = is_array($facRow) ? (int) ($facRow['id'] ?? 0) : 0;
        if ($facilityId <= 0) {
            $this->markTestSkipped('No facility row available to exercise non-global scoping');
        }

        $config = new ClinicConfigService();
        $prevGlobal = $config->get('admin_hub_backup_retention_days', '30', 0);
        $service = new ClinicAdminService();
        try {
            // Seed a real facility-0 backup config value first.
            $config->set('admin_hub_backup_retention_days', '14', 0);

            // Now save an UNRELATED, genuinely facility-scoped key at the specific facility.
            $service->saveSettings('facility', ['enable_triage' => '0'], 1, $facilityId);

            // The facility-0 backup retention value must be untouched. Fresh
            // instance — see the staleness note in the sibling test above.
            $fresh = new ClinicConfigService();
            $this->assertSame('14', $fresh->get('admin_hub_backup_retention_days', '30', 0));
        } finally {
            $config->set('admin_hub_backup_retention_days', (string) $prevGlobal, 0);
            $service->saveSettings('facility', ['enable_triage' => '1'], 1, $facilityId);
        }
    }
}
