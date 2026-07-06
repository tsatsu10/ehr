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
    /** @var array<string, array{type: string, default: string, min?: int, max?: int}> */
    private const EDITABLE_SETTINGS = [
        'enable_triage' => ['type' => 'bool', 'default' => '1'],
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
        'enable_pharm_ops' => ['type' => 'bool', 'default' => '0'],
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
        'communications_hub_enable' => ['type' => 'bool', 'default' => '0'],
        'enable_patient_registry' => ['type' => 'bool', 'default' => '0'],
        'enable_scheduled_integration' => ['type' => 'bool', 'default' => '1'],
        'registry_redirect_global_search' => ['type' => 'bool', 'default' => '0'],
        'completion_required_for_billing' => ['type' => 'int', 'default' => '70', 'min' => 0, 'max' => 100],
        'allow_billing_completion_override' => ['type' => 'bool', 'default' => '1'],
        'require_esign_before_complete_consult' => ['type' => 'bool', 'default' => '0'],
        'enforce_completion_on_revisit' => ['type' => 'bool', 'default' => '1'],
        'enable_shared_device_session_warning' => ['type' => 'bool', 'default' => '0'],
        'enable_history_editor_wrap' => ['type' => 'bool', 'default' => '0'],
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
        'queue_slip_instruction_text' => ['type' => 'string', 'default' => 'Please wait to be called'],
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
        'enable_scheduling_redesign' => ['type' => 'bool', 'default' => '1'],
        'enable_react_scheduling' => ['type' => 'bool', 'default' => '1'],
        'enable_clinical_doc_hub' => ['type' => 'bool', 'default' => '0'],
        'clinical_doc_show_screening' => ['type' => 'bool', 'default' => '0'],
        'clinical_doc_show_specialty' => ['type' => 'bool', 'default' => '0'],
        'clinical_doc_show_us_quality' => ['type' => 'bool', 'default' => '0'],
        'clinical_doc_bundle' => ['type' => 'string', 'default' => 'ghana_opd_v1'],
        'clinical_doc_specialty_pack' => ['type' => 'string', 'default' => '[]'],
        'consult_note_formdir' => ['type' => 'string', 'default' => 'soap'],
        'encounter_note_engine' => ['type' => 'string', 'default' => 'legacy'],
        'encounter_note_variant_map' => ['type' => 'string', 'default' => '{}'],
        'encounter_note_require_icd' => ['type' => 'bool', 'default' => '0'],
        'encounter_note_supervisor_required' => ['type' => 'bool', 'default' => '0'],
        'enable_react_clinical_doc_hub' => ['type' => 'bool', 'default' => '1'],
        'enable_admin_hub' => ['type' => 'bool', 'default' => '0'],
        'admin_hub_backup_retention_days' => ['type' => 'int', 'default' => '30', 'min' => 1, 'max' => 365],
        'admin_hub_setup_complete' => ['type' => 'bool', 'default' => '0'],
        'pediatric_exact_dob_age' => ['type' => 'int', 'default' => '5', 'min' => 0, 'max' => 18],
        'currency_code' => ['type' => 'currency_code', 'default' => 'GHS'],
        'currency_symbol' => ['type' => 'currency_symbol', 'default' => 'GH₵'],
        'currency_decimals' => ['type' => 'int', 'default' => '2', 'min' => 0, 'max' => 4],
        'currency_symbol_position' => ['type' => 'currency_position', 'default' => 'before'],
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
            $raw = $this->config->get($key, $default, $facilityId) ?? $default;
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
            'calendar_categories' => $this->visitTypeAdmin->listCalendarCategories(),
            'default_visit_type_id' => (int) ($this->config->get('default_visit_type_id', '0', $facilityId) ?? '0'),
            'service_profiles' => VisitTypeAdminService::SERVICE_PROFILES,
            'fee_schedule' => $this->feeScheduleAdmin->listForAdmin($facilityId),
            'fee_form' => $this->feeScheduleAdmin->getFormMeta(),
            'roles' => $this->rolesService->getRolesPayload(),
            'cash_profile' => $this->cashProfile->getProfileStatus($facilityId),
            'ghana_lbf_pack' => $this->clinicalDocLbfWizard->getPackStatus($facilityId),
            'referral_hospital_lbf_pack' => $this->referralHospitalLbfWizard->getPackStatus($facilityId),
            'ancillary_lbf_packs' => $this->ancillaryLbf->getAllPackStatus($facilityId),
            'form_bundle_board' => $this->formBundle->getBoard($facilityId),
            'forms_catalog' => $this->formsCatalog->getCatalog($facilityId),
            'completion_field_weights' => $this->completionFieldWeights->listForAdmin(),
        ];

        if ($adminHubEnabled) {
            $payload['system_health'] = $this->healthService->getHealthStatus($facilityId);
            $payload['runbooks'] = $this->runbooks->getCatalog();
            $payload['setup_progress'] = $this->setupProgress->getProgress($facilityId);
            $payload['config_export'] = array_merge(
                $this->configExport->getExportMeta(),
                $this->configImport->getImportMeta()
            );
        }

        return $payload;
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

        foreach (self::EDITABLE_SETTINGS as $key => $meta) {
            if (!array_key_exists($key, $input)) {
                continue;
            }

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
            if ($key === 'encounter_note_engine') {
                $engine = strtolower(trim($value));
                if (!in_array($engine, ['legacy', 'native'], true)) {
                    throw new \InvalidArgumentException('encounter_note_engine must be legacy or native');
                }
            }
            if ($key === 'encounter_note_variant_map') {
                $decoded = json_decode(trim($value), true);
                if (!is_array($decoded)) {
                    throw new \InvalidArgumentException('encounter_note_variant_map must be valid JSON object');
                }
            }
            $previous = $this->config->get($key, $meta['default'], $facilityId);
            $this->config->set($key, $value, $facilityId);

            if ((string) $previous !== $value) {
                $changed[] = $key;
            }
        }

        if ($facilityId > 0 && !empty($changed)) {
            $this->config->clearGlobalOverrides($changed);
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
            if ($value === '') {
                throw new \InvalidArgumentException('Invalid value for ' . $key);
            }

            return mb_substr($value, 0, 32);
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

        if (self::rawBoolish($input['enable_scheduling_redesign'] ?? false)) {
            $input['enable_scheduled_integration'] = '1';
        }

        if (self::rawBoolish($input['enable_admin_hub'] ?? false)) {
            $input['enable_react_admin_hub'] = '1';
        }

        if (
            self::rawBoolish($input['clinical_doc_show_us_quality'] ?? false)
            || self::rawBoolish($input['clinical_doc_show_screening'] ?? false)
            || self::rawBoolish($input['clinical_doc_show_specialty'] ?? false)
        ) {
            $input['enable_clinical_doc_hub'] = '1';
        }

        if (self::rawBoolish($input['enable_clinical_doc_hub'] ?? false)) {
            $input['enable_react_clinical_doc_hub'] = '1';
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
