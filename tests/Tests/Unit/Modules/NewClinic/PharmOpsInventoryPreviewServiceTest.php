<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PharmOpsInventoryPreviewService;
use PHPUnit\Framework\TestCase;

class PharmOpsInventoryPreviewServiceTest extends TestCase
{
    public function testExternalDrugYieldsUnknownStockPreview(): void
    {
        $service = new PharmOpsInventoryPreviewService();

        $preview = $service->previewForDrug(0, 10.0);

        $this->assertSame(0, $preview['on_hand']);
        $this->assertFalse($preview['can_fulfill']);
        $this->assertSame('unknown', $preview['stock_status']);
        $this->assertNull($preview['fefo_lot']);
        $this->assertSame('No in-house drug selected', $preview['message']);
    }

    public function testExternalDrugMessageIsCustomizable(): void
    {
        $service = new PharmOpsInventoryPreviewService();

        $preview = $service->previewForDrug(-5, 1.0, 'External prescription — no stock check');

        $this->assertSame('External prescription — no stock check', $preview['message']);
    }
}
