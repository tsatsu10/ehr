<?php

/**
 * Integration tests for config change audit log (M6-F07 / AUDIT-15)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ConfigLogService;
use PHPUnit\Framework\TestCase;

class ConfigLogServiceTest extends TestCase
{
    public function testEnsureTableIsIdempotent(): void
    {
        $service = new ConfigLogService();
        $service->ensureTable();
        $service->ensureTable();

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'new_config_log'"
        );

        $this->assertSame(1, (int) ($row['cnt'] ?? 0));
    }

    public function testLogWritesScopedAuditRow(): void
    {
        $service = new ConfigLogService();
        $marker = 'test_key_' . uniqid();

        try {
            $service->log('openemr_global', $marker, 'old', 'new', 42);

            $row = QueryUtils::querySingleRow(
                'SELECT config_scope, prev_value, new_value, actor_user_id
                 FROM new_config_log WHERE config_key = ? LIMIT 1',
                [$marker]
            );

            $this->assertIsArray($row);
            $this->assertSame('openemr_global', $row['config_scope']);
            $this->assertSame('old', $row['prev_value']);
            $this->assertSame('new', $row['new_value']);
            $this->assertSame(42, (int) $row['actor_user_id']);
        } finally {
            QueryUtils::sqlStatementThrowException(
                'DELETE FROM new_config_log WHERE config_key = ?',
                [$marker]
            );
        }
    }
}
