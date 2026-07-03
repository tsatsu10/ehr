<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminFormsCatalogService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use PHPUnit\Framework\TestCase;

class AdminFormsCatalogServiceTest extends TestCase
{
    public function testCatalogShape(): void
    {
        $service = new AdminFormsCatalogService();
        $catalog = $service->getCatalog(0);

        $this->assertArrayHasKey('items', $catalog);
        $this->assertArrayHasKey('can_edit', $catalog);
        $this->assertIsArray($catalog['items']);
        if ($catalog['items'] !== []) {
            $item = $catalog['items'][0];
            $this->assertArrayHasKey('directory', $item);
            $this->assertArrayHasKey('enabled', $item);
            $this->assertArrayHasKey('bundle_required', $item);
            $this->assertArrayHasKey('disable_blocked', $item);
        }
    }

    public function testVitalsDisableBlockedWhenTriageOn(): void
    {
        $config = new ClinicConfigService();
        $previous = $config->get('enable_triage', '1', 0);
        try {
            $config->set('enable_triage', '1', 0);

            $service = new AdminFormsCatalogService(config: $config);
            $vitals = null;
            foreach ($service->getCatalog(0)['items'] as $item) {
                if (strtolower((string) ($item['directory'] ?? '')) === 'vitals') {
                    $vitals = $item;
                    break;
                }
            }

            if ($vitals === null) {
                $this->markTestSkipped('Vitals not in registry in this environment');
            }

            $this->assertTrue($vitals['disable_blocked']);
        } finally {
            $config->set('enable_triage', (string) $previous, 0);
        }
    }

    public function testFeeSheetEnableWarningWhenPresent(): void
    {
        $service = new AdminFormsCatalogService();
        $feeSheet = null;
        foreach ($service->getCatalog(0)['items'] as $item) {
            if (strtolower((string) ($item['directory'] ?? '')) === 'fee_sheet') {
                $feeSheet = $item;
                break;
            }
        }

        if ($feeSheet === null) {
            $this->markTestSkipped('fee_sheet not in registry in this environment');
        }

        $this->assertNotNull($feeSheet['enable_warning']);
    }
}
