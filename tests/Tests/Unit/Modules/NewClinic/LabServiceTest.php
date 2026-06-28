<?php

/**
 * Unit tests for lab post-complete routing
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\LabService;
use PHPUnit\Framework\TestCase;

class LabServiceTest extends TestCase
{
    public function testResolvePostLabStatePharmacyOrderedFlag(): void
    {
        $visit = ['pharmacy_ordered' => 1];
        $this->assertSame('ready_for_pharmacy', LabService::resolvePostLabState($visit, 1, 100));
    }

    public function testResolvePostLabStatePaymentDefault(): void
    {
        $visit = ['pharmacy_ordered' => 0];
        $this->assertSame('ready_for_payment', LabService::resolvePostLabState($visit, 1, 100));
    }
}
