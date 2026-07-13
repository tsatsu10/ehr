<?php

/**
 * Tests for append-only history-table retention (SCALE-6.3)
 *
 * Runs against the live dev DB (like the other worker-purge service tests).
 * Uses nc_test_ret_* markers in new_config_log and cleans up.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\HistoryRetentionService;
use PHPUnit\Framework\TestCase;

class HistoryRetentionServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        sqlStatement("DELETE FROM new_config_log WHERE config_key LIKE 'nc_test_ret_%'");
    }

    public function testDisabledRetentionNeverPurges(): void
    {
        // 0 = never auto-purge (the new_visit_state_log compliance default).
        $this->assertSame('disabled', (new HistoryRetentionService())->purge('new_visit_state_log', 0));
        $this->assertSame('disabled', (new HistoryRetentionService())->purge('new_config_log', -5));
    }

    public function testUnknownTableIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new HistoryRetentionService())->purge('patient_data', 30); // not a history table
    }

    public function testPurgesOnlyRowsOlderThanCutoff(): void
    {
        sqlStatement("INSERT INTO new_config_log (config_key, applied_at) VALUES ('nc_test_ret_old', DATE_SUB(NOW(), INTERVAL 5 DAY))");
        sqlStatement("INSERT INTO new_config_log (config_key, applied_at) VALUES ('nc_test_ret_new', NOW())");

        $purged = (new HistoryRetentionService())->purge('new_config_log', 1); // keep 1 day

        $this->assertIsInt($purged);
        $old = sqlQuery("SELECT COUNT(*) AS n FROM new_config_log WHERE config_key = 'nc_test_ret_old'");
        $new = sqlQuery("SELECT COUNT(*) AS n FROM new_config_log WHERE config_key = 'nc_test_ret_new'");
        $this->assertSame(0, (int) ($old['n'] ?? -1), 'row older than the cutoff should be purged');
        $this->assertSame(1, (int) ($new['n'] ?? -1), 'row newer than the cutoff must be kept');
    }

    public function testNothingToPurgeReturnsZero(): void
    {
        // A 100-year retention → nothing is that old → 0 rows purged.
        $this->assertSame(0, (new HistoryRetentionService())->purge('new_config_log', 36500));
    }

    public function testPurgeAllHonoursConfiguredDefaults(): void
    {
        $out = (new HistoryRetentionService())->purgeAll();

        // state_log defaults to 0 (compliance) → never purged.
        $this->assertSame('disabled', $out['new_visit_state_log'] ?? null);
        // The other two run (int rows purged, 0 when nothing is past their 730-day default).
        $this->assertIsInt($out['new_config_log'] ?? null);
        $this->assertIsInt($out['new_visit_notify_log'] ?? null);
    }
}
