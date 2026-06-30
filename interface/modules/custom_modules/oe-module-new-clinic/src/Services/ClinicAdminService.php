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
        'enable_lab_ops' => ['type' => 'bool', 'default' => '0'],
        'enable_lab_panel_order' => ['type' => 'bool', 'default' => '0'],
        'enable_pharm_ops' => ['type' => 'bool', 'default' => '0'],
        'enable_pharm_rx_favorites' => ['type' => 'bool', 'default' => '0'],
        'enable_rx_print' => ['type' => 'bool', 'default' => '0'],
        'enable_dispense_label' => ['type' => 'bool', 'default' => '0'],
        'pharm_expiry_warn_days' => ['type' => 'int', 'default' => '90', 'min' => 1, 'max' => 365],
        'allow_multiple_visits_per_day' => ['type' => 'bool', 'default' => '1'],
        'enable_multi_doctor_filters' => ['type' => 'bool', 'default' => '0'],
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
        'enable_faster_queue_interrupts' => ['type' => 'bool', 'default' => '0'],
        'faster_queue_interrupt_poll_seconds' => ['type' => 'int', 'default' => '10', 'min' => 10, 'max' => 30],
        'enable_similar_surname_queue_warning' => ['type' => 'bool', 'default' => '0'],
        'enable_pinned_reception_preview' => ['type' => 'bool', 'default' => '0'],
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
        'bill_ops_reopen_on_correction' => ['type' => 'bool', 'default' => '0'],
        'enable_insurance' => ['type' => 'bool', 'default' => '0'],
        'enable_react_bill_ops' => ['type' => 'bool', 'default' => '1'],
        'enable_react_report_hub' => ['type' => 'bool', 'default' => '1'],
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
    ) {
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

        return [
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
        ];
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
}
