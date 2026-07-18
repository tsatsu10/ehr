<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\AdminBackupService;
use OpenEMR\Modules\NewClinic\Services\AdminHealthService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class AdminHealthServiceTest extends TestCase
{
    /** @var list<int> */
    private array $insertedRunIds = [];

    protected function tearDown(): void
    {
        foreach ($this->insertedRunIds as $id) {
            try {
                QueryUtils::sqlStatementThrowException('DELETE FROM admin_hub_backup_run WHERE id = ?', [$id]);
            } catch (\Throwable) {
                // best-effort
            }
        }
        $this->insertedRunIds = [];
    }

    /**
     * @return int the inserted run's id
     */
    private function insertRun(
        string $kind,
        string $status,
        ?string $filePath,
        ?int $actorId,
        ?string $verifiedAt = null,
        int $facilityId = 0
    ): int {
        $id = (int) QueryUtils::sqlInsert(
            "INSERT INTO admin_hub_backup_run
             (facility_id, kind, started_at, finished_at, status, file_path, size_bytes, actor_id, message, verified_at)
             VALUES (?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)",
            [$facilityId, $kind, $status, $filePath, $filePath !== null ? 1024 : null, $actorId, 'test fixture row', $verifiedAt]
        );
        $this->insertedRunIds[] = $id;

        return $id;
    }

    private function backupChip(array $health): array
    {
        foreach ($health['chips'] as $chip) {
            if (($chip['key'] ?? '') === 'backup') {
                return $chip;
            }
        }
        $this->fail('backup chip missing from health payload');
    }

    public function testHealthStatusShape(): void
    {
        $service = new AdminHealthService();
        $health = $service->getHealthStatus(0);

        $this->assertArrayHasKey('overall_status', $health);
        $this->assertArrayHasKey('checked_at', $health);
        $this->assertArrayHasKey('chips', $health);
        $this->assertArrayHasKey('meta', $health);
        $this->assertArrayHasKey('can_run_backup', $health);
        $this->assertArrayHasKey('backup_running', $health);
        $this->assertArrayHasKey('backup_history', $health);
        $this->assertIsArray($health['backup_history']);
        $this->assertIsArray($health['chips']);
        $this->assertNotEmpty($health['chips']);

        $keys = array_column($health['chips'], 'key');
        $this->assertContains('backup', $keys);
        $this->assertContains('reconciliation', $keys);
        $this->assertContains('disk', $keys);
        $this->assertContains('php', $keys);
        $this->assertContains('database', $keys);
        $this->assertContains('cron', $keys);

        $chip = $health['chips'][0];
        $this->assertArrayHasKey('label', $chip);
        $this->assertArrayHasKey('status', $chip);
        $this->assertArrayHasKey('summary', $chip);
        $this->assertArrayHasKey('detail', $chip);
        $this->assertArrayHasKey('overall_impact', $chip);
    }

    public function testDisabledReconciliationDoesNotWarnOverall(): void
    {
        $config = new ClinicConfigService();
        $facilityId = (new \OpenEMR\Modules\NewClinic\Services\VisitScopeService())->resolveDeskFacilityId();
        $prevReconcile = $config->get('reconciliation_enabled', '1', $facilityId);
        $prevScheduled = $config->get('enable_scheduled_integration', '0', $facilityId);
        try {
            $config->set('reconciliation_enabled', '0', $facilityId);
            $config->set('enable_scheduled_integration', '0', $facilityId);

            $service = new AdminHealthService(config: $config);
            $health = $service->getHealthStatus($facilityId);

            $reconcile = null;
            $cron = null;
            foreach ($health['chips'] as $chip) {
                if (($chip['key'] ?? '') === 'reconciliation') {
                    $reconcile = $chip;
                }
                if (($chip['key'] ?? '') === 'cron') {
                    $cron = $chip;
                }
            }

            $this->assertNotNull($reconcile);
            $this->assertNotNull($cron);
            $this->assertSame('none', $reconcile['overall_impact']);
            $this->assertSame('none', $cron['overall_impact']);
        } finally {
            $config->set('reconciliation_enabled', (string) $prevReconcile, $facilityId);
            $config->set('enable_scheduled_integration', (string) $prevScheduled, $facilityId);
        }
    }

    public function testInitiateBackupRequiresSuperAdmin(): void
    {
        $service = new AdminHealthService();

        $this->expectException(\RuntimeException::class);
        $service->initiateBackup(0, 1);
    }

    public function testCompleteBackupRequiresSuperAdmin(): void
    {
        $service = new AdminHealthService();

        $this->expectException(\RuntimeException::class);
        $service->completeBackup(0, 1);
    }

    /**
     * BACKUP-H3(ii)/(iii): an 'ok' run with NO file_path (the legacy "Mark
     * backup complete" stub) must never render as an unqualified green light —
     * the chip must say "self-reported" and its overall_impact must stay 'warn'
     * (never silently 'none', which is what made the shipped default lie).
     */
    public function testBackupChipLabelsSelfReportedRunsNotGreen(): void
    {
        $this->insertRun('db', 'ok', null, 7); // no file_path — the stub

        $health = (new AdminHealthService())->getHealthStatus(0);
        $chip = $this->backupChip($health);

        $this->assertStringContainsString('Self-reported', $chip['summary']);
        $this->assertSame('warn', $chip['overall_impact']);
        $this->assertNotSame('ok', $chip['status']);
    }

    /** A real, artifact-backed 'ok' run is still an honest green chip. */
    public function testBackupChipIsGreenForARealFreshArtifact(): void
    {
        $this->insertRun('db', 'ok', '/tmp/nc-backup-fixture.sql.gz.enc', 7);

        $health = (new AdminHealthService())->getHealthStatus(0);
        $chip = $this->backupChip($health);

        $this->assertSame('ok', $chip['status']);
        $this->assertSame('none', $chip['overall_impact']);
        $this->assertStringNotContainsString('Self-reported', $chip['summary']);
    }

    /**
     * BACKUP-H3(i): the setup checklist's "Backup tested" gate (consumed via
     * `backup_verified_native_run`) must require a REAL artifact AND a passed
     * verify — a self-reported 'ok' run must not satisfy it, even though the
     * legacy chip logic used to call that "ok".
     */
    public function testBackupVerifiedNativeRunFalseForSelfReportedOnly(): void
    {
        $this->insertRun('db', 'ok', null, 7); // self-reported, no artifact

        $health = (new AdminHealthService())->getHealthStatus(0);

        $this->assertFalse($health['backup_verified_native_run']);
    }

    public function testBackupVerifiedNativeRunTrueOnceArtifactAndVerifyBothExist(): void
    {
        $this->insertRun('db', 'ok', '/tmp/nc-backup-fixture-2.sql.gz.enc', 0, date('Y-m-d H:i:s'));

        $health = (new AdminHealthService())->getHealthStatus(0);

        $this->assertTrue($health['backup_verified_native_run']);
    }

    /**
     * BACKUP-H1(c): "last scheduled attempt" must reflect the last run with NO
     * interactive actor (actor_id IS NULL — how runScheduledBackup()/
     * runScheduledFilesBackup() always insert), not just the latest run of any
     * kind — a recent MANUAL "Run now" click must not paper over a schedule
     * that has silently never fired.
     */
    public function testLastScheduledAttemptIgnoresANewerManualRun(): void
    {
        $this->insertRun('db', 'failed', null, null); // scheduled attempt, actor_id NULL
        $this->insertRun('db', 'ok', '/tmp/nc-backup-fixture-3.sql.gz.enc', 7); // NEWER, manual (actor_id set)

        $health = (new AdminHealthService())->getHealthStatus(0);

        $this->assertNotNull($health['backup_last_scheduled_attempt']);
        $this->assertSame('failed', $health['backup_last_scheduled_attempt']['status']);
    }

    public function testLastScheduledAttemptNullWhenNoScheduledRunExistsYet(): void
    {
        $this->insertRun('db', 'ok', '/tmp/nc-backup-fixture-4.sql.gz.enc', 7); // manual only

        $health = (new AdminHealthService())->getHealthStatus(0);

        $this->assertNull($health['backup_last_scheduled_attempt']);
    }

    /** BACKUP-M4: backup config/run rows are read at the facility-0 sentinel. */
    public function testHealthReadsBackupRunsAtFacilityZero(): void
    {
        $this->assertSame(0, (new AdminBackupService())->facilityId());

        $runId = $this->insertRun('db', 'ok', '/tmp/nc-backup-fixture-5.sql.gz.enc', 7, null, 0);

        $health = (new AdminHealthService())->getHealthStatus(0);

        $this->assertSame($runId, $health['backup_run_id']);
    }
}
