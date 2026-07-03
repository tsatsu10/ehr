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
    public function testProgressShape(): void
    {
        $service = new AdminSetupProgressService();
        $progress = $service->getProgress(0);

        $this->assertArrayHasKey('setup_complete', $progress);
        $this->assertArrayHasKey('score_percent', $progress);
        $this->assertArrayHasKey('items', $progress);
        $this->assertArrayHasKey('can_mark_complete', $progress);
        $this->assertCount(10, $progress['items']);
        $this->assertArrayHasKey('key', $progress['items'][0]);
        $this->assertArrayHasKey('weight', $progress['items'][0]);
    }

    public function testMarkItemRejectsAutoItem(): void
    {
        $service = new AdminSetupProgressService();

        $this->expectException(\InvalidArgumentException::class);
        $service->markItemComplete('cash_profile', 0, 1);
    }

    public function testMarkSetupCompleteRejectsLowScore(): void
    {
        $service = new AdminSetupProgressService();

        $this->expectException(\InvalidArgumentException::class);
        $service->markSetupComplete(0, 1);
    }
}
