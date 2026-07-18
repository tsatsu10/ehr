<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminSetupProgressService;
use PHPUnit\Framework\TestCase;

class AdminSetupProgressServiceTest extends TestCase
{
    /** Isolated facility id so dev-DB manual ticks can't leak into assertions. */
    private const TEST_FACILITY = 98765431;

    /** @return array<string, mixed> Synthetic health payload with a chosen cron chip. */
    private function healthWithCron(string $cronStatus): array
    {
        return [
            'chips' => [
                ['key' => 'cron', 'status' => $cronStatus],
                ['key' => 'backup', 'status' => 'warning'],
            ],
            'backup_verified_native_run' => false,
        ];
    }

    /**
     * @return array<string, mixed> Synthetic health payload with a chosen
     *         backup_verified_native_run signal (BACKUP-H3(i)).
     */
    private function healthWithBackupVerified(bool $verified): array
    {
        return [
            'chips' => [
                ['key' => 'cron', 'status' => 'ok'],
                // Legacy signal a stale check would have used — 'ok' on its own
                // must NOT be enough to complete the checklist item anymore.
                ['key' => 'backup', 'status' => 'ok'],
            ],
            'backup_verified_native_run' => $verified,
        ];
    }

    /** @param array<string, mixed> $progress @return array<string, mixed> */
    private function item(array $progress, string $key): array
    {
        foreach ($progress['items'] as $item) {
            if (($item['key'] ?? '') === $key) {
                return $item;
            }
        }

        $this->fail("Checklist item {$key} missing");
    }

    public function testProgressShape(): void
    {
        $service = new AdminSetupProgressService();
        $progress = $service->getProgress(0, $this->healthWithCron('warning'));

        $this->assertArrayHasKey('setup_complete', $progress);
        $this->assertArrayHasKey('score_percent', $progress);
        $this->assertArrayHasKey('score_threshold', $progress);
        $this->assertArrayHasKey('items', $progress);
        $this->assertArrayHasKey('can_mark_complete', $progress);
        $this->assertCount(10, $progress['items']);
        $this->assertArrayHasKey('key', $progress['items'][0]);
        $this->assertArrayHasKey('weight', $progress['items'][0]);
        $this->assertArrayHasKey('link_tab', $progress['items'][0]);

        $weights = array_sum(array_map(static fn (array $i): int => (int) $i['weight'], $progress['items']));
        $this->assertSame(100, $weights);
    }

    public function testCronItemFollowsHealthChipNotConfigDefaults(): void
    {
        $service = new AdminSetupProgressService();
        // Clear any manual tick so only the auto signal decides.
        $service->unmarkItem('cron_configured', self::TEST_FACILITY, 1);

        // Flags default ON — the old check called that "configured". The real
        // signal is the health cron chip (an actual completed scheduled run).
        $stale = $service->getProgress(self::TEST_FACILITY, $this->healthWithCron('warning'));
        $this->assertFalse($this->item($stale, 'cron_configured')['completed']);

        $fresh = $service->getProgress(self::TEST_FACILITY, $this->healthWithCron('ok'));
        $this->assertTrue($this->item($fresh, 'cron_configured')['completed']);
    }

    public function testManualMarkUnmarkRoundtrip(): void
    {
        $service = new AdminSetupProgressService();
        $service->unmarkItem('g12_drill', self::TEST_FACILITY, 1);

        $before = $service->getProgress(self::TEST_FACILITY, $this->healthWithCron('warning'));
        $this->assertFalse($this->item($before, 'g12_drill')['completed']);

        $marked = $service->markItemComplete('g12_drill', self::TEST_FACILITY, 1);
        $item = $this->item($marked, 'g12_drill');
        $this->assertTrue($item['completed']);
        $this->assertTrue($item['ticked']);

        $unmarked = $service->unmarkItem('g12_drill', self::TEST_FACILITY, 1);
        $this->assertFalse($this->item($unmarked, 'g12_drill')['completed']);
    }

    public function testReopenSetupClearsCompleteFlag(): void
    {
        $service = new AdminSetupProgressService();
        $progress = $service->reopenSetup(self::TEST_FACILITY, 1);

        $this->assertFalse($progress['setup_complete']);
    }

    public function testMarkItemRejectsAutoItem(): void
    {
        $service = new AdminSetupProgressService();

        $this->expectException(\InvalidArgumentException::class);
        $service->markItemComplete('cash_profile', self::TEST_FACILITY, 1);
    }

    public function testUnmarkItemRejectsAutoItem(): void
    {
        $service = new AdminSetupProgressService();

        $this->expectException(\InvalidArgumentException::class);
        $service->unmarkItem('backup_test', self::TEST_FACILITY, 1);
    }

    public function testMarkSetupCompleteRejectsLowScore(): void
    {
        $service = new AdminSetupProgressService();

        $this->expectException(\InvalidArgumentException::class);
        $service->markSetupComplete(self::TEST_FACILITY, 1);
    }

    /**
     * BACKUP-H3(i): "tested" must mean tested. Before this fix, the backup_test
     * item completed off the health chip alone, which could be "ok" from a
     * self-reported "Mark backup complete" click with nothing on disk (H3). Now
     * it requires the dedicated backup_verified_native_run signal — a REAL
     * artifact that has actually passed a decrypt-and-read-back verify.
     */
    public function testBackupTestRequiresVerifiedNativeRunNotJustAnOkChip(): void
    {
        $service = new AdminSetupProgressService();

        $notTested = $service->getProgress(self::TEST_FACILITY, $this->healthWithBackupVerified(false));
        $this->assertFalse($this->item($notTested, 'backup_test')['completed']);

        $tested = $service->getProgress(self::TEST_FACILITY, $this->healthWithBackupVerified(true));
        $this->assertTrue($this->item($tested, 'backup_test')['completed']);
    }
}
