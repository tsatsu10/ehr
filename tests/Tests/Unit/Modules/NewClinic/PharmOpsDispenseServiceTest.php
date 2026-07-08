<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsAccessService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsDispenseService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsInventoryPreviewService;
use PHPUnit\Framework\TestCase;

class PharmOpsDispenseServiceTest extends TestCase
{
    private function makeDeniedService(): PharmOpsDispenseService
    {
        $access = $this->createMock(PharmOpsAccessService::class);
        $access->method('assertHubAccess')
            ->willThrowException(new \RuntimeException('Forbidden', 403));
        $access->method('assertDispenseAccess')
            ->willThrowException(new \RuntimeException('Forbidden', 403));

        return new PharmOpsDispenseService(
            $access,
            $this->createMock(FacilityScopeService::class),
            $this->createMock(ClinicConfigService::class),
            $this->createMock(PharmOpsInventoryPreviewService::class),
        );
    }

    public function testConfirmDispenseRequiresDispenseAccess(): void
    {
        try {
            $this->makeDeniedService()->confirmDispense(1, ['quantity' => 1], 7);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }
}
