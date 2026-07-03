<?php

/**
 * Unit tests for completion field weight admin (M6-F09)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CompletionFieldWeightAdminService;
use OpenEMR\Modules\NewClinic\Services\PatientCompletionService;
use PHPUnit\Framework\TestCase;

class CompletionFieldWeightAdminServiceTest extends TestCase
{
    public function testLabelHelpersExposeKnownFields(): void
    {
        $this->assertSame('First name', PatientCompletionService::labelForField('fname'));
        $this->assertSame('Basic info', PatientCompletionService::labelForLevel(1));
    }

    public function testSaveRejectsTotalsNotEqualToOneHundred(): void
    {
        $service = new CompletionFieldWeightAdminService();
        $payload = $service->listForAdmin();
        $items = $payload['items'] ?? [];
        if ($items === []) {
            $this->markTestSkipped('No completion weights configured');
        }

        $items[0]['weight'] = 1;
        foreach ($items as $index => $item) {
            if ($index === 0) {
                continue;
            }
            $items[$index]['is_active'] = false;
        }

        $this->expectException(\InvalidArgumentException::class);
        $service->saveWeights($items, 1);
    }
}
