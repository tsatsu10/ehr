<?php

/**
 * Audit log for cash clinic profile and currency global sync (M6-F07, M6-F27).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ConfigLogService
{
    private static bool $schemaEnsured = false;

    public function ensureTable(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        if ($this->tableExists()) {
            self::$schemaEnsured = true;

            return;
        }

        sqlStatement(
            "CREATE TABLE IF NOT EXISTS `new_config_log` (
                `id` BIGINT NOT NULL AUTO_INCREMENT,
                `config_scope` VARCHAR(32) NOT NULL DEFAULT 'openemr_global',
                `config_key` VARCHAR(128) NOT NULL,
                `prev_value` TEXT NULL,
                `new_value` TEXT NULL,
                `actor_user_id` INT NULL,
                `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                KEY `idx_config_key_applied` (`config_key`, `applied_at`)
            ) ENGINE=InnoDB COMMENT='Audit log for cash clinic profile and config changes (M6-F07)'"
        );

        self::$schemaEnsured = true;
    }

    public function log(
        string $scope,
        string $key,
        string $prevValue,
        string $newValue,
        int $actorUserId
    ): void {
        $this->ensureTable();

        sqlStatement(
            "INSERT INTO new_config_log
                (config_scope, config_key, prev_value, new_value, actor_user_id, applied_at)
             VALUES (?, ?, ?, ?, ?, NOW())",
            [$scope, $key, $prevValue, $newValue, $actorUserId]
        );
    }

    private function tableExists(): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'new_config_log'"
        );

        return ((int) ($row['cnt'] ?? 0)) > 0;
    }
}
