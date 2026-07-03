<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminHealthService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class AdminHealthServiceTest extends TestCase
{
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
}
