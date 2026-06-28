<?php

/**
 * Module Manager lifecycle listener for New Clinic
 *
 * @package   OpenEMR Modules
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Core\AbstractModuleActionListener;
use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use OpenEMR\Modules\NewClinic\Services\ModuleService;
use OpenEMR\Modules\NewClinic\Services\PhoneBackfillService;

class ModuleManagerListener extends AbstractModuleActionListener
{
    private const ACL_VERSION = '0.2.3';

    public function moduleManagerAction($methodName, $modId, string $currentActionStatus = 'Success'): string
    {
        if (method_exists(self::class, $methodName)) {
            return self::$methodName($modId, $currentActionStatus);
        }

        return $currentActionStatus;
    }

    public static function getModuleNamespace(): string
    {
        return 'OpenEMR\\Modules\\NewClinic\\';
    }

    public static function initListenerSelf(): ModuleManagerListener
    {
        return new self();
    }

    private function install($modId, $currentActionStatus): mixed
    {
        self::setModuleState($modId, '0', '1');
        self::seedGlobals();
        self::installAclIfNeeded($modId);

        return $currentActionStatus;
    }

    private function enable($modId, $currentActionStatus): mixed
    {
        // mod_ui_active=0 after enable so Manage Modules shows Disable (OpenEMR UI convention).
        self::setModuleState($modId, '1', '0');
        self::seedGlobals();
        self::syncMissingConfigKeys();
        self::installAclIfNeeded($modId);

        return $currentActionStatus;
    }

    private function disable($modId, $currentActionStatus): mixed
    {
        self::setModuleState($modId, '0', '1');

        return $currentActionStatus;
    }

    private function preenable($modId, $currentActionStatus): mixed
    {
        return $currentActionStatus;
    }

    private function unregister($modId, $currentActionStatus): mixed
    {
        return $currentActionStatus;
    }

    private function install_sql($modId, $currentActionStatus): mixed
    {
        self::backfillPhoneNormalized();
        self::syncMissingConfigKeys();
        self::installAclIfNeeded($modId);

        return $currentActionStatus;
    }

    private function upgrade_sql($modId, $currentActionStatus): mixed
    {
        self::backfillPhoneNormalized();
        self::syncMissingConfigKeys();
        self::installAclIfNeeded($modId);

        return $currentActionStatus;
    }

    private function help_requested($modId, $currentActionStatus): mixed
    {
        return $currentActionStatus;
    }

    private function reset_module($modId, $currentActionStatus): mixed
    {
        $logMessage = '';
        $modService = new ModuleService();

        if (!$modService::getModuleState($modId)) {
            $tables = [
                'new_visit_state_log',
                'new_visit',
                'new_visit_queue_counter',
                'new_visit_type',
                'new_clinic_config',
                'new_patient_meta',
                'new_patient_completion',
                'new_completion_field_weight',
                'new_fee_schedule',
                'new_receipt',
                'new_receipt_counter',
                'new_cashier_payment_request',
            ];

            foreach ($tables as $table) {
                $sql = "DROP TABLE IF EXISTS `" . add_escape_custom($table) . "`";
                QueryUtils::querySingleRow($sql);
                $logMessage .= "DROP TABLE `{$table}`: Success\n";
            }

            $sql = "DELETE FROM `globals` WHERE `gl_name` LIKE 'new_clinic_%'";
            QueryUtils::querySingleRow($sql);
            $logMessage .= "DELETE new_clinic globals: Success\n";

            if (self::columnExists('patient_data', 'phone_normalized')) {
                $sql = "ALTER TABLE `patient_data` DROP COLUMN `phone_normalized`";
                QueryUtils::querySingleRow($sql);
                $logMessage .= "DROP COLUMN patient_data.phone_normalized: Success\n";
            }

            error_log(text($logMessage));
        }

        return text($logMessage);
    }

    private static function backfillPhoneNormalized(): void
    {
        if (!self::columnExists('patient_data', 'phone_normalized')) {
            return;
        }

        $service = new PhoneBackfillService();
        $total = 0;
        do {
            $count = $service->runBatch(1000);
            $total += $count;
        } while ($count > 0);

        if ($total > 0) {
            error_log("New Clinic: phone_normalized backfill updated {$total} rows");
        }
    }

    private static function columnExists(string $table, string $column): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            [$table, $column]
        );

        return ((int) ($row['cnt'] ?? 0)) > 0;
    }

    private static function seedGlobals(): void
    {
        $sql = "INSERT INTO `globals` (`gl_name`, `gl_index`, `gl_value`)
                VALUES ('new_clinic_module_active', 0, '1')
                ON DUPLICATE KEY UPDATE `gl_value` = '1'";
        QueryUtils::sqlInsert($sql);
    }

    private static function syncMissingConfigKeys(): void
    {
        foreach (ClinicAdminService::globalMigrationDefaults() as $key => $default) {
            $existing = QueryUtils::querySingleRow(
                "SELECT config_value FROM new_clinic_config WHERE facility_id = 0 AND config_key = ? LIMIT 1",
                [$key]
            );
            if (!empty($existing)) {
                continue;
            }

            QueryUtils::sqlInsert(
                "INSERT INTO new_clinic_config (facility_id, config_key, config_value) VALUES (0, ?, ?)",
                [$key, $default]
            );
        }

        self::pruneRedundantFacilityConfig();
    }

    /**
     * Drop per-facility overrides that duplicate the global (facility_id=0) value.
     */
    private static function pruneRedundantFacilityConfig(): void
    {
        sqlStatement(
            "DELETE f FROM new_clinic_config f
             INNER JOIN new_clinic_config g
               ON g.facility_id = 0
              AND g.config_key = f.config_key
              AND g.config_value <=> f.config_value
             WHERE f.facility_id > 0"
        );
    }

    private static function installAclIfNeeded(int|string $modId): void
    {
        $row = QueryUtils::querySingleRow(
            "SELECT mod_directory, acl_version FROM modules WHERE mod_id = ? OR mod_directory = ? LIMIT 1",
            [$modId, $modId]
        );
        $installedVersion = (string) ($row['acl_version'] ?? '');
        if ($installedVersion !== '' && version_compare($installedVersion, self::ACL_VERSION, '>=')) {
            return;
        }

        $moduleDir = dirname(__DIR__);
        $aclPath = $moduleDir . '/acl/acl_setup.php';
        if (!file_exists($aclPath)) {
            error_log('New Clinic: acl_setup.php not found');
            return;
        }

        $aclSetupFlag = true;
        include $aclPath;

        QueryUtils::querySingleRow(
            "UPDATE modules SET acl_version = ? WHERE mod_id = ? OR mod_directory = ?",
            [self::ACL_VERSION, $modId, $modId]
        );
    }

    private static function setModuleState(int|string $modId, int|string $flag, int|string $flag_ui): array|bool|null
    {
        $sql = "UPDATE `modules` SET `mod_active` = ?, `mod_ui_active` = ? WHERE `mod_id` = ? OR `mod_directory` = ?";

        return QueryUtils::querySingleRow($sql, [$flag, $flag_ui, $modId, $modId]);
    }
}
