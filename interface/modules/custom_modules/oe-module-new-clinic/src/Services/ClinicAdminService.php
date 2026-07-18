<?php

/**
 * Clinic Setup configuration (M6)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class ClinicAdminService
{
    /** @var array<string, array{type: string, default: string, min?: int, max?: int, maxLength?: int}> */
    private const EDITABLE_SETTINGS = [
        'enable_triage' => ['type' => 'bool', 'default' => '1'],
        'registration_mode' => ['type' => 'string', 'default' => 'desk_full_form'],
        'dup_block_threshold' => ['type' => 'int', 'default' => '17', 'min' => 1, 'max' => 100],
        'dup_warn_threshold' => ['type' => 'int', 'default' => '10', 'min' => 1, 'max' => 100],
        'phone_validation_regex' => ['type' => 'string', 'default' => '^0[235]\d{8}$', 'maxLength' => 64],
        'country_code' => ['type' => 'string', 'default' => '233'],
        'clinic_tz' => ['type' => 'string', 'default' => CashClinicProfileService::DEFAULT_CLINIC_TZ, 'maxLength' => 64],
        'clinic_logo_path' => ['type' => 'string', 'default' => '', 'maxLength' => 255],
        'search_all_facilities_for_admin' => ['type' => 'bool', 'default' => '1'],
        'rate_limit_patients_search' => ['type' => 'int', 'default' => '30', 'min' => 1, 'max' => 1000],
        'rate_limit_dup_check' => ['type' => 'int', 'default' => '60', 'min' => 1, 'max' => 1000],
        'mrd_activity_feed_days' => ['type' => 'int', 'default' => '90', 'min' => 1, 'max' => 365],
        'lab_auto_bill_on_order' => ['type' => 'bool', 'default' => '1'],
        'pharmacy_auto_bill_on_dispense' => ['type' => 'bool', 'default' => '0'],
        'enable_partial_payment' => ['type' => 'bool', 'default' => '0'],
        'enable_insurance_scheme' => ['type' => 'bool', 'default' => '0'],
        'enable_payer_billing' => ['type' => 'bool', 'default' => '0'],
        'report_hub_moh_pack' => ['type' => 'string', 'default' => 'ghana_v1'],
        'enable_lab_role' => ['type' => 'bool', 'default' => '0'],
        'enable_pharmacy_role' => ['type' => 'bool', 'default' => '0'],
        'enable_ancillary_services' => ['type' => 'bool', 'default' => '0'],
        'ancillary_refer_window_hours' => ['type' => 'int', 'default' => '4', 'min' => 1, 'max' => 24],
        'lab_intake_formdir' => ['type' => 'string', 'default' => 'lab_intake'],
        'pharmacy_service_formdir' => ['type' => 'string', 'default' => 'pharmacy_service'],
        'pharmacy_refer_to_opd_terminal_state' => ['type' => 'string', 'default' => 'cancelled'],
        'pharmacy_declined_terminal_state' => ['type' => 'string', 'default' => 'cancelled'],
        'external_rx_max_age_days' => ['type' => 'int', 'default' => '730', 'min' => 1, 'max' => 3650],
        'enable_lab_ops' => ['type' => 'bool', 'default' => '0'],
        'enable_lab_panel_order' => ['type' => 'bool', 'default' => '0'],
        'enable_native_proc_order' => ['type' => 'bool', 'default' => '0'],
        'enable_native_rx_edit' => ['type' => 'bool', 'default' => '0'],
        'enable_native_rx_history' => ['type' => 'bool', 'default' => '0'],
        'enable_debootstrap_shell' => ['type' => 'bool', 'default' => '0'],
        'enable_pharm_ops' => ['type' => 'bool', 'default' => '0'],
        'enable_otc_manual_discount' => ['type' => 'bool', 'default' => '0'],
        'enable_pharm_rx_favorites' => ['type' => 'bool', 'default' => '0'],
        'enable_rx_print' => ['type' => 'bool', 'default' => '0'],
        'enable_dispense_label' => ['type' => 'bool', 'default' => '0'],
        'pharm_expiry_warn_days' => ['type' => 'int', 'default' => '90', 'min' => 1, 'max' => 365],
        'allow_multiple_visits_per_day' => ['type' => 'bool', 'default' => '1'],
        'enable_multi_doctor_filters' => ['type' => 'bool', 'default' => '0'],
        'enable_doctor_roster' => ['type' => 'bool', 'default' => '0'],
        'enable_advisory_routing' => ['type' => 'bool', 'default' => '0'],
        'routing_weight_active' => ['type' => 'string', 'default' => '2.0'],
        'routing_weight_waiting_assigned' => ['type' => 'string', 'default' => '1.0'],
        'routing_weight_waiting_unassigned' => ['type' => 'string', 'default' => '0.5'],
        'routing_fairness_minutes_per_point' => ['type' => 'int', 'default' => '15', 'min' => 1, 'max' => 120],
        'routing_continuity_days' => ['type' => 'int', 'default' => '90', 'min' => 1, 'max' => 365],
        'require_override_reason' => ['type' => 'bool', 'default' => '0'],
        'enable_hard_provider_assignment' => ['type' => 'bool', 'default' => '0'],
        'enable_doctor_ready_notify' => ['type' => 'bool', 'default' => '0'],
        'notify_unassigned_to_all_on_duty' => ['type' => 'bool', 'default' => '0'],
        'enable_doctor_ready_web_push' => ['type' => 'bool', 'default' => '0'],
        'enable_aggressive_orphan_facility_repair' => ['type' => 'bool', 'default' => '0'],
        'auto_dismiss_product_registration' => ['type' => 'bool', 'default' => '1'],
        'enable_chart_depth' => ['type' => 'bool', 'default' => '0'],
        'enable_chart_depth_finance' => ['type' => 'bool', 'default' => '0'],
        'enable_chart_depth_referral' => ['type' => 'bool', 'default' => '0'],
        'enable_chart_depth_export' => ['type' => 'bool', 'default' => '0'],
        'enable_letters_labels' => ['type' => 'bool', 'default' => '0'],
        'enable_vitals_trends' => ['type' => 'bool', 'default' => '0'],
        'enable_outreach' => ['type' => 'bool', 'default' => '0'],
        'enable_scheduled_integration' => ['type' => 'bool', 'default' => '1'],
        'registry_redirect_global_search' => ['type' => 'bool', 'default' => '0'],
        'completion_required_for_billing' => ['type' => 'int', 'default' => '70', 'min' => 0, 'max' => 100],
        'allow_billing_completion_override' => ['type' => 'bool', 'default' => '1'],
        'require_esign_before_complete_consult' => ['type' => 'bool', 'default' => '0'],
        'enforce_completion_on_revisit' => ['type' => 'bool', 'default' => '1'],
        'enable_shared_device_session_warning' => ['type' => 'bool', 'default' => '0'],
        'enable_faster_queue_interrupts' => ['type' => 'bool', 'default' => '0'],
        'faster_queue_interrupt_poll_seconds' => ['type' => 'int', 'default' => '10', 'min' => 10, 'max' => 30],
        'enable_similar_surname_queue_warning' => ['type' => 'bool', 'default' => '0'],
        'enable_momo_payment' => ['type' => 'bool', 'default' => '0'],
        'enable_pinned_reception_preview' => ['type' => 'bool', 'default' => '0'],
        'enable_pregnancy_banner_chip' => ['type' => 'bool', 'default' => '0'],
        'enable_l3b_background_completion' => ['type' => 'bool', 'default' => '0'],
        'enable_lab_results_toast' => ['type' => 'bool', 'default' => '0'],
        'enable_visit_board_kiosk_chrome' => ['type' => 'bool', 'default' => '0'],
        'enable_banner_mrd_deep_links' => ['type' => 'bool', 'default' => '0'],
        'enable_allergy_count_chip' => ['type' => 'bool', 'default' => '0'],
        'require_allergies_for_rx' => ['type' => 'bool', 'default' => '0'],
        'enable_in_chart_patient_search' => ['type' => 'bool', 'default' => '0'],
        'enable_scheduling_full_analytics' => ['type' => 'bool', 'default' => '0'],
        'print_queue_slip_on_start_visit' => ['type' => 'bool', 'default' => '1'],
        'print_queue_number_on_receipt' => ['type' => 'bool', 'default' => '1'],
        'queue_slip_instruction_text' => ['type' => 'string', 'default' => 'Please wait to be called', 'maxLength' => 255],
        'reconciliation_enabled' => ['type' => 'bool', 'default' => '1'],
        'reconciliation_tolerance' => ['type' => 'string', 'default' => '0.01'],
        'reconciliation_cron_time' => ['type' => 'string', 'default' => '23:55'],
        'enable_legacy_patient_context_overlay' => ['type' => 'bool', 'default' => '0'],
        'enable_legacy_strip_clinical_chips' => ['type' => 'bool', 'default' => '0'],
        'enable_legacy_strip_desk_return' => ['type' => 'bool', 'default' => '1'],
        'enable_react_visit_board' => ['type' => 'bool', 'default' => '1'],
        'enable_react_triage_desk' => ['type' => 'bool', 'default' => '1'],
        'enable_react_doctor_desk' => ['type' => 'bool', 'default' => '1'],
        'enable_react_cashier_desk' => ['type' => 'bool', 'default' => '1'],
        'enable_react_lab_desk' => ['type' => 'bool', 'default' => '1'],
        'enable_react_pharmacy_desk' => ['type' => 'bool', 'default' => '1'],
        'enable_react_front_desk' => ['type' => 'bool', 'default' => '1'],
        'enable_react_patient_registry' => ['type' => 'bool', 'default' => '1'],
        'enable_react_daily_reports' => ['type' => 'bool', 'default' => '1'],
        'enable_react_communications_hub' => ['type' => 'bool', 'default' => '1'],
        'enable_react_admin_hub' => ['type' => 'bool', 'default' => '1'],
        'enable_react_patient_chart' => ['type' => 'bool', 'default' => '1'],
        'enable_react_lab_ops' => ['type' => 'bool', 'default' => '1'],
        'enable_react_pharm_ops' => ['type' => 'bool', 'default' => '1'],
        'enable_react_chart_depth' => ['type' => 'bool', 'default' => '1'],
        'enable_bill_ops' => ['type' => 'bool', 'default' => '0'],
        'enable_bill_ops_outstanding' => ['type' => 'bool', 'default' => '0'],
        'enable_report_hub' => ['type' => 'bool', 'default' => '0'],
        'report_hub_show_us_quality' => ['type' => 'bool', 'default' => '0'],
        'report_hub_async_export_threshold' => ['type' => 'int', 'default' => '5000', 'min' => 1, 'max' => 50000],
        'bill_ops_reopen_on_correction' => ['type' => 'bool', 'default' => '0'],
        'enable_insurance' => ['type' => 'bool', 'default' => '0'],
        'enable_react_bill_ops' => ['type' => 'bool', 'default' => '1'],
        'enable_react_report_hub' => ['type' => 'bool', 'default' => '1'],
        'enable_queue_bridge' => ['type' => 'bool', 'default' => '0'],
        'queue_bridge_show_recurring_info' => ['type' => 'bool', 'default' => '1'],
        'queue_bridge_eod_block' => ['type' => 'bool', 'default' => '0'],
        'enable_react_queue_bridge' => ['type' => 'bool', 'default' => '1'],
        'enable_react_scheduling' => ['type' => 'bool', 'default' => '1'],
        'clinical_doc_show_screening' => ['type' => 'bool', 'default' => '0'],
        'clinical_doc_show_specialty' => ['type' => 'bool', 'default' => '0'],
        'clinical_doc_show_us_quality' => ['type' => 'bool', 'default' => '0'],
        'clinical_doc_bundle' => ['type' => 'string', 'default' => 'ghana_opd_v1'],
        'clinical_doc_specialty_pack' => ['type' => 'string', 'default' => '[]'],
        'consult_note_formdir' => ['type' => 'string', 'default' => 'soap'],
        'encounter_note_variant_map' => ['type' => 'string', 'default' => '{}'],
        'encounter_note_require_icd' => ['type' => 'bool', 'default' => '0'],
        'encounter_note_supervisor_required' => ['type' => 'bool', 'default' => '0'],
        'encounter_note_lbf_export_on_save' => ['type' => 'bool', 'default' => '0'],
        'encounter_note_lbf_export_formdir' => ['type' => 'string', 'default' => ''],
        'enable_react_clinical_doc_hub' => ['type' => 'bool', 'default' => '1'],
        'enable_admin_hub' => ['type' => 'bool', 'default' => '0'],
        // BACKUP-M6: min 0 (not 1) — 0 is a legitimate "never auto-delete backups"
        // setting (AdminBackupService::pruneOldArchives()/pruneOldRunRows() both
        // already treat <=0 as "never prune"); min=1 made that value unreachable
        // from the UI even though the backend already supported it honestly.
        'admin_hub_backup_retention_days' => ['type' => 'int', 'default' => '30', 'min' => 0, 'max' => 365],
        'enable_native_backup' => ['type' => 'bool', 'default' => '0'],
        'enable_duplicate_review' => ['type' => 'bool', 'default' => '0'],
        'enable_native_issue_editor' => ['type' => 'bool', 'default' => '0'],
        'enable_native_immunization_editor' => ['type' => 'bool', 'default' => '0'],
        'enable_native_referral_editor' => ['type' => 'bool', 'default' => '0'],
        'enable_native_certificate' => ['type' => 'bool', 'default' => '0'],
        'enable_native_eye_exam' => ['type' => 'bool', 'default' => '0'],
        'enable_cashier_other_payments' => ['type' => 'bool', 'default' => '0'],
        'enable_native_patient_notes' => ['type' => 'bool', 'default' => '0'],
        'enable_lab_followup_views' => ['type' => 'bool', 'default' => '0'],
        'backup_target_dir' => ['type' => 'string', 'default' => '', 'maxLength' => 512],
        'backup_frequency_days' => ['type' => 'int', 'default' => '0', 'min' => 0, 'max' => 365],
        'backup_include_site_files' => ['type' => 'bool', 'default' => '0'],
        // BACKUP-CAP: configurable in-memory encryption cap (MB) — see
        // AdminBackupService::DEFAULT_MAX_ENCRYPT_MB for the RAM-budget reasoning
        // behind the default and min.
        'backup_max_encrypt_mb' => ['type' => 'int', 'default' => '250', 'min' => 50, 'max' => 2000],
        'admin_hub_setup_complete' => ['type' => 'bool', 'default' => '0'],
        'enable_documents_native' => ['type' => 'bool', 'default' => '0'],
        'enable_patient_chat' => ['type' => 'bool', 'default' => '0'],
        'enable_patient_import' => ['type' => 'bool', 'default' => '0'],
        'pediatric_exact_dob_age' => ['type' => 'int', 'default' => '5', 'min' => 0, 'max' => 18],
        'currency_code' => ['type' => 'currency_code', 'default' => 'GHS'],
        'currency_symbol' => ['type' => 'currency_symbol', 'default' => 'GH₵'],
        'currency_decimals' => ['type' => 'int', 'default' => '2', 'min' => 0, 'max' => 4],
        'currency_symbol_position' => ['type' => 'currency_position', 'default' => 'before'],
    ];

    /**
     * BACKUP-M4b: a database backup is whole-DB, never per-facility (M4 — see
     * AdminBackupService). Backup config must therefore ALWAYS live at the
     * facility-0 sentinel, regardless of what facility scope a settings save
     * request happened to resolve to. Before this fix, saveSettings() wrote every
     * key — including these — at the request-resolved facility, then (for a
     * facility-scoped save) called `clearGlobalOverrides()` on every changed key,
     * which DELETES the facility-0 row. A single-facility pilot never noticed
     * (the reader-facility fallback in ClinicConfigService::get() papers over
     * it), but a multi-facility clinic saving Admin Hub settings from a non-first
     * facility would silently blow away its own backup schedule/target/retention
     * — the exact facility-scoped-flag failure mode this repo has been burned by
     * before (see CLAUDE.md "Facility-scoped flag reads"). These keys are forced
     * to facility 0 on both read (for change-detection) and write, and are never
     * passed to clearGlobalOverrides().
     */
    private const GLOBAL_ONLY_SETTINGS = [
        'enable_native_backup',
        'backup_target_dir',
        'backup_frequency_days',
        'backup_include_site_files',
        'admin_hub_backup_retention_days',
        'backup_max_encrypt_mb',
    ];

    /** @var array<string, array{type: string, default: string, min?: int, max?: int}> */
    private const READONLY_SETTINGS = [
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        private readonly ClinicRolesService $rolesService = new ClinicRolesService(),
        private readonly VisitTypeAdminService $visitTypeAdmin = new VisitTypeAdminService(),
        private readonly FeeScheduleAdminService $feeScheduleAdmin = new FeeScheduleAdminService(),
        private readonly DirectoryContactService $directoryContacts = new DirectoryContactService(),
        private readonly FacilityAdminService $facilityAdmin = new FacilityAdminService(),
        private readonly CashClinicProfileService $cashProfile = new CashClinicProfileService(),
        private readonly MoneyFormatService $moneyFormat = new MoneyFormatService(),
        private readonly ClinicalDocLbfWizardService $clinicalDocLbfWizard = new ClinicalDocLbfWizardService(),
        private readonly ClinicalDocReferralHospitalLbfWizardService $referralHospitalLbfWizard = new ClinicalDocReferralHospitalLbfWizardService(),
        private readonly ClinicalDocAncillaryLbfService $ancillaryLbf = new ClinicalDocAncillaryLbfService(),
        private readonly AdminFormBundleService $formBundle = new AdminFormBundleService(),
        private readonly AdminFormsCatalogService $formsCatalog = new AdminFormsCatalogService(),
        private readonly AdminHealthService $healthService = new AdminHealthService(),
        private readonly AdminRunbookService $runbooks = new AdminRunbookService(),
        private readonly AdminSetupProgressService $setupProgress = new AdminSetupProgressService(),
        private readonly AdminStaffProvisionService $staffProvision = new AdminStaffProvisionService(),
        private readonly AdminConfigExportService $configExport = new AdminConfigExportService(),
        private readonly AdminConfigImportService $configImport = new AdminConfigImportService(),
        private readonly CompletionFieldWeightAdminService $completionFieldWeights = new CompletionFieldWeightAdminService(),
    ) {
    }

    /**
     * @return array<string, array{type: string, default: string, min?: int, max?: int}>
     */
    public static function editableSettingsMeta(): array
    {
        return self::EDITABLE_SETTINGS;
    }

    /**
     * @return array<string, mixed>
     */
    public function getSettingsPayload(string $scope = 'facility', ?int $requestedFacilityId = null): array
    {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $settings = [];

        foreach (array_merge(self::EDITABLE_SETTINGS, self::READONLY_SETTINGS) as $key => $meta) {
            $default = $meta['default'];
            // BACKUP-M4c: GLOBAL_ONLY_SETTINGS (the 6 backup keys) must be READ at
            // the facility-0 sentinel too, not just written there (M4b covered
            // write). ClinicConfigService::get() checks the REQUESTED facility
            // FIRST, before ever falling back to 0 — so a stale pre-M4 row still
            // sitting at a non-zero facility (confirmed present on this box: see
            // the BACKUP-M4c install.sql cleanup) would silently win over the real
            // facility-0 value whenever a settings request happened to resolve to
            // that facility. A whole-DB backup setting must never depend on which
            // facility a request resolves to.
            $readFacilityId = in_array($key, self::GLOBAL_ONLY_SETTINGS, true) ? 0 : $facilityId;
            $raw = $this->config->get($key, $default, $readFacilityId) ?? $default;
            if ($meta['type'] === 'bool') {
                $settings[$key] = (int) $raw === 1;
            } elseif (
                $meta['type'] === 'string'
                || $meta['type'] === 'currency_code'
                || $meta['type'] === 'currency_symbol'
                || $meta['type'] === 'currency_position'
            ) {
                $settings[$key] = (string) $raw;
            } else {
                $settings[$key] = (int) $raw;
            }
        }

        $clinicFacilityId = $this->visitScope->resolveDefaultFacilityId();
        $adminHubEnabled = !empty($settings['enable_admin_hub']);

        // Build the form-bundle board once — the forms catalog derives its bundle
        // list from the same board, so passing it in avoids a second ~0.25s build.
        $formBundleBoard = $this->formBundle->getBoard($facilityId);

        $payload = [
            'facility_id' => $facilityId,
            'scope' => $facilityId === 0 ? 'global' : 'facility',
            'scope_label' => $this->facilityScopeLabel($facilityId),
            'clinic_facility_id' => $clinicFacilityId,
            'clinic_facility_label' => $this->facilityLabel($clinicFacilityId),
            'settings' => $settings,
            'visit_types' => $this->visitTypeAdmin->listForAdmin(
                $facilityId,
                (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0')
            ),
            'default_visit_type_id' => (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0'),
            'service_profiles' => VisitTypeAdminService::SERVICE_PROFILES,
            'fee_schedule' => $this->feeScheduleAdmin->listForAdmin($facilityId),
            'fee_form' => $this->feeScheduleAdmin->getFormMeta(),
            'directory_contacts' => $this->directoryContacts->listForAdmin(),
            'directory_types' => $this->directoryContacts->listTypes(),
            'facilities' => $this->facilityAdmin->listForAdmin(),
            'roles' => $this->rolesService->getRolesPayload(),
            'cash_profile' => $this->cashProfile->getProfileStatus($facilityId),
            'ghana_lbf_pack' => $this->clinicalDocLbfWizard->getPackStatus($facilityId),
            'referral_hospital_lbf_pack' => $this->referralHospitalLbfWizard->getPackStatus($facilityId),
            'ancillary_lbf_packs' => $this->ancillaryLbf->getAllPackStatus($facilityId),
            'form_bundle_board' => $formBundleBoard,
            'forms_catalog' => $this->formsCatalog->getCatalog($facilityId, $formBundleBoard),
            'completion_field_weights' => $this->completionFieldWeights->listForAdmin(),
        ];

        if ($adminHubEnabled) {
            // Compute health once and hand it to the setup checklist — getHealthStatus()
            // runs a COUNT over the multi-million-row `log` table, so calling it twice
            // (here + inside getProgress) doubled the settings-page load time.
            $systemHealth = $this->healthService->getHealthStatus($facilityId);
            $payload['system_health'] = $systemHealth;
            $payload['runbooks'] = $this->runbooks->getCatalog();
            $payload['setup_progress'] = $this->setupProgress->getProgress($facilityId, $systemHealth);
            $payload['config_export'] = array_merge(
                $this->configExport->getExportMeta(),
                $this->configImport->getImportMeta()
            );
        }

        return $payload;
    }

    /**
     * Create/update a facility, then return the refreshed facility list AND the
     * scope-bar labels. Renaming the clinic facility changes the name shown in
     * the Admin Hub header/scope bar, so the caller needs the fresh labels to
     * update in place without a full settings reload (which would clobber the
     * main form's unsaved state).
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function saveFacility(
        array $input,
        int $actorUserId,
        string $scope = 'facility',
        ?int $requestedFacilityId = null
    ): array {
        $facilities = $this->facilityAdmin->save($input, $actorUserId);

        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $clinicFacilityId = $this->visitScope->resolveDefaultFacilityId();

        return [
            'facilities' => $facilities,
            'scope_label' => $this->facilityScopeLabel($facilityId),
            'clinic_facility_label' => $this->facilityLabel($clinicFacilityId),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getSystemHealth(string $scope = 'facility', ?int $requestedFacilityId = null): array
    {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);

        return $this->healthService->getHealthStatus($facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function initiateBackupRun(
        string $scope,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $result = $this->healthService->initiateBackup($facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['backup_run_result' => $result]
        );
    }

    /**
     * Run the separate site-files backup (design §3b) and return the refreshed
     * settings payload with the run result attached.
     *
     * @return array<string, mixed>
     */
    public function initiateFilesBackupRun(
        string $scope,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $result = $this->healthService->initiateFilesBackup($facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['files_backup_run_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function completeBackupRun(
        string $scope,
        int $actorUserId,
        ?int $runId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $result = $this->healthService->completeBackup($facilityId, $actorUserId, $runId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['backup_run_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function importGhanaOpdLbfPack(string $scope, int $actorUserId, bool $setAsConsultNote, ?int $requestedFacilityId = null): array
    {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $result = $this->clinicalDocLbfWizard->importPack($facilityId, $actorUserId, $setAsConsultNote);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['ghana_lbf_pack_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function importReferralHospitalLbfPack(string $scope, int $actorUserId, bool $setAsConsultNote, ?int $requestedFacilityId = null): array
    {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $result = $this->referralHospitalLbfWizard->importPack($facilityId, $actorUserId, $setAsConsultNote);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['referral_hospital_lbf_pack_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function importAncillaryLbfPack(
        string $scope,
        int $actorUserId,
        string $packKey,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $result = $this->ancillaryLbf->importPack($packKey, $facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['ancillary_lbf_pack_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function setFormsCatalogState(
        string $scope,
        int $registryId,
        bool $enabled,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $result = $this->formsCatalog->setEnabled($registryId, $enabled, $facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['forms_catalog_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function markSetupItem(
        string $scope,
        string $checklistKey,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $progress = $this->setupProgress->markItemComplete($checklistKey, $facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['setup_progress' => $progress]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function unmarkSetupItem(
        string $scope,
        string $checklistKey,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $progress = $this->setupProgress->unmarkItem($checklistKey, $facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['setup_progress' => $progress]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function reopenSetup(
        string $scope,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $progress = $this->setupProgress->reopenSetup($facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['setup_progress' => $progress]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function provisionSetupStaff(
        string $scope,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $result = $this->staffProvision->provisionMissing($facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['staff_provision_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function exportConfigSnapshot(
        string $scope,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);

        $snapshot = $this->configExport->exportAndAudit(
            $facilityId,
            $this->facilityScopeLabel($facilityId),
            $actorUserId
        );

        return [
            'config_export_snapshot' => $snapshot,
            'config_export' => array_merge(
                $this->configExport->getExportMeta(),
                $this->configImport->getImportMeta()
            ),
        ];
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    public function importConfigSnapshot(
        string $scope,
        array $snapshot,
        int $actorUserId,
        ?int $requestedFacilityId = null,
        bool $dryRun = false
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);

        $result = $dryRun
            ? $this->configImport->previewImport($facilityId, $snapshot)
            : $this->configImport->importAndAudit($facilityId, $snapshot, $actorUserId);

        if (!$dryRun && is_array($result['settings'] ?? null) && $result['settings'] !== []) {
            $this->saveSettings(
                $scope,
                ClinicAdminService::applySettingDependencies($result['settings']),
                $actorUserId,
                $requestedFacilityId
            );
            $result['summary']['settings_imported'] = count($result['settings']);
        }

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['config_import_result' => $result]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function markSetupComplete(
        string $scope,
        int $actorUserId,
        ?int $requestedFacilityId = null
    ): array {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $this->assertAdminHubEnabled($facilityId);
        $progress = $this->setupProgress->markSetupComplete($facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['setup_progress' => $progress]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function applyCashClinicProfile(string $scope, int $actorUserId, ?int $requestedFacilityId = null): array
    {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $result = $this->cashProfile->apply($facilityId, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['cash_profile_result' => $result]
        );
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public function saveSettings(string $scope, array $input, int $actorUserId, ?int $requestedFacilityId = null): array
    {
        $facilityId = $this->resolveSettingsFacilityId($scope, $requestedFacilityId);
        $input = self::applySettingDependencies($input);
        $changed = [];
        // BACKUP-M4b — only keys actually written at the request-resolved facility
        // are eligible for clearGlobalOverrides() below; GLOBAL_ONLY_SETTINGS are
        // written at facility 0 and must never have their facility-0 row cleared.
        $changedScoped = [];

        foreach (self::EDITABLE_SETTINGS as $key => $meta) {
            if (!array_key_exists($key, $input)) {
                continue;
            }

            $isGlobalOnly = in_array($key, self::GLOBAL_ONLY_SETTINGS, true);
            $writeFacilityId = $isGlobalOnly ? 0 : $facilityId;

            $value = $this->normalizeValue($key, $meta, $input[$key]);
            if ($key === 'enable_lab_ops' && $value === '1') {
                $labRole = array_key_exists('enable_lab_role', $input)
                    ? $this->normalizeValue('enable_lab_role', self::EDITABLE_SETTINGS['enable_lab_role'], $input['enable_lab_role'])
                    : $this->config->get('enable_lab_role', '0', $facilityId);
                if ($labRole !== '1') {
                    throw new \InvalidArgumentException('Lab Operations requires Lab role to be enabled');
                }
            }
            if ($key === 'enable_pharm_ops' && $value === '1') {
                $pharmRole = array_key_exists('enable_pharmacy_role', $input)
                    ? $this->normalizeValue('enable_pharmacy_role', self::EDITABLE_SETTINGS['enable_pharmacy_role'], $input['enable_pharmacy_role'])
                    : $this->config->get('enable_pharmacy_role', '0', $facilityId);
                if ($pharmRole !== '1') {
                    throw new \InvalidArgumentException('Pharmacy Operations requires Pharmacy desk to be enabled');
                }
                if (empty($GLOBALS['inhouse_pharmacy'])) {
                    throw new \InvalidArgumentException(
                        'Pharmacy Operations requires in-house pharmacy to be enabled in OpenEMR globals'
                    );
                }
            }
            if ($key === 'enable_lab_panel_order' && $value === '1') {
                $labOps = array_key_exists('enable_lab_ops', $input)
                    ? $this->normalizeValue('enable_lab_ops', self::EDITABLE_SETTINGS['enable_lab_ops'], $input['enable_lab_ops'])
                    : $this->config->get('enable_lab_ops', '0', $facilityId);
                if ($labOps !== '1') {
                    throw new \InvalidArgumentException('Lab panel quick order requires Lab Operations to be enabled');
                }
            }
            if ($key === 'enable_pharm_rx_favorites' && $value === '1') {
                $pharmOps = array_key_exists('enable_pharm_ops', $input)
                    ? $this->normalizeValue('enable_pharm_ops', self::EDITABLE_SETTINGS['enable_pharm_ops'], $input['enable_pharm_ops'])
                    : $this->config->get('enable_pharm_ops', '0', $facilityId);
                if ($pharmOps !== '1') {
                    throw new \InvalidArgumentException('Formulary quick prescribe requires Pharmacy Operations to be enabled');
                }
            }
            if ($key === 'enable_dispense_label' && $value === '1') {
                $pharmOps = array_key_exists('enable_pharm_ops', $input)
                    ? $this->normalizeValue('enable_pharm_ops', self::EDITABLE_SETTINGS['enable_pharm_ops'], $input['enable_pharm_ops'])
                    : $this->config->get('enable_pharm_ops', '0', $facilityId);
                if ($pharmOps !== '1') {
                    throw new \InvalidArgumentException('Dispense labels require Pharmacy Operations to be enabled');
                }
            }
            if ($key === 'enable_ancillary_services' && $value === '1') {
                $labRole = array_key_exists('enable_lab_role', $input)
                    ? $this->normalizeValue('enable_lab_role', self::EDITABLE_SETTINGS['enable_lab_role'], $input['enable_lab_role'])
                    : $this->config->get('enable_lab_role', '0', $facilityId);
                $pharmRole = array_key_exists('enable_pharmacy_role', $input)
                    ? $this->normalizeValue('enable_pharmacy_role', self::EDITABLE_SETTINGS['enable_pharmacy_role'], $input['enable_pharmacy_role'])
                    : $this->config->get('enable_pharmacy_role', '0', $facilityId);
                if ($labRole !== '1' && $pharmRole !== '1') {
                    throw new \InvalidArgumentException(
                        'Ancillary walk-in services require at least one of lab desk or pharmacy desk to be enabled'
                    );
                }
            }
            if ($key === 'consult_note_formdir') {
                $formdir = strtolower(trim($value));
                if ($formdir === '' || in_array($formdir, ['fee_sheet', 'newpatient'], true)) {
                    throw new \InvalidArgumentException('consult_note_formdir must be a valid clinical form directory');
                }
                if (!$this->isActiveClinicalFormdir($formdir)) {
                    throw new \InvalidArgumentException('consult_note_formdir must match an active registry or LBF form');
                }
            }
            if ($key === 'encounter_note_variant_map') {
                $decoded = json_decode(trim($value), true);
                if (!is_array($decoded)) {
                    throw new \InvalidArgumentException('encounter_note_variant_map must be valid JSON object');
                }
            }
            if ($key === 'clinical_doc_specialty_pack') {
                $decoded = json_decode(trim($value), true);
                if (!is_array($decoded)) {
                    throw new \InvalidArgumentException('clinical_doc_specialty_pack must be a valid JSON array');
                }
            }
            if (in_array($key, ['pharmacy_refer_to_opd_terminal_state', 'pharmacy_declined_terminal_state'], true)) {
                $mode = strtolower(trim($value));
                if (!in_array($mode, ['cancelled', 'closed_no_charge'], true)) {
                    throw new \InvalidArgumentException($key . ' must be cancelled or closed_no_charge');
                }
            }
            if ($key === 'registration_mode') {
                if (!in_array($value, ['desk_full_form', 'progressive'], true)) {
                    throw new \InvalidArgumentException('registration_mode must be desk_full_form or progressive');
                }
            }
            if ($key === 'phone_validation_regex') {
                // QuickAddService runs this pattern raw (no safePhoneRegex fallback), so a
                // pattern that doesn't compile must be rejected here, not silently ignored.
                if (@preg_match('/' . $value . '/', '') === false) {
                    throw new \InvalidArgumentException('phone_validation_regex is not a valid regular expression');
                }
            }
            if ($key === 'country_code') {
                if (!preg_match('/^\d{1,4}$/', ltrim($value, '+'))) {
                    throw new \InvalidArgumentException('country_code must be a 1-4 digit dialing code');
                }
            }
            if ($key === 'clinic_tz') {
                if (!in_array($value, \DateTimeZone::listIdentifiers(), true)) {
                    throw new \InvalidArgumentException('clinic_tz must be a valid IANA timezone identifier');
                }
            }
            if ($key === 'dup_warn_threshold' || $key === 'dup_block_threshold') {
                $warn = $key === 'dup_warn_threshold'
                    ? (int) $value
                    : (int) (array_key_exists('dup_warn_threshold', $input)
                        ? $this->normalizeValue('dup_warn_threshold', self::EDITABLE_SETTINGS['dup_warn_threshold'], $input['dup_warn_threshold'])
                        : $this->config->get('dup_warn_threshold', '10', $facilityId));
                $block = $key === 'dup_block_threshold'
                    ? (int) $value
                    : (int) (array_key_exists('dup_block_threshold', $input)
                        ? $this->normalizeValue('dup_block_threshold', self::EDITABLE_SETTINGS['dup_block_threshold'], $input['dup_block_threshold'])
                        : $this->config->get('dup_block_threshold', '17', $facilityId));
                if ($warn > $block) {
                    throw new \InvalidArgumentException('Duplicate warn threshold cannot exceed the block threshold');
                }
            }
            $previous = $this->config->get($key, $meta['default'], $writeFacilityId);
            $this->config->set($key, $value, $writeFacilityId);

            if ((string) $previous !== $value) {
                $changed[] = $key;
                if (!$isGlobalOnly) {
                    $changedScoped[] = $key;
                }
            }
        }

        if ($facilityId > 0 && !empty($changedScoped)) {
            $this->config->clearGlobalOverrides($changedScoped);
        }

        if (!empty($changed)) {
            EventAuditLogger::getInstance()->newEvent(
                'new_clinic',
                'config',
                $actorUserId,
                1,
                'facility_id=' . $facilityId . ' keys=' . implode(',', $changed)
            );
        }

        $currencyKeys = ['currency_code', 'currency_symbol', 'currency_decimals', 'currency_symbol_position'];
        if (!empty(array_intersect($changed, $currencyKeys))) {
            $this->moneyFormat->syncOpenEmrGlobals($facilityId, $actorUserId);
        }

        return $this->getSettingsPayload($scope, $requestedFacilityId);
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    public function saveCompletionFieldWeights(
        array $rows,
        int $actorUserId,
        string $scope = 'facility',
        ?int $requestedFacilityId = null
    ): array {
        $weights = $this->completionFieldWeights->saveWeights($rows, $actorUserId);

        return array_merge(
            $this->getSettingsPayload($scope, $requestedFacilityId),
            ['completion_field_weights' => $weights]
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function grantDeskRolesToCurrentUser(string $username, int $actorUserId): array
    {
        $groups = $this->rolesService->grantDefaultDeskGroupsToUsername($username);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'roles',
            $actorUserId,
            1,
            'grant_self username=' . $username . ' groups=' . count($groups)
        );

        return [
            'username' => $username,
            'granted_groups' => $groups,
            'roles' => $this->rolesService->getRolesPayload(),
        ];
    }

    /**
     * @param array<string, mixed> $meta
     */
    private function normalizeValue(string $key, array $meta, mixed $raw): string
    {
        if ($meta['type'] === 'currency_code') {
            $value = strtoupper(trim((string) $raw));
            if (!preg_match('/^[A-Z]{3}$/', $value)) {
                throw new \InvalidArgumentException('Invalid ISO 4217 currency code for ' . $key);
            }

            return $value;
        }

        if ($meta['type'] === 'currency_symbol') {
            $value = trim((string) $raw);
            if ($value === '') {
                throw new \InvalidArgumentException('Invalid value for ' . $key);
            }

            return mb_substr($value, 0, 16);
        }

        if ($meta['type'] === 'currency_position') {
            $value = strtolower(trim((string) $raw));
            if ($value !== 'before' && $value !== 'after') {
                throw new \InvalidArgumentException('Invalid currency symbol position');
            }

            return $value;
        }

        if ($meta['type'] === 'bool') {
            return !empty($raw) && $raw !== '0' && $raw !== 'false' ? '1' : '0';
        }

        if ($meta['type'] === 'string') {
            $value = trim((string) $raw);
            // Optional string settings whose own declared default is '' must be allowed
            // to save empty: encounter_note_lbf_export_formdir only matters when its
            // companion on-save toggle is on, clinic_logo_path empty means "no logo",
            // and backup_target_dir empty means "native backup not configured yet"
            // (its enable_native_backup flag defaults OFF).
            // Every other string setting has a real default and should never be blank.
            $blankAllowed = ['encounter_note_lbf_export_formdir', 'clinic_logo_path', 'backup_target_dir'];
            if ($value === '' && !in_array($key, $blankAllowed, true)) {
                throw new \InvalidArgumentException('Invalid value for ' . $key);
            }

            // Historically this truncated every 'string' setting to 32 chars regardless
            // of what the field actually holds -- harmless for short codes (formdir names,
            // routing weights) but silently corrupted longer values (JSON maps, free text)
            // with no error surfaced to the admin. Per-key 'maxLength' now overrides the
            // default for fields that legitimately need more room.
            return mb_substr($value, 0, $meta['maxLength'] ?? 2000);
        }

        $intVal = (int) $raw;
        $min = $meta['min'] ?? PHP_INT_MIN;
        $max = $meta['max'] ?? PHP_INT_MAX;
        if ($intVal < $min || $intVal > $max) {
            throw new \InvalidArgumentException('Invalid value for ' . $key);
        }

        return (string) $intVal;
    }

    private function resolveSettingsFacilityId(string $scope, ?int $requestedFacilityId = null): int
    {
        if ($scope === 'global') {
            return 0;
        }

        return $this->visitScope->resolveActorFacilityId(
            $requestedFacilityId !== null && $requestedFacilityId > 0 ? $requestedFacilityId : null
        );
    }

    private function facilityLabel(int $facilityId): string
    {
        if ($facilityId <= 0) {
            return 'All facilities';
        }

        $row = QueryUtils::querySingleRow("SELECT name FROM facility WHERE id = ?", [$facilityId]);
        $name = is_array($row) ? trim((string) ($row['name'] ?? '')) : '';

        return $name !== ''
            ? $name
            : 'Facility ' . $facilityId;
    }

    private function facilityScopeLabel(int $facilityId): string
    {
        if ($facilityId === 0) {
            return 'All facilities (global default)';
        }

        return $this->facilityLabel($facilityId);
    }

    private function assertAdminHubEnabled(int $facilityId): void
    {
        if (!$this->config->isEnabled('enable_admin_hub', 0, $facilityId)) {
            throw new \RuntimeException('Admin Hub system features are not enabled for this clinic', 403);
        }
    }

    /**
     * Normalize coupled flags before persist (e.g. chart depth master + sub-flags).
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public static function applySettingDependencies(array $input): array
    {
        $chartDepthSubKeys = [
            'enable_chart_depth_finance',
            'enable_chart_depth_referral',
            'enable_chart_depth_export',
        ];

        $anyChartDepthSubOn = false;
        foreach ($chartDepthSubKeys as $subKey) {
            if (!array_key_exists($subKey, $input)) {
                continue;
            }
            if (self::rawBoolish($input[$subKey])) {
                $anyChartDepthSubOn = true;
                break;
            }
        }

        if ($anyChartDepthSubOn) {
            $input['enable_chart_depth'] = '1';
        }

        if (self::rawBoolish($input['report_hub_show_us_quality'] ?? false)) {
            $input['enable_report_hub'] = '1';
        }

        if (self::rawBoolish($input['enable_queue_bridge'] ?? false)) {
            $input['enable_scheduled_integration'] = '1';
        }

        if (self::rawBoolish($input['enable_admin_hub'] ?? false)) {
            $input['enable_react_admin_hub'] = '1';
        }

        if (self::rawBoolish($input['enable_advisory_routing'] ?? false)) {
            $input['enable_doctor_roster'] = '1';
            $input['enable_multi_doctor_filters'] = '1';
        }

        $notifyOff = array_key_exists('enable_doctor_ready_notify', $input)
            && !self::rawBoolish($input['enable_doctor_ready_notify']);
        $webPushOn = self::rawBoolish($input['enable_doctor_ready_web_push'] ?? false);
        $broadcastOn = self::rawBoolish($input['notify_unassigned_to_all_on_duty'] ?? false);

        if ($notifyOff && $webPushOn && $broadcastOn) {
            $input['notify_unassigned_to_all_on_duty'] = '0';
            $input['enable_doctor_ready_web_push'] = '0';
        } elseif ($webPushOn || $broadcastOn) {
            $input['enable_doctor_ready_notify'] = '1';
        }

        if (!self::rawBoolish($input['enable_doctor_ready_notify'] ?? false)) {
            $input['notify_unassigned_to_all_on_duty'] = '0';
            $input['enable_doctor_ready_web_push'] = '0';
        }

        if (array_key_exists('clinical_doc_bundle', $input)) {
            $input['clinical_doc_bundle'] = ClinicalDocCatalogService::normalizeBundleKey((string) $input['clinical_doc_bundle']);
        }

        return $input;
    }

    private static function rawBoolish(mixed $raw): bool
    {
        return !empty($raw) && $raw !== '0' && $raw !== 'false' && $raw !== false;
    }

    /**
     * Default values for global config rows inserted on module install/upgrade/enable.
     *
     * @return array<string, string>
     */
    public static function globalMigrationDefaults(): array
    {
        $defaults = [];
        foreach (self::EDITABLE_SETTINGS as $key => $meta) {
            $defaults[$key] = (string) $meta['default'];
        }

        return $defaults;
    }

    private function isActiveClinicalFormdir(string $formdir): bool
    {
        $registryRow = QueryUtils::querySingleRow(
            'SELECT state FROM registry WHERE LOWER(directory) = ? LIMIT 1',
            [$formdir]
        );
        if (is_array($registryRow) && (int) ($registryRow['state'] ?? 0) === 1) {
            return true;
        }

        $candidates = str_starts_with($formdir, 'lbf') ? [$formdir] : [$formdir, 'lbf' . $formdir];
        foreach ($candidates as $candidate) {
            $lbfRow = QueryUtils::querySingleRow(
                "SELECT grp_form_id FROM layout_group_properties
                 WHERE grp_form_id = ? AND grp_group_id = '' AND grp_activity = 1 LIMIT 1",
                [$candidate]
            );
            if (is_array($lbfRow)) {
                return true;
            }
        }

        return false;
    }
}
