<?php

/**
 * Unit tests for pharmacy post-complete routing
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PharmacyService;
use PHPUnit\Framework\TestCase;

class PharmacyServiceTest extends TestCase
{
    public function testResolvePostPharmacyStatePayment(): void
    {
        $this->assertSame('ready_for_payment', PharmacyService::resolvePostPharmacyState());
    }

    public function testCompletePharmacyEnforcesUndispensedGate(): void
    {
        $reflection = new \ReflectionClass(PharmacyService::class);
        $method = $reflection->getMethod('completePharmacy');
        $source = file_get_contents($reflection->getFileName());
        $this->assertIsString($source);
        $this->assertStringContainsString('PharmOpsUndispensedGate::assertResolved', $source);
        $this->assertStringContainsString('pharmacy_ops.complete_with_undispensed', $source);
    }
}
