<?php

/**
 * Apply OpenEMR cash clinic profile globals (M6-F07, Appendix E)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class CashClinicProfileService
{
    public const DEFAULT_CLINIC_TZ = 'Africa/Accra';

    /** @var array<string, string> */
    private const MODULE_CONFIG_TARGETS = [
        'enable_pinned_reception_preview' => '1',
        'enable_rx_print' => '1',
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ConfigLogService $configLog = new ConfigLogService(),
    ) {
    }

    /**
     * @return array<string, string>
     */
    public static function buildOpenEmrGlobalTargets(
        string $currencySymbol,
        string $clinicTz,
        bool $pharmacyRoleEnabled
    ): array {
        $timezone = trim($clinicTz) !== '' ? trim($clinicTz) : self::DEFAULT_CLINIC_TZ;

        return [
            'disable_eligibility_log' => '1',
            'inhouse_pharmacy' => $pharmacyRoleEnabled ? '1' : '0',
            'disable_chart_tracker' => '0',
            'gbl_currency_symbol' => $currencySymbol,
            'gbl_time_zone' => $timezone,
            'simplified_demographics' => '1',
            'gbl_show_pat_search' => '0',
            'patient_search_results_style' => '0',
            'disable_user_log_login' => '0',
            'enable_cdr' => '0',
            'default_chief_complaint' => '',
            'disable_phpmyadmin_link' => '1',
            'esign_individual' => '1',
            'lock_esign_individual' => '1',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function apply(int $facilityId, int $actorUserId): array
    {
        $currencySymbol = (string) ($this->config->get('currency_symbol', 'GH₵', $facilityId) ?? 'GH₵');
        $clinicTz = (string) ($this->config->get('clinic_tz', self::DEFAULT_CLINIC_TZ, $facilityId) ?? self::DEFAULT_CLINIC_TZ);
        $pharmacyRole = $this->config->getInt('enable_pharmacy_role', 0, $facilityId) === 1;

        $globalTargets = self::buildOpenEmrGlobalTargets($currencySymbol, $clinicTz, $pharmacyRole);
        $globalChanges = [];

        foreach ($globalTargets as $key => $newValue) {
            $prev = $this->readGlobal($key);
            if ($prev === $newValue) {
                continue;
            }

            $this->writeGlobal($key, $newValue);
            $this->logChange('openemr_global', $key, $prev, $newValue, $actorUserId);
            $globalChanges[] = [
                'key' => $key,
                'prev' => $prev,
                'new' => $newValue,
            ];
        }

        $moduleChanges = [];
        foreach (self::MODULE_CONFIG_TARGETS as $key => $newValue) {
            $prev = (string) ($this->config->get($key, '0', $facilityId) ?? '0');
            if ($prev === $newValue) {
                continue;
            }

            $this->config->set($key, $newValue, $facilityId);
            $this->logChange('module_config', $key, $prev, $newValue, $actorUserId);
            $moduleChanges[] = [
                'key' => $key,
                'prev' => $prev,
                'new' => $newValue,
            ];
        }

        $appliedAt = date('c');
        $this->config->set('cash_profile_last_applied_at', $appliedAt, $facilityId);

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'cash_profile',
            'facility_id=' . $facilityId
                . ' globals=' . count($globalChanges)
                . ' module=' . count($moduleChanges),
            0
        );

        return [
            'facility_id' => $facilityId,
            'applied_at' => $appliedAt,
            'global_changes' => $globalChanges,
            'module_changes' => $moduleChanges,
            'unchanged' => $globalChanges === [] && $moduleChanges === [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getProfileStatus(int $facilityId): array
    {
        $lastApplied = $this->config->get('cash_profile_last_applied_at', null, $facilityId);

        return [
            'last_applied_at' => $lastApplied,
            'applied' => $lastApplied !== null && trim((string) $lastApplied) !== '',
        ];
    }

    private function readGlobal(string $key): string
    {
        $row = QueryUtils::querySingleRow(
            "SELECT gl_value FROM globals WHERE gl_name = ? AND gl_index = 0",
            [$key]
        );

        if (!is_array($row) || !array_key_exists('gl_value', $row)) {
            return '';
        }

        return (string) $row['gl_value'];
    }

    private function writeGlobal(string $key, string $value): void
    {
        sqlStatement(
            "INSERT INTO globals (gl_name, gl_index, gl_value) VALUES (?, 0, ?)
             ON DUPLICATE KEY UPDATE gl_value = VALUES(gl_value)",
            [$key, $value]
        );

        global $GLOBALS;
        $GLOBALS[$key] = $value;
    }

    private function logChange(
        string $scope,
        string $key,
        string $prevValue,
        string $newValue,
        int $actorUserId
    ): void {
        $this->configLog->log($scope, $key, $prevValue, $newValue, $actorUserId);
    }
}
